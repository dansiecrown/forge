# Incident / Recovery Guide

What to do when production fails. Organized by symptom.

## API is unreachable / 5xx errors everywhere

1. Check `GET /api/v1/health` (liveness). If this fails, the process itself is down or crashing —
   check application logs (stdout/stderr on your host) for a startup error, most commonly a missing or
   invalid environment variable (`env.validation.ts` fails loudly and immediately on any invalid
   required variable — the error message names the exact variable).
2. If liveness passes but `GET /api/v1/health/ready` returns `503`, the database is unreachable —
   go to "Database is unreachable" below.
3. If both pass but requests still 5xx, check logs for the specific failing route/exception — the
   global exception filter logs every unhandled exception with a stack trace server-side (never sent to
   the client, which only sees a generic `INTERNAL_ERROR` message and a `requestId` you can correlate
   against the server log).

## Database is unreachable

1. Confirm the managed database provider's own status page/console first — this is the most common
   cause and requires no application-side action beyond waiting or escalating to the provider.
2. Confirm `DATABASE_URL` hasn't changed unexpectedly (a credential rotation, a provider maintenance
   window that changed the connection string).
3. Once the database is reachable again, `GET /api/v1/health/ready` will report `200` on its own — no
   restart is required (the liveness/readiness split exists specifically so a temporary DB outage
   doesn't require killing and restarting otherwise-healthy API instances).
4. If the outage was prolonged, verify data consistency afterward per
   `docs/runbooks/database-operations.md`'s recovery verification steps.

## Redis is unreachable

Expected to log `RedisService`/`RedisEventsService` warnings continuously — this is normal, disclosed
degraded behavior (`docs/adr/0014-fellowship-chat.md` Decision 2), not an incident requiring action on
its own. Effect: Fellowship Chat's real-time delivery stops (messages sent via REST still persist and
are visible on refresh/reconnect; they just don't arrive live via WebSocket until Redis recovers). No
other part of the application depends on Redis. Restore Redis when convenient; no data is lost in the
meantime.

## A student/mentor can't see expected content

1. **Curriculum looks stale or missing**: confirm the cohort's curriculum snapshot was synced after the
   last content edit — see `docs/runbooks/admin-operations.md`'s Curriculum Snapshot section. This is
   the single most common cause of "I edited a lesson and nothing changed."
2. **A track's chat channel doesn't appear**: confirm the track is actually offered to that student's
   cohort (`PUT /cohorts/:id/tracks`) — a track channel is only created when a track is newly offered
   through that real endpoint. If content was seeded by directly writing to the database rather than
   through this endpoint, the channel-creation side effect never fired; see
   `docs/ENGINEERING_DECISIONS.md`'s "Track chat channel membership now syncs instantly" entry for the
   exact bug this was (fixed, but the underlying lesson — direct DB writes skip application-level side
   effects — applies to any future direct-write seeding too).
3. **A student sees no applyable cohort on the public page**: confirm the cohort's status is
   `enrolling` (not `draft`, `active`, or later) — see `docs/runbooks/admin-operations.md`.

## Email

**Current state**: real SMTP delivery is configured and working (verified live this milestone — a real
send was attempted through the configured relay; it correctly rejected an intentionally-fake test
address with an SMTP-level bounce, confirming the relay itself is live and reachable, not a stub).

- **If `NODE_ENV=production` and no SMTP is configured at all**: every email (password reset, email
  verification, invitation) is only logged to the console, never delivered — `main.ts` warns loudly
  about this at boot. This must not be the production state at launch.
- **If a specific send fails** (bounced address, relay temporarily down, credentials expired): the
  triggering action (invitation, password reset request) still completes successfully — the user/
  enrollment/application record is created regardless of email delivery success (verified this
  milestone: an approval with a deliberately-invalid recipient still produced a real user and
  enrollment). The affected person simply never receives that specific email.
- **Recovery for a missed invitation**: once the email address is confirmed correct and the SMTP issue
  (if any) resolved, the affected person can use `POST /auth/forgot-password` with their email — this
  reuses the same reset-password flow and issues a fresh token/email. There is currently no dedicated
  admin "resend invitation" action; this is the practical workaround. Consider a dedicated resend action
  as post-launch backlog if this recurs often enough to be operationally annoying.
- **Never** treat a bounced email as a sign of a broken invitation/approval — check the actual
  application/enrollment/user record first (it very likely succeeded); the email is a notification
  layer, not the source of truth.

## WebSocket / Fellowship Chat issues

- **Connection refused/rejected**: check `chat.error` events client-side — `UNAUTHENTICATED` means the
  access token was missing/expired (the client should already retry with a refreshed token via the
  standard REST refresh flow, then reconnect); `RATE_LIMITED` means the per-IP connection limit
  (30/minute) or per-socket event limit (60/10s) was hit — see `docs/ENGINEERING_DECISIONS.md`'s
  Milestone 8 entry.
- **A user stops receiving live messages after their access changes** (removed from a cohort,
  suspended): expected within 30 seconds — `ChatGateway` revalidates every live subscription against
  current authorization every 30 seconds and force-unsubscribes anything no longer valid, emitting
  `chat.access.revoked`. This is not a bug if it takes up to 30 seconds; it would be a bug if access
  were never revoked.
- **Suspected cross-Fellowship message leakage**: treat as a critical security incident — this is
  exactly the isolation `chat-websocket-isolation.integration.spec.ts` and
  `chat-access.integration.spec.ts` exist to prevent, and was re-verified live this milestone (a user in
  one Fellowship's channel cannot subscribe to, read, or send to another Fellowship's channel — REST and
  WebSocket both reject it). If ever observed for real, treat it as a production-blocking regression,
  not a configuration issue.

## General incident process

1. Identify the symptom category above; follow its specific steps.
2. If the API needs to be rolled back, follow `docs/runbooks/production-deployment.md`'s Roll Back
   section.
3. If the incident involved data corruption/loss, follow `docs/runbooks/database-operations.md`'s
   recovery verification steps after any restore.
4. Record what happened, root cause, and the fix — there is no dedicated incident-log tooling in this
   codebase; use whatever the team's standard incident-tracking process is, and reference this guide's
   section by name so the next person hits the same runbook faster.
