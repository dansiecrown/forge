# Mentor Onboarding Guide

How a mentor gets access to their assigned Fellowship/Cohort and does their job in Project Forge.

## 1. Account creation

A mentor's account is created the same way any staff account is: an admin invites them
(`POST /users/invitations`) with the `MENTOR` role granted at the appropriate organization/academy
scope. They receive the standard invitation email and set their password via `/reset-password`, same
activation flow as a student (see `docs/runbooks/student-onboarding.md` step 3).

## 2. Cohort assignment

An admin assigns the mentor to a Cohort (`docs/runbooks/admin-operations.md`'s "Managing mentors"
section). This is a **Cohort-wide** assignment — a mentor sees every track's students and submissions
within their assigned cohort, not one track specifically (there is no per-track mentor scoping in the
current data model; see `docs/KNOWN_TECHNICAL_DEBT.md` if this becomes a real requirement).

## 3. Login and mentor dashboard

Signing in lands a mentor on their own dashboard (`/mentor`): assigned cohorts, at-a-glance student
counts, and a pending-review queue.

## 4. Reviewing students and submissions

- **Cohort roster**: `GET /mentors/cohorts/:cohortId/students` lists every student in an assigned
  cohort, with progress summaries.
- **Individual student workspace**: `GET /mentors/students/:enrollmentId/workspace` — full progress,
  submission history, and (where enabled) private mentor notes for one student.
- **Review queue**: `GET /mentors/me/review-queue` lists every submission awaiting review across all of
  a mentor's assigned cohorts.
- **Approve or request revision**: `POST /practical-task-submissions/:id/actions/approve` or
  `.../actions/request-revision` (revision requires a comment). Both were verified live this milestone
  in a full cycle: a mentor requested a revision with feedback, the student saw the request and
  resubmitted, and the mentor then approved the resubmission — the full review history (both decisions)
  is preserved, never overwritten (`SubmissionReview` is append-only).

## 5. Huddles and attendance

Where enabled for a cohort, mentors can schedule huddles and record attendance from the Cohort
workspace — see the Mentor Experience ADR (`docs/adr/0008-mentor-experience.md`) for the full feature
scope.

## 6. Fellowship Chat

A mentor with an active cohort assignment gets Fellowship Chat access automatically — every track
channel in that Fellowship (not scoped to one track, matching the Cohort-wide assignment model), plus
the ability to create additional channels (not rename/archive — that remains admin-only). Access is
computed live from the assignment; unassigning a mentor removes chat access immediately, no separate
cleanup step.

## 7. Profile/settings

Same Settings surface as any account — display name, password, MFA.

## What a mentor cannot do (verified)

- Access a cohort, fellowship, academy, or organization they are not assigned to — confirmed via
  existing tenant-isolation tests and this milestone's live cross-organization access attempt (rejected
  with `403` before reaching any cohort-scoped logic).
- Approve/reject cohort applications, manage organization hierarchy, or perform any admin-only action —
  gated by `learning.review.manage`/mentor-specific permissions distinct from
  `cohort.application.manage` and organization-management permissions.
