# ADR-0014: Fellowship Real-Time Chat

**Status:** Accepted
**Date:** 2026-09-05
**Owner:** Lead Engineering

## Context

Milestone scope item: a production-quality real-time chat system, with **Fellowship** — not
Cohort, not Organization — as the communication boundary. Hierarchy: `SUPER_ADMIN →
ORGANIZATION_ADMIN → ACADEMY_ADMIN → FELLOWSHIP → COHORT → MENTOR/STUDENT`, Fellowship → Channels →
Messages, with **no `FELLOWSHIP_ADMIN` role** — explicitly forbidden by the brief and not created.
Out of scope, and not built: file uploads, voice/video, external integrations, AI chat, a full
presence service, a full notification rewrite, and any new org/Academy/Fellowship/Cohort
architecture. DMs/1:1 messaging were originally on this "not built" list too — see the 2026-09-06
addendum below, which formally reverses that and documents what was built instead.

Phase 1 architecture review found: no WebSocket layer existed anywhere in the codebase; Redis was
provisioned in `docker-compose.yml` but intentionally not wired into the API (a code comment there
says as much — reserved for a future data-platform/notifications milestone); there is no Passport,
no session store — auth is a custom `AccessTokenService` issuing/verifying a JWT directly; and every
existing multi-tenant module derives access from real relationships (`Enrollment`, `CohortMentor`,
academy-scoped `Membership`), never from a resource ID alone. This ADR's decisions extend that
architecture rather than replacing any of it.

## Decisions

1. **Channel access has no new membership table — it's derived from the same relationships every
   other module already uses**, via one shared `ChatAccessService.authorize(scope, userId,
   fellowshipId)`:
   - Super Admin: unconditional.
   - An org-wide role holding `chat.channel.manage` (ORG_ADMIN): any Fellowship in their
     organization.
   - An academy-scoped role holding `chat.channel.manage` (ACADEMY_ADMIN): only Fellowships under
     their own Academy.
   - Mentor: an active (`unassignedAt: null`) `CohortMentor` assignment on any Cohort under the
     Fellowship.
   - Student: an active/paused/completed `Enrollment` in the Fellowship — `invited` (never joined)
     and `withdrawn` do **not** grant access.

   `chat.channel.manage` is the branch signal — not a role-name string comparison — checked
   *before* ever calling `MembershipsService.getAcademyScope()`, because MENTOR and STUDENT both
   have `scopeType: 'organization'` in the seed (a home-academy anchor, not an authorization scope),
   which would otherwise make `getAcademyScope()` misreport them as "org-wide unrestricted." This
   one function is the single source of truth both the REST controllers and the WebSocket gateway
   call — there is no second, parallel authorization implementation to drift out of sync.

   A private channel (`isPrivate: true`) additionally requires either `canManageChannels` or a row
   in the new `FellowshipChatChannelMember` table — the one new membership concept this feature
   does add, deliberately scoped to private channels only (a public channel's access is entirely
   Fellowship-derived, never consulting this table).

2. **Redis is wired in narrowly: a minimal `RedisService` (raw `ioredis`, two connections) plus
   `@socket.io/redis-adapter`, used only to fan real-time chat events out across API instances —
   never as the source of truth for messages (Postgres is) or for authorization.** A `publish()`
   never throws; a lost publish only delays other tabs/devices seeing a message instantly — the
   message itself is already committed. This was verified against a real failure, not assumed: this
   dev environment genuinely runs without Redis (native Postgres, no `docker:up`), and the first
   working version of this wiring crashed the entire API the moment Redis was unreachable. Two
   causes, both fixed: (a) `ioredis`'s `subscribe()` is dual-mode — a callback *and* an
   independently-rejecting Promise — so `RedisEventsService` now `.catch()`s it explicitly; (b)
   `@socket.io/redis-adapter` issues its own internal Redis commands with no call site of this
   codebase's own to attach a handler to, so `main.ts` adds one narrowly-scoped
   `process.on('unhandledRejection', …)` that swallows only `MaxRetriesPerRequestError` and lets
   every other unhandled rejection crash the process exactly as before. Confirmed by restarting the
   API with Redis down and polling health continuously through repeated connection-retry warnings.

3. **The WebSocket gateway is subscribe-and-receive only — it accepts no write.** Every mutation
   (message create/update/delete, reactions, channel management) goes through the existing,
   already-authorized REST endpoints; Redis pub/sub is only how the resulting event reaches the
   gateway to broadcast to the right room. This means there is exactly one authorization-checked
   code path per mutation regardless of client surface, and "a client must never send directly to a
   Fellowship it isn't authorized for over the socket" is true by construction — no such handler
   exists to call.

   `chat.subscribe` re-runs the identical `ChatChannelsService.get()` check the REST
   `GET /chat/channels/:id` route uses. Because a socket can stay connected far longer than one
   request, a 30-second local-socket sweep (`revalidateAll()`) re-runs that same check against every
   live subscription and force-unsubscribes (emitting `chat.access.revoked`) anything no longer
   authorized — covering revocation, removal, and org/academy changes without waiting for the next
   reconnect.

4. **Every Fellowship gets a `#general` channel automatically, created from
   `FellowshipsService.create()`** (`CatalogModule` imports `ChatModule` — not the reverse — to keep
   the dependency direction one-way) via `ChatChannelsService.createDefaultGeneralChannel()`,
   wrapped in try/catch so a chat-side failure never blocks Fellowship creation itself. Beyond that,
   channel management (create/rename/archive/restore, optionally private) is available to
   `chat.channel.manage` holders (ORG_ADMIN/ACADEMY_ADMIN) via REST; announcements are a channel
   *type* (`ChatChannelType.announcements`), not a separate system.

5. **Reply notifications reuse the existing `NotificationsService.notify()` exactly as
   Announcements does — a plain persisted row, not a new delivery channel — and only for a reply to
   the recipient's own message, never one row per channel message.** `@mention` notifications are
   deliberately not implemented: `User` has no handle/username concept to match `@foo` against (only
   `displayName`/`emailCanonical`), and inventing one solely for chat would be new architecture this
   task's scope excludes. See `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-034.

## Consequences

- Five new tables (`FellowshipChatChannel`, `FellowshipChatMessage`, `FellowshipChatMessageReaction`,
  `FellowshipChatChannelMember`, `FellowshipChatReadState`), one new enum (`ChatChannelType`), five
  new permissions (`chat.channel.read`/`.manage`, `chat.message.create`/`.moderate`,
  `chat.reaction.manage`) granted per the access matrix above — no changes to any existing table,
  role, or permission.
- New runtime dependencies: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`,
  `@socket.io/redis-adapter`, `ioredis` (API); `socket.io-client` (API's own WebSocket integration
  test, and the web app's chat UI).
- `REDIS_URL` is now a real, validated config value (`env.validation.ts`), not just a `.env` default
  no code read. Redis being down degrades real-time delivery only — verified live, not assumed.
- The frontend gained one new feature area (`apps/web/src/features/chat`) built into the existing
  React app (routing, API client, session/org context, design system) — no separate app, no new
  routing pattern. `/portal/chat` (Student) and `/mentor/chat` (Mentor) reuse one shared
  `ChatWorkspace` component; a mentor assigned to cohorts across more than one Fellowship switches
  which one's chat they see via the same cohort selector `MentorContext` already drives elsewhere in
  the mentor portal, rather than a second selector.
- Channel *management* (create/rename/archive) has no frontend surface in this pass — the REST
  endpoints and permissions are fully built and tested, but no admin screen calls them yet. See
  `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-035.
- The three-column wireframe's "Members" panel is a lightweight channel-info panel (type,
  description, privacy), not a member roster — there is no Fellowship-wide membership listing
  endpoint to source one from, and Decision 1 deliberately didn't add a general-purpose one (only
  the private-channel-specific `FellowshipChatChannelMember`).

See `docs/KNOWN_TECHNICAL_DEBT.md` (DEBT-034, DEBT-035) for what this ADR deliberately deferred.

## Addendum (2026-09-06): admin chat UI, channel creation UI, and reversing "no DMs"

Two closures and one reversal, all from the same follow-up task:

1. **Admin chat access was already fully authorized (Decision 1's Super/Org/Academy Admin matrix
   already covered viewing, sending, moderating, and creating channels) — only the frontend surface
   was missing.** `FellowshipDetailPage` (Admin) now has a "Chat" section reusing `ChatWorkspace`
   as-is, and `ChannelSidebar` gained the previously-missing "Create channel" action (see
   `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-035, now closed). Zero backend changes were needed for this
   part.
2. **DMs/1:1 messaging — originally "out of scope, and not built" — are now built**, per explicit
   product decision. Organization-scoped only (deliberately narrower than `User`/`username`'s
   platform-wide identity — a student in one organization must never be able to discover or contact
   someone in an unrelated one just by knowing their username). Deliberately minimal relative to
   Fellowship chat: no reactions, no reply-threading, no dedicated read-state table (unread
   signaling reuses the Notification model instead — a `dm.message.received` row per message,
   exactly like a Fellowship chat reply already creates one). Two new tables
   (`DirectConversation`, normalized `user1Id < user2Id` pair unique per organization;
   `DirectMessage`), a new `GET /me/people/search` (any active org member can search any other,
   by name or username — deliberately not the admin `user.read`-gated directory), and
   `GET/POST /me/conversations`, `GET/POST /me/conversations/:id/messages`, all gated by the
   already-broadly-granted `chat.message.create` (ownership enforced in-service, matching the
   `GET /enrollments/me` convention).
3. **Real-time delivery for DMs is REST + client polling, not the WebSocket gateway.** `ChatGateway`
   (Decision 3) is intricate — a 30s revalidation sweep, per-channel Fellowship/Cohort/Enrollment/
   academy-scope authorization. DMs have a categorically simpler authorization shape ("is the caller
   one of exactly two participants"). Extending the existing gateway for a materially different
   access model was judged a bigger risk to an already-tested system than this feature's real-time
   requirement justified — a deliberate, disclosed scope narrowing, not an oversight.

## Addendum (2026-09-07): channel rename/archive/restore UI, and a real `#general` member roster

Two closures, on explicit product request:

1. **Rename/archive/restore, the two pieces of DEBT-035 the 2026-09-06 addendum's "Create channel"
   closure explicitly left open, now have UI.** `ChannelInfoPanel` gained an edit action
   (`chat.channel.manage` only) and an archive/restore action with a confirm dialog; `ChatChannelsService.list()`
   gained an `includeArchived` option (server-enforced: honored only for a caller who actually holds
   `chat.channel.manage`, silently ignored otherwise — matching this codebase's existing "permissive
   query param" convention rather than rejecting it outright) so a manager can find an archived
   channel to restore. `ChannelSidebar` shows archived channels dimmed with a badge behind a
   manager-only "Show archived channels" toggle. No backend/permission changes — the REST endpoints
   already existed and were already tested; this closes the remaining frontend gap only. DEBT-035 is
   now fully closed; see its updated entry in `docs/KNOWN_TECHNICAL_DEBT.md`.

2. **A real, listable member roster for a Fellowship's `#general` channel — on explicit product
   request ("every enrolled student in a fellowship should be added to their channel... they should
   also be able [to see] the list of those in their channel so they can start a conversation directly
   with them"), reversing this ADR's Consequences section's "no Fellowship-wide membership listing
   endpoint" and, narrowly, Decision 1's framing of `FellowshipChatChannelMember` as scoped to private
   channels only.** The reversal is narrower than it sounds and does not touch authorization at all:

   - **`FellowshipChatChannelMember` rows are now also populated for `#general`** (previously nothing
     in the codebase ever wrote a row to this table at all — it existed in the schema, unused). A new
     `ChatMembershipSyncService`, called from `EnrollmentsService.update()` on every status
     transition, upserts/removes a row keyed on whether the new status is one of
     `active`/`paused`/`completed` — deliberately the exact same status set Decision 1's Student
     access check already uses, kept as a single named constant
     (`EnrollmentsService.CHAT_ACCESS_STATUSES`) so the two can never drift apart. Idempotent either
     direction (upsert / `deleteMany`), so a status that bounces (e.g. `active → paused → active`)
     never hits a unique-constraint error or double-removes.
   - **This changes nothing about who can access `#general`.** `ChatAccessService.authorize()`
     (Decision 1's sole authorization authority) is completely unchanged and unaware this table is
     now populated for that channel — a public channel's access was, and still is, entirely
     Fellowship-derived; `FellowshipChatChannelMember` is only ever consulted for `isPrivate: true`
     channels, and `#general` is never private. The table now serves two genuinely separate purposes
     depending on which channel a row belongs to: gating access (private channels, Decision 1's
     original reason for the table) and, new here, backing a roster (`#general` only) — the two never
     overlap because no channel is both.
   - **Scope is deliberately students only, not mentors** (`CohortMentor` assignments are not synced
     into this table) — matching the literal product request ("every enrolled student"). A mentor or
     admin in a Fellowship is simply not in `#general`'s roster yet; this is a disclosed limitation,
     not a bug, and the natural next step if mentors are asked for later.
   - **New endpoint `GET /chat/channels/:channelId/members`**, gated by the same broadly-granted
     `chat.channel.read` every participant already holds (not `chat.channel.manage` — the point is
     any participant can see who else is in the channel to message them, not just managers), reusing
     the exact same access check `GET /chat/channels/:channelId` already enforces (organization
     match, Fellowship authorization, private-channel membership) via a new shared
     `requireReadAccess()` helper on `ChatChannelsService`.
   - **The frontend roster lives in `ChannelInfoPanel`** (a new `MembersList`), visible to every
     participant. Clicking a member starts (or resumes) a DM via the existing `POST /me/conversations`
     (this ADR's 2026-09-06 addendum) and deep-links straight to it on that role's own Messages page —
     exactly the same `?conversationId=` deep link a `dm.message.received` notification already uses.
     DM eligibility itself is unchanged and unaffected by this feature: `DirectMessagesService`
     already restricts a DM target to an active member of the caller's own organization (the
     2026-09-06 addendum), which is broader than "in this specific channel" — a roster entry is simply
     one more, more discoverable way to reach someone already reachable by search.

## Addendum (2026-09-12): Students may not DM Super Admin or Org Admin

The 2026-09-06 addendum's "anyone active in the same organization" DM eligibility rule, confirmed at
the time, is narrowed on explicit product request: **a Student may not start a DM with a Super Admin
or Org Admin.** Deliberately narrow in three ways, each a direct answer to a clarifying question
before implementation:

1. **Only Super Admin and Org Admin are restricted — Academy Admin and Mentor remain reachable.** The
   request was specifically about platform/organization-level administrators, not every elevated
   role.
2. **One-way.** A Student can't initiate to a Super Admin/Org Admin, but they can still initiate to a
   Student (e.g. following up on an issue raised elsewhere) — the restriction protects a Student's
   access to those roles, not the reverse.
3. **Hidden entirely, not just blocked on send.** A restricted admin is excluded from
   `GET /me/people/search` outright (filtered at the query level via `MembershipsRepository
   .searchActiveMembers`'s new `excludeRoleKeys`, so `take: limit` still returns a full page rather
   than under-filling after a post-filter) — no dead-end click from a search result into an error. If
   somehow addressed directly anyway (a stale link, a shared conversation id from before this
   change), `startOrGetConversation` throws the *identical* `NOT_FOUND` / "This person is not a
   member of your organization" already used for a genuine non-member, so a restricted admin is
   indistinguishable from someone who doesn't exist — never a distinguishing `FORBIDDEN` that would
   confirm they're real.

**Only Student → Super Admin/Org Admin is checked, not every role pair** — the ask was specific, and
this codebase's convention throughout (`ChatAccessService`, `ChatMembershipSyncService`) has been to
implement exactly what's requested and disclose the boundary rather than speculatively generalize
into a full permission matrix nobody asked for yet.

`DirectMessagesService.isRestrictedTarget()` checks two things: is the *caller* a Student
(`MembershipsService.hasRoleKey`, org-scoped — a new, small, org-scoped role-key lookup, distinct
from `PermissionResolverService.hasPlatformRole`'s platform-wide one already used for Super Admin
elsewhere), and is the *target* a Super Admin (`PermissionResolverService.hasPlatformRole` —
correctly platform-wide, since a Super Admin's role grant is platform-scoped even though it's
attached to one home-organization `Membership` row) or an Org Admin within this same organization
(`hasRoleKey` again). Role-name checks, not permission-key checks, on purpose: this is specifically
about who a Student may *reach*, not what either party may *do* — the same distinction Decision 1
draws between "is this an admin" (permission-based) and Student/Mentor access (relationship-based),
just applied to a different question.

The Fellowship chat member roster (`GET /chat/channels/:channelId/members`, this ADR's 2026-09-07
addendum) needed no corresponding change: `FellowshipChatChannelMember` rows are populated for
students only, so a Super Admin/Org Admin was never going to appear there regardless of this
restriction.

## Addendum (2026-09-12): a missing #general backfilled, Mentors can create channels, and auto-created Track channels

Three related closures from the same follow-up task, on explicit product request:

1. **A real gap, found while investigating "why can't I load my fellowship chat": two Fellowships
   created before this ADR shipped (2026-09-03, two days before Decision 4's auto-creation went live
   2026-09-05) had no `#general` channel at all — the auto-creation hook only runs on *new* Fellowship
   creation, and nothing ever backfilled the ones that predated it.** Not a code bug — verified the
   hook works correctly for everything created since. Backfilled the one affected in active use via
   the same creation path a real request would use (`POST /fellowships/:id/chat/channels` with
   `type: 'general'`), then cycled the affected Enrollment's status to re-trigger
   `ChatMembershipSyncService` now that the channel exists. No code change; recorded here so the next
   person who hits an empty channel list on an old Fellowship knows why.

2. **A Mentor may now create channels — but only in a Fellowship they're actually assigned to, and
   only create, never rename/archive/restore.** `FellowshipChatAuthorization` gains a
   `canCreateChannels` field, distinct from `canManageChannels`: true for every admin
   `canManageChannels` already covers, **and** true for a Mentor with an active `CohortMentor`
   assignment on this Fellowship (`canManageChannels` itself stays false for a Mentor — deliberately
   narrower than admin power, per explicit product answer "create only"). `ChatChannelsService.create()`
   now gates on `canCreateChannels`; `update()`/`setArchived()` are untouched, still
   `canManageChannels`-only. The `POST /fellowships/:id/chat/channels` route's permission decorator
   relaxes from `chat.channel.manage` to `chat.channel.read` (which a Mentor already holds) — the
   coarse guard now only blocks someone with no chat access at all; the real, Fellowship-specific
   gating is `canCreateChannels` at the service layer, matching this codebase's existing "coarse guard
   + precise service check" split used elsewhere. Manually creating a `type: 'track'` channel through
   this same generic endpoint is explicitly rejected (`TRACK_CHANNEL_NOT_MANUAL`) — see point 3.

   **Breaking change**: `GET /fellowships/:id/chat/channels` now returns
   `{ channels, canManageChannels, canCreateChannels }` instead of a bare `ChatChannel[]` — the
   frontend's "Create channel" and "Edit/Archive" actions need the caller's capability *for this
   specific Fellowship*, which a static, org-wide role-permission check can't express (a Mentor's
   `canCreateChannels` depends on which Fellowship they're viewing; an Academy Admin's
   `canManageChannels` already did too, per Decision 1's academy-scope check, but the frontend never
   had a way to know that until now — so this incidentally also fixes an Academy Admin viewing a
   Fellowship outside their academy seeing an edit/archive action that would 403 on click).

3. **A Cohort being assigned a Learning Track now auto-creates that pairing's own chat channel** —
   `type: 'track'`, on explicit request ("different tracks channel according as it is in the
   cohort"). New `ChatChannelType.track` (schema migration
   `20260912200000_add_track_chat_channels`) and two new nullable `FellowshipChatChannel` columns,
   `cohortId`/`learningTrackId`, set only on `type: 'track'` rows. `CohortsService.setOfferedTracks()`
   (a replace-all operation) diffs the previous offering against the new one *before* replacing it,
   and calls `ChatChannelsService.createTrackChannel()` only for tracks newly present — wrapped in
   try/catch exactly like `createDefaultGeneralChannel()`'s own call site, so a chat-side failure
   never blocks the track assignment itself. Removing a track from a Cohort's offering deliberately
   does **not** auto-archive its channel — nobody asked for that, and it would delete conversation
   history over a config change.

   The channel's slug embeds the Cohort's own slug, not just the Track's (`track-<cohort
   slug>-<track slug>`), because the same Fellowship-level `LearningTrack` can be offered by more than
   one Cohort — each occurrence needs its own channel and its own Fellowship-unique slug.
   `createTrackChannel()` is idempotent (`findByCohortAndTrack` first) in case the creation call
   somehow runs twice for the same newly-added track.

   **Visibility is the interesting part**: a Student sees only the `type: 'track'` channel matching
   their *own* `Enrollment.cohortId` + `currentLearningTrackId` — never every track channel in the
   Fellowship. Everyone who can create channels (every admin, and now a Mentor per point 2) is
   unrestricted, exactly like every other channel type. Enforced in three places that all need to
   agree, since this codebase doesn't centralize channel-read authorization in one function (a
   pre-existing shape, not introduced here — `ChatMessagesService` has always duplicated
   `ChatChannelsService`'s own private-channel check rather than delegating to it):
   `ChatChannelsService.list()` (the listing filter), `ChatChannelsService.requireReadAccess()` (so a
   Student can't reach a channel that isn't theirs by guessing/reusing its id — this is also what the
   WebSocket gateway's `subscribe` handler ultimately gates on, since it calls
   `ChatChannelsService.get()`), and `ChatMessagesService`'s own `requireChannelAccess()` (so a Student
   can't read or post messages into it directly either). All three resolve the Student's own
   qualifying `(cohortId, learningTrackId)` pairs via a new `ChatChannelsRepository.listStudentTrackKeys()`
   — a direct Enrollment query mirroring `ChatAccessService.authorize()`'s own status set
   (`active`/`paused`/`completed`), kept in the Chat module (not imported from Cohorts/Enrollments) to
   avoid a circular module dependency (`CohortsModule` already imports `ChatModule` for
   `ChatMembershipSyncService`; the reverse would cycle).

   Verified live end-to-end: assigned a second Track to a Cohort already offering one, confirmed only
   the new Track's channel was created (not a duplicate for the already-offered one); confirmed a
   Student sees exactly `#general` plus their own Track's channel, never another Track's; confirmed a
   direct `GET`/message-post attempt against a Track channel that isn't theirs 404s identically to a
   channel that doesn't exist.
