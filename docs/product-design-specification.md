# Project Forge — Product Design Specification

**Status:** Design handoff draft · **Audience:** product, engineering, content and operations · **Accessibility target:** WCAG 2.2 AA

## 1. Product model and information architecture

Project Forge is a fellowship operating system, not a conventional classroom LMS. The product organizes work around an **organization → academy → programme → cohort → week** hierarchy. A person enters through their current responsibility: learning (student), coaching (mentor), operating a fellowship (admin), or governing the platform (super admin).

### Global information model

| Layer | Contains | Primary owner |
| --- | --- | --- |
| Organization | settings, people, academies, audit trail | Super admin / org admin |
| Academy | programmes, cohorts, staff | Admin |
| Programme | curriculum, completion rules, versions | Admin |
| Cohort | schedule, enrolments, mentors, announcements | Admin / mentor |
| Week | lessons, resources, assignment, huddle | Mentor / student |
| Outcome | approved work, certificate, portfolio | Student / mentor / admin |

Use a single application shell: a collapsible left rail on desktop, top app bar, contextual page header, responsive content area, and optional right-hand contextual panel. The shell always exposes organization/academy switcher (when permitted), global search, create/context action, notifications, messages, help, and profile.

## 2. Sitemap and navigation

### Shared utility routes

| Route | Purpose | Audience |
| --- | --- | --- |
| `/sign-in`, `/forgot-password`, `/reset-password` | secure authentication and recovery | all |
| `/mfa`, `/mfa-recovery` | required authenticator setup / recovery | mentor, admin, student at cohort start |
| `/invite/:token`, `/onboarding` | accept invitation and establish profile | all |
| `/notifications`, `/messages`, `/calendar`, `/profile`, `/help` | cross-role utilities | authenticated users |
| `/verify/:code` | public certificate validity check | public |

### Role navigation

| Role | Primary rail | Secondary/context navigation |
| --- | --- | --- |
| Student | Home, This week, Learn, Assignments, Projects, Portfolio, Leaderboard, Calendar, Messages | programme switcher; week/module tabs; profile menu |
| Mentor | Home, Cohorts, Students, Reviews, Attendance, Announcements, Analytics, Calendar, Messages | cohort filter; student profile tabs |
| Admin | Home, Programmes, Cohorts, People, Mentors, Announcements, Certificates, Analytics, Reports | academy switcher; programme builder tabs |
| Super admin | Platform home, Organizations, Access, Configuration, Audit logs, Platform analytics | organization drill-in; impersonation only with audited approval |

### Complete authenticated sitemap

```text
Student
  Home / This week / Learn (programme > module > week > lesson) / Resources
  Assignments (list > detail > submission > feedback) / Projects
  Progress / Certificates (list > detail) / Portfolio (editor > preview > public)
  Leaderboard / Calendar / Messages (inbox > conversation) / Notifications / Profile
Mentor
  Home / Cohorts (overview > curriculum > schedule) / Students (list > learner profile)
  Reviews (queue > submission review) / Attendance / Feedback templates
  Announcements / Analytics / Calendar / Messages / Notifications / Profile
Admin
  Home / Programmes (list > detail > curriculum builder > week editor > assignment editor)
  Cohorts (list > detail > enrolments > mentor assignments > schedule)
  Students / Mentors / Announcements / Certificates (queue > issue detail)
  Analytics / Reports / Academy settings / Profile
Super admin
  Platform home / Organizations (list > detail > academy) / People & roles
  Permissions / Configuration / Integration settings / Feature flags
  Audit logs / Platform analytics / Support access / Profile
```

## 3. Core user flows

| Role | Primary flow | Completion signal |
| --- | --- | --- |
| Student | invite → MFA/profile → home → this week → lesson → mark complete → assignment → submit → feedback/revise → approved → portfolio/certificate | next meaningful action is obvious; success is confirmed in-app and by notification |
| Mentor | home → select cohort → review queue → open submission → rubric feedback → approve or request revision → notify student | queue count decreases and learner timeline records decision |
| Admin | create programme → build weeks → create cohort → assign mentors → enrol students → publish/release → monitor → approve certificates | published schedule and ownership are visibly confirmed |
| Super admin | provision organization → configure academy/admin → review access/audit → monitor platform health | changes are scoped, confirmed, and immutably audited |

Critical safeguards: destructive actions require a named confirmation; publish, grade, enrolment, certificate, and access changes state who will be affected; drafts autosave with a clear status; all timestamps display WAT with a local-time tooltip where relevant.

## 4. Page specifications

The following inventory is the design contract for every page. “Mobile” assumes a 360–430px viewport; all pages preserve a visible page title and one primary action.

### Shared pages

| Page | Purpose / target user | Layout and primary components | Actions | UX, mobile and accessibility |
| --- | --- | --- | --- | --- |
| Sign in | authenticate all users | centered credential card, SSO buttons, support link | sign in, use SSO, reset password | password manager compatible; single column; labelled fields, error summary, no account-enumeration |
| Onboarding | establish a usable profile | progress stepper: welcome, profile, timezone, MFA, consent | continue, save, exit | resume progress; one task per screen; keyboard-safe MFA code entry |
| Notification centre | triage updates | grouped timeline, unread filter, bulk mark-read | open source, mark read, manage preferences | notification must state actor/action/time; mobile is full page; live updates announced politely |
| Messages | communicate safely | conversation list + thread + details panel | compose, attach, report, archive | desktop 3 panes; mobile list then thread; report is always available, messages never rely on colour alone |
| Calendar | view time commitments | month/week toggle, agenda list, filters, event detail drawer | RSVP, join call, add to calendar | default agenda on mobile; timezone shown; events expose text date/time and accessible join target |
| Profile & settings | manage identity/preferences | profile, security, notifications, privacy tabs | edit, export data, request correction/deletion | save bar only when changed; mobile tabs become select; communicate retention consequences plainly |

### Student portal

| Page | Purpose / target user | Layout and primary components | Actions | UX, mobile and accessibility |
| --- | --- | --- | --- | --- |
| Student home | orient an active student | welcome/header, **Continue this week** hero, progress ring, next deadline, mentor note, upcoming huddle, compact activity | continue learning, view assignment, join huddle | one dominant CTA; cards reorder by urgency; mobile stacks hero first; status includes text and icon |
| This week | deliver the weekly plan | week title/status, outcome statement, sequenced checklist, resource time estimates, assignment and huddle cards | start/resume, mark complete, submit, add event | linear order reduces cognitive load; mobile uses accordion resources; completion controls have explicit labels |
| Learn / programme | navigate curriculum | progress header, module rail, week cards, lesson workspace | choose week/lesson, continue | locked/released states explain why and release date; mobile turns rail into drawer; semantic ordered sequence |
| Lesson | consume one learning unit | breadcrumb, title/meta, content canvas, resource actions, completion footer, discussion link | open resource, complete, save note | external links disclose destination; completion asks confirmation only when duration is short; video has captions/transcript |
| Resources | find curated material | searchable/filterable resource list grouped by week/type | open, save, filter | show provider, duration, difficulty, external indicator; filters in bottom sheet on mobile; accessible names include provider |
| Assignments list | manage assessment workload | tabs: due, submitted, approved; cards/table with due date and status | open, filter | overdue is text + icon, not red alone; mobile cards; status is programmatically announced |
| Assignment detail | understand and complete work | brief, requirements, rubric, examples, due panel, submission history | begin submission, ask question | rubric visible before work begins; mobile sticky Submit only when valid; headings and files are structured |
| Submission | submit evidence confidently | editor/link/file inputs, checklist, draft state, review SLA | save draft, submit, withdraw if policy allows | validation before submit; upload progress and retry; mobile avoids drag-only input; files state format/size |
| Feedback & revision | act on mentor assessment | decision banner, rubric scores, inline feedback, revision timeline, response field | acknowledge, revise/resubmit, message mentor | distinguish revision vs rejection in plain language; mobile linearises rubric; feedback is not colour-coded |
| Projects | track major practical work | project milestones, repository/demo links, mentor status | open project, update evidence | make milestone ownership/due dates visible; mobile timeline; links identify external service |
| Progress | understand trajectory | completion, attendance, approved-work cards, weekly trend, requirements checklist | inspect gap, go to next task | progress is explanatory, never punitive; mobile uses summary then charts; charts have table/text alternative |
| Certificates | obtain and validate achievement | eligibility checklist, issued certificate cards, verification status | view, copy verification link, download where enabled | clearly state missing requirement; mobile uses cards; verification code has copy confirmation |
| Portfolio | curate employability proof | portfolio health header, project cards, editor/preview/public visibility controls | add project, edit, publish/unpublish | publishing requires explicit consent; mobile editor is step-based; public/private status text is persistent |
| Leaderboard | motivate optional community progress | time-range tabs, rank rows, own position, recognition rules | change timeframe, view criteria | opt-out/privacy control; no shaming; mobile retains own position; rank changes include text alternative |

### Mentor portal

| Page | Purpose / target user | Layout and primary components | Actions | UX, mobile and accessibility |
| --- | --- | --- | --- | --- |
| Mentor home | prioritize coaching work | review SLA queue, at-risk learners, next huddle, cohort pulse, quick announcement | start review, open learner, announce | queue is ordered by SLA and due date; mobile keeps review CTA first; urgency never colour-only |
| Cohort overview | operate one assigned cohort | cohort header, learner progress, this-week plan, schedule, announcements | switch cohort, open learner, view curriculum | persistent cohort context prevents cross-cohort error; mobile filter drawer; scope is announced |
| Students list | identify learner needs | searchable table/cards with progress, attendance, latest activity, risk reason | open profile, message, filter | risk reason must be inspectable and not inferred as fact; mobile cards; sortable headers keyboard operable |
| Learner profile | coach from a complete record | summary, learning/progress, submissions, attendance, messages tabs | add private mentor note, message, review | notes are clearly private and audited; mobile tabs scroll; sensitive data minimised |
| Review queue | resolve submitted work | filter bar, priority list with SLA, assignment and learner identifiers | claim/open review, bulk assign only | avoid ambiguous bulk grading; mobile filters bottom sheet; rows provide status text |
| Submission review | give defensible feedback | work viewer, rubric panel, feedback composer, submission timeline, decision footer | approve, request revision, reject with reason | decision preview tells student impact; autosave feedback; mobile puts rubric before decision; keyboard supports rubric scoring |
| Attendance | record huddle participation | session selector, roster, attendance controls, notes, trend | mark present/late/excused, save | bulk action requires review; offline-friendly draft; mobile roster with large targets; each control labelled by student |
| Announcements | communicate cohort updates | compose panel and sent list | draft, schedule, publish | audience and channel explicit; mobile stepper; preview and accessible plain-text equivalent |
| Mentor analytics | improve coaching | cohort filters, trends, review-SLA, engagement and completion charts | inspect learner segment, export allowed view | charts link to source learners; mobile summary-first; accessible data table alternative |

### Admin portal

| Page | Purpose / target user | Layout and primary components | Actions | UX, mobile and accessibility |
| --- | --- | --- | --- | --- |
| Admin home | run academy operations | KPI summary, actions needing attention, cohort health, upcoming events | create programme/cohort, resolve queue | operational exceptions appear before vanity metrics; mobile task list first; KPIs have definitions |
| Programmes list | manage reusable curriculum | searchable table, status filters, create button | create, duplicate, archive, open | use archive not destructive delete; mobile cards; row menus have text labels |
| Programme overview | inspect curriculum status | programme header, curriculum map, versions, linked cohorts | edit curriculum, publish version | publishing describes affected cohorts; mobile map becomes list; status has text |
| Curriculum builder | structure modules/weeks | module tree, selected-week editor, release settings, validation panel | add/reorder/edit, save draft, publish | drag has keyboard alternative; version/draft state persistent; mobile uses full-screen editor |
| Week / lesson editor | author learning experience | metadata, outcomes, ordered lessons/resources, huddle, assignment link | add resource, schedule release, preview | validates missing outcomes and inaccessible links; mobile sections accordioned; rich text requires semantic headings |
| Assignment editor | author assessable practical work | brief, due time, rubric builder, grading guide, submission policy | save, preview, publish | show revision limit and 72-hour SLA; mobile multi-step; rubric rows keyboard reorderable |
| Cohorts list/detail | create and operate delivery runs | list; detail has overview, people, schedule, curriculum, activity tabs | create, edit, pause, close | status transitions explain impact; mobile tabs selector; dates always timezone-labelled |
| Enrolments | control cohort membership | applicant/enrolled table, learner details drawer | invite, approve, remove/complete | capacity and progression rule shown before changes; mobile cards; destructive action confirmation names learner |
| Mentor management | assign accountable coaches | mentor directory, capacity, specialties, cohort assignments | invite, assign, remove assignment | capacity warning prevents overload; mobile cards; role scope clearly stated |
| Student management | support learner lifecycle | searchable directory, enrolment/status filters, learner detail | invite, change status, initiate support | never expose unnecessary private data; mobile filters; changes audit-noted |
| Certificates queue | govern issuance | eligibility queue, exceptions, issued/revoked records | request/approve issuance, revoke | immutable eligibility evidence visible; mobile detail-first; revocation requires reason and warning |
| Reports & analytics | measure programme health | filterable dashboards, scheduled/export reports | filter, export, schedule | export scope/privacy warning; mobile saved views; all data visuals have tabular alternative |

### Super-admin portal

| Page | Purpose / target user | Layout and primary components | Actions | UX, mobile and accessibility |
| --- | --- | --- | --- | --- |
| Platform home | monitor multi-tenant platform | organization health, incident banner, access requests, core trends | open organization, resolve request | distinguish platform from tenant data; mobile exception list first; status messages textual |
| Organizations | provision and govern tenants | organization table and onboarding checklist; detail includes academies/admins/settings | create, suspend, configure | suspension impact warning and audit reason; mobile cards; tenant scope persistent |
| People, roles & permissions | administer access safely | people list, role matrix, effective-permission inspector | invite, assign/revoke role, review access | least privilege defaults; permission changes require confirmation; mobile role selector; matrix keyboard navigable |
| Configuration & integrations | set platform policy | grouped settings, provider connection status, test controls | edit, test, rotate where authorized | secrets never exposed; staged save/review; mobile section list; fields describe consequence |
| Audit logs | investigate critical actions | immutable filterable event table with detail drawer | filter, inspect, export if permitted | exact actor/time/scope/before-after; mobile event cards; filters fully labelled |
| Platform analytics | assess adoption/reliability | aggregate tenant-safe metrics and trends | filter, inspect aggregates | no cross-tenant personal-data leakage; mobile summary; accessible chart data |
| Support access | assist under control | request/approval history and time-boxed scope | request, approve, end session | require reason, expiry and banner; mobile detail; all actions auditable |

## 5. Key experience specifications

### Course and weekly learning

Course pages use a clear sequence: programme overview → module → released week → lesson. A current-week card always says what to do next, why it matters, estimated time, and deadline. Locked weeks show release time and no false affordance. Marking a lesson complete updates progress immediately, but network failure preserves a queued local state and explains it.

### Assessment and mentor review

Student submission states are **draft, submitted, revision required, approved, rejected**. Show submission count (`1 of 3`) and the review-by deadline. The review workspace keeps the learner work, rubric, feedback, and final decision in one place. “Request revision” requires actionable feedback; “reject” requires a reason. Both produce an in-app and configured channel notification and a timeline event.

### Certificate and portfolio

Eligibility is transparent: 90% required learning completion, 75% huddle attendance, all required work approved, plus mentor recommendation and administrator approval. Before eligibility, show the shortest path to completion. Certificate detail contains immutable credentials, QR/verification code, issue state and revocation status. Portfolio is separate from certification and asks for explicit public-publishing consent.

### Notifications, calendar and messaging

Notifications are event-based, actionable and preference-managed. High-value events: assignment due/reminder, mentor feedback, huddle changes, announcement, certificate decision, message, and security/access change. Calendar supports Google Meet/Slack/WhatsApp-linked events and ICS export. Direct messages include reporting, moderation status, retention notice, and block/escalation pathways without revealing moderator notes to participants.

## 6. Responsive strategy

| Breakpoint | Behaviour |
| --- | --- |
| Mobile, 360–767px | bottom/slide-out navigation; one-column content; sheets replace side panels; tables become labelled cards; compose/review flows are focused full pages; touch targets ≥44px |
| Tablet, 768–1023px | compact rail; two-column dashboard where useful; context panel becomes drawer; retain data tables with horizontal scroll and pinned identity column |
| Desktop, ≥1024px | collapsible rail; 12-column content grid; dashboards use 2–3 columns; review/editor pages use workspace + contextual side panel; max reading width 760px |

Never hide essential workflow status at smaller sizes. Reorder by priority, collapse secondary detail, and preserve controls in an overflow menu only when they remain discoverable and labelled.

## 7. Design system

### Foundations

| Token | Specification |
| --- | --- |
| Type | Inter (UI) with system fallback; 400 regular, 500 medium, 600 semibold, 700 bold. Use tabular figures for scores/dates. |
| Type scale | 12 caption, 14 small, 16 body, 18 body-large, 20 H5, 24 H4, 30 H3, 36 H2, 48 H1; line-height 1.5 body, 1.2 headings. |
| Colour | Ink `#172033`; muted ink `#5D687A`; canvas `#F7F8FA`; surface `#FFFFFF`; border `#E4E8EE`; brand `#315EFB`; brand-hover `#244AD3`; success `#14804A`; warning `#A15C00`; danger `#C2352B`; focus `#1C6BFF`. Validate all foreground/background pairs at AA. |
| Spacing | 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96. Default page padding 24/32 desktop and 16 mobile. |
| Shape/elevation | 8px input/button radius, 12px card radius, 16px modal radius; 1px borders preferred; soft level-1 shadow only for floating surfaces. |
| Iconography | Lucide-style 24px outline icons, 2px stroke; 16px inline; icons support labels/tooltips and never carry critical meaning alone. |

### Components

| Component | Rules |
| --- | --- |
| Buttons | Primary is the single page CTA; secondary for alternatives; tertiary/text for low emphasis; destructive is explicit. Include loading state, disabled rationale, visible focus, and 44px mobile target. |
| Cards | Purposeful grouping with title, key signal, concise action. Avoid card-within-card overload. Dashboard cards use stable heights only where scanning benefits. |
| Forms | Label above control; helper text below; validate on blur and submit; error text describes repair; required status is text, not asterisk alone; preserve values after failure. |
| Tables | sticky header where useful, clear sort state, row action menu, pagination/cursor loading, column preferences. Collapse to label-value cards on mobile. |
| Status | Use icon + text + restrained colour: Draft, Scheduled, Submitted, Revision required, Approved, Rejected, At risk, Complete. |
| Empty states | State what is absent, why, and one relevant action (e.g., “No submissions awaiting review. You’re caught up.”). Do not use empty-state art as the only explanation. |
| Loading | skeleton preserves final layout; button-level spinner preserves label; progress indicator for uploads; no indefinite blocking without retry/support path. |
| Errors | inline field errors; page-level recoverable error with retry; irreversible/server failures have reference ID and support path. Never discard user input. |

### Motion and micro-interactions

Use 120–200ms opacity/transform transitions for state change, with no gratuitous motion. Completion may use a subtle check transition; saves use a non-blocking “Saved” status; notifications enter without shifting focused content. Honour `prefers-reduced-motion` by removing motion and autoplay.

## 8. Accessibility and content standards

- Meet WCAG 2.2 AA: semantic landmarks/headings, logical tab order, visible 3:1 focus indicator, 4.5:1 normal-text contrast, 44×44px targets, and no hover-only functionality.
- Provide captions and transcript for video, text equivalent for charts, accessible names for icon buttons, and descriptive links for external content/downloads.
- Use native controls first. Dialogs trap focus, return focus on close, close with Escape, and announce their title/purpose. Toasts are polite live regions; destructive failure is assertive only when needed.
- Keep language direct and supportive: “Request revision” rather than vague status labels; write dates as “Tue, 21 Jul, 2:00 PM WAT.” Avoid deficit-oriented learner language.
- Protect privacy by default: portfolio private until consent, leaderboard opt-out, only role-relevant data visible, sensitive admin actions audited, and retention explanations available at decision points.

## 9. Handoff acceptance checklist

Before UI implementation, product must approve: navigation labels, dashboard priority rules, assessment rubric and revision copy, course release policy, certificate exception policy, notification channel preference defaults, message moderation language, and the visual direction represented by a high-fidelity design library using these tokens. Engineering should then validate each route against the page inventory, responsive rules, keyboard flows, empty/loading/error states, and tenant/role scope.
