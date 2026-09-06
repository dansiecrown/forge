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
