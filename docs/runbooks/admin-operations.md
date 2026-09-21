# Admin Operations Guide

How an Organization Admin or Academy Admin operates Project Forge day-to-day. All actions below go
through the real, existing admin UI/API — nothing here requires direct database access.

## The hierarchy

```
Organization → Academy → Fellowship → Cohort → Enrollment (student) / CohortMentor (mentor)
                                    ↳ LearningTrack → Course → WeeklyModule → Lesson / LearningResource / PracticalTask
```

- **Organization** is the tenant boundary (provisioned by a Super Admin only — no self-service signup).
- **Academy** is a division within an organization (e.g. "Ota Doyen Leo Club").
- **Fellowship** is a named program (e.g. "Tech Impact Fellowship") — reusable across multiple cohorts.
- **Cohort** is one time-bounded run of a Fellowship, with its own dates, capacity, and offered tracks.
- **LearningTrack/Course/WeeklyModule/Lesson/LearningResource/PracticalTask** is the curriculum a
  Fellowship owns; a Cohort's `curriculumSnapshot` freezes a copy of whichever tracks it currently
  offers at sync time — see "Curriculum snapshot" below.

Navigate the hierarchy from the admin sidebar: Organizations → (an org) → Academies → (an academy) →
Fellowships → (a fellowship) → Cohorts. Each level's detail page lists and links to its children.

## Marking a Fellowship/Academy public (required for public applications)

`GET /public/fellowships` (the page a prospect sees) only lists a Fellowship when **all** of: the
Fellowship itself has `isPublic: true` and `status: published`, its Academy has `isPublic: true` and
`status: active`, and its Organization has `status: active`. Set these from the Fellowship/Academy
detail pages' settings — a Fellowship an admin forgot to mark public will never appear to a prospect,
with no error shown anywhere (this is by design — an unpublished Fellowship is simply invisible, not an
error state).

**A Cohort only appears as applyable while its status is `enrolling`** — `draft` (not yet ready),
`active` (already running, not accepting new applicants), `paused`, `completed`, and `archived` cohorts
are all correctly excluded from the public catalog. This is enforced identically by both the public
catalog listing and the actual application-submission check
(`CohortApplicationsRepository.findApplyableCohort()`), so there is exactly one place this rule lives.
The Cohort lifecycle only moves forward (`draft → enrolling → active → paused/completed → archived`) —
there is no "reopen for enrollment" action once a Cohort has gone `active`; if you need to keep a Cohort
open for late applicants, keep it in `enrolling` until you deliberately activate it via
`POST /cohorts/:id/actions/activate`.

## Reviewing applications

Admin → Fellowship → Cohort → Applications (or `/admin/cohort-applications` directly) lists every
application for cohorts within your scope. An **Academy Admin sees only applications for cohorts under
their own academy; an Organization Admin sees the whole organization; a Super Admin sees everything.**

- **Search/filter**: by status, by a free-text query (name/email), by fellowship.
- **Inspect**: click into an application to see the full prospect/applicant detail, requested track, and
  any note they included.
- **Approve**: creates (or reuses) the applicant's account, adds their organization membership, creates
  their enrollment in the requested cohort, and applies their requested learning track — all in one
  action. Sends the standard invitation email to a brand-new applicant (reusing the existing
  invite/reset-password flow, not a separate email template). If the applicant already has an account
  (e.g. a returning student applying to a new cohort), no duplicate invite is sent.
- **Reject**: requires a reason; the application moves to `rejected` and stays visible in history. No
  email is sent on rejection (a disclosed choice — see `docs/adr/0010-cohort-applications.md`).
- **Bulk approve/reject**: select multiple applications and act on all of them in one request. Each item
  is checked and reported independently — one already-stale or already-processed item never blocks the
  rest of the batch.
- **Duplicate processing is prevented** by optimistic concurrency (each application carries a `version`;
  approving/rejecting requires the version you last saw, so acting on stale data — e.g. two admins
  processing the same application at once — fails cleanly with a version-conflict error rather than
  double-processing).

An applicant who already has an active enrollment elsewhere, or whose target cohort has reached
capacity, surfaces as a specific conflict at *approval* time (not at submission time) — there is no
seats-remaining display on the public form itself; this is a disclosed, existing limitation.

## Managing Cohort 1 (and future cohorts)

1. Create the Cohort under the Fellowship (name, dates, capacity, timezone).
2. Offer Learning Tracks to it (`PUT /cohorts/:id/tracks` with the track ID list) — this is what makes a
   track selectable by enrolled students, and auto-creates that track's Fellowship Chat channel.
3. Once tracks are offered, sync the curriculum snapshot (`POST /cohorts/:id/actions/sync-curriculum`) —
   **required** before students see any content; see "Curriculum snapshot" below.
4. Set the cohort's status to `enrolling` when ready for public/self-service applications, `active` once
   it starts (closing new applications), `paused`/`completed`/`archived` as it progresses.
5. Assign mentors (`POST /cohorts/:id/mentors`) — a mentor assignment is Cohort-wide, not per-track (a
   mentor sees every track's students/submissions within their assigned cohort).

## Curriculum snapshot — the one thing that must not be forgotten

**Students read exclusively from `Cohort.curriculumSnapshot`, never the live catalog tables.** If you
edit a lesson, add a week, or change a task's instructions on the live `LearningTrack`/`Course`/etc.
tables, **nothing changes for students already in a cohort until an admin explicitly re-syncs**
(`POST /cohorts/:id/actions/sync-curriculum`). This is deliberate — see
`docs/adr/0006-curriculum-learning-engine.md` Decision 1 — a running cohort's curriculum must not shift
under students mid-course just because someone edited a template elsewhere. Sync deliberately, when you
mean to publish a real content update to that specific cohort — never as an accidental side effect of
an unrelated admin action (nothing else in the codebase triggers a sync automatically except cohort
creation itself).

## Managing mentors

Assign via the Cohort's Mentors tab or `POST /cohorts/:id/mentors` (pass a Membership ID, not a raw user
ID — the mentor must already hold an academy/org membership). Unassign via
`DELETE /cohorts/:id/mentors/:mentorMembershipId`. A mentor's Fellowship Chat access and review-queue
visibility both derive live from this assignment — removing it takes effect immediately, no separate
cleanup step needed.

## Authorization boundaries (verified this milestone)

- An Academy Admin's application queue, cohort list, and every other academy-scoped admin view are
  filtered to their own academy — confirmed via existing tests
  (`tenant-isolation.integration.spec.ts`) and a live cross-organization access attempt this milestone
  (a different organization's admin, given a foreign organization's `X-Organization-Id`, was rejected
  with `403 PERMISSION_DENIED` before reaching any cohort/application-scoping logic).
- Super Admin retains unconditional global access to every organization, academy, fellowship, cohort,
  and application — by design, not an oversight.
