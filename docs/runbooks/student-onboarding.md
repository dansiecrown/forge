# Student Onboarding Guide

How an accepted applicant becomes an active student in Project Forge, end to end. Verified live this
milestone (see the Milestone 9 completion report for the exact test run).

## 1. Apply

A prospect visits the public Tech Impact Fellowship page (`/fellowship/index.html`), reviews the
fellowship description and available tracks, and submits the application form: name, email, chosen
cohort, chosen learning track, optional note. This calls `POST /public/cohort-applications` directly —
no account exists yet.

An already-registered student (applying to a *new* cohort while already active in the platform) uses
the authenticated self-service path instead (`POST /cohort-applications`, requires being signed in) —
same underlying rule for which cohorts are applyable, same review process.

## 2. Admin review

An admin reviews the application (see `docs/runbooks/admin-operations.md`) and approves it. Approval:

- Creates the student's `User` account (if they don't already have one) and sends an invitation email
  with a password-set link (reusing the standard invite/reset-password flow).
- Adds their organization membership.
- Creates their enrollment in the requested cohort.
- Applies their requested learning track to that enrollment.

All in one action, all-or-nothing per application (a partial failure is safely retryable — see
`docs/adr/0010-cohort-applications.md` Decision 2).

## 3. Account activation

The student receives the invitation email and follows its link to `/reset-password`, sets their own
password, and is now able to sign in. **If the invitation email fails to deliver** (bounced address, a
provider-side rejection), see `docs/runbooks/incident-recovery.md`'s Email section — there is currently
no dedicated "resend invitation" action; the practical recovery path is `POST /auth/forgot-password`
once the email address is corrected.

## 4. Login and dashboard

Signing in at `/sign-in` lands the student on their dashboard, which shows: their current
Fellowship/Cohort, enrolled track (once selected — see next step), overall progress, current/next
lesson, completed lessons, pending tasks, and recent activity.

## 5. Track selection

If the student's application didn't pre-select a track (or an admin left it unset), the student picks
one from the dashboard on first login (`POST /enrollments/:id/actions/select-track`) — the platform
does not force a track choice at approval time by default.

## 6. Weekly curriculum, lessons, resources, tasks

The student navigates Week 1 → its lessons/resources/practical tasks. Module unlock is purely
sequential-completion-based (never date-gated) — a module unlocks once the previous one's required
lessons are completed, required resources acknowledged, and (if the module requires practical work)
its tasks submitted. Lesson completion, resource acknowledgment, and task submission/progress are all
persisted server-side and survive logout/refresh — verified this milestone via a full
submit → revision-requested → resubmit → approved cycle that correctly persisted through every step.

## 7. Fellowship Chat

The student's assigned track's chat channel (plus the Fellowship's `#general` channel) becomes visible
automatically the moment their track is selected — no separate "join channel" step. See
`docs/runbooks/incident-recovery.md` if a channel doesn't appear as expected.

## 8. Profile/settings, logout, re-login

Standard account settings (display name, password, MFA enrollment) live under Settings. Logout revokes
the current session; re-login resumes exactly where progress left off — nothing is lost or re-computed
differently, since progress lives in the database, not client state.

## What a student cannot do (verified)

- See another student's private profile/progress data.
- See another Fellowship's or another Organization's content, chat channels, or messages — this
  isolation is enforced server-side (see `docs/adr/0014-fellowship-chat.md` and the cross-tenant
  integration tests) and re-verified live this milestone.
- See a cohort/track they aren't enrolled in.
- Access mentor or admin-only actions (submission approval, application review, org administration).
