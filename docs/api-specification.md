# Project Forge — REST API Specification

**Status:** API contract design; no implementation  
**Base URL:** `https://api.<environment>.projectforge.example/api/v1`  
**Media type:** `application/json; charset=utf-8` (unless signed upload/download)  
**Audience:** web app, future mobile clients, approved third-party integrations

## 1. Contract principles

The API is REST/JSON, versioned in the path, tenant-scoped, policy-authorized, OpenAPI-described, and safe for browser, mobile and integration clients. `/api/v1` is backward compatible within major version: additive optional fields are allowed; breaking changes require `/api/v2` with a published migration window. All IDs are UUIDs; timestamps are ISO-8601 UTC; user-facing date/time is rendered by clients using the supplied IANA timezone.

The API is the authority for validation, tenancy and permissions. Client-supplied organization headers, routes and resource IDs must agree with an active membership. Server-generated capability values are an affordance aid, not a security boundary.

## 2. Shared request, response and security standards

### Headers

| Header | Requirement |
| --- | --- |
| `Authorization: Bearer <access-token>` | required on authenticated endpoints; access token is short-lived |
| `X-Organization-Id: <uuid>` | required for tenant-scoped endpoint unless organization is explicit in route or inferred from a global super-admin route |
| `X-Academy-Id: <uuid>` | optional active academy context; required where an ambiguous academy-scoped action is performed |
| `Idempotency-Key: <uuid>` | required for retry-sensitive creates/actions: final submission, certificate issue, invitation, payment/integration webhook operations |
| `If-Match: <version-or-etag>` | required for concurrent edits of versioned configuration/curriculum/settings where supplied by the resource |
| `X-Request-Id` | optional caller correlation ID; API always returns a request ID |

### Success envelope

```json
{
  "data": { "id": "uuid", "status": "active" },
  "meta": { "requestId": "req_01J..." }
}
```

Collection response:

```json
{
  "data": [{ "id": "uuid", "name": "Cohort 2026" }],
  "meta": {
    "requestId": "req_01J...",
    "page": { "nextCursor": "eyJ...", "previousCursor": null, "limit": 25, "hasMore": true }
  }
}
```

Mutation success is `200 OK` with resource, `201 Created` with `Location`, or `202 Accepted` with an operation/job reference for asynchronous work. `204 No Content` is used only for safe idempotent revocation/removal where no representation is useful.

### Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [{ "field": "email", "code": "INVALID_EMAIL", "message": "Enter a valid email address." }],
    "requestId": "req_01J..."
  }
}
```

| HTTP | Code examples | Meaning |
| --- | --- | --- |
| 400 | `INVALID_REQUEST`, `INVALID_STATE_TRANSITION` | malformed request or prohibited workflow state |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `MFA_REQUIRED` | missing/invalid credentials |
| 403 | `FORBIDDEN`, `TENANT_SCOPE_DENIED`, `PERMISSION_DENIED` | authenticated but policy denies action |
| 404 | `NOT_FOUND` | resource is absent or deliberately not disclosed |
| 409 | `CONFLICT`, `VERSION_CONFLICT`, `DUPLICATE`, `CAPACITY_REACHED` | incompatible concurrent/existing state |
| 410 | `GONE`, `INVITATION_EXPIRED` | expired/revoked resource |
| 413/415 | `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE` | upload/content issue |
| 422 | `VALIDATION_ERROR`, `ELIGIBILITY_NOT_MET` | syntactically valid but domain-invalid input |
| 429 | `RATE_LIMITED` | retry after `Retry-After` |
| 500/503 | `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE` | server/provider failure; includes request ID |

Errors never reveal tenant existence, password/account state, secrets, internal stack traces or sensitive audit data.

### Collections: pagination, filtering, sorting and search

All list endpoints accept `limit` (default 25, max 100), opaque `cursor`, and where meaningful `sort` (comma-separated allow-listed keys; `-` descending), `q` (trimmed, 2–120 chars, tenant-scoped), and explicit filters. Example: `GET /cohorts?status=active&academyId=<uuid>&sort=-startsAt&limit=25`. Cursor pagination is mandatory for messages, notifications, audit logs, activity, submissions and large directories. Offset/page parameters are not supported for large collections. Responses echo applied filters/sort in `meta` when useful.

### Authentication, rate and audit rules

- Browser access JWTs are short-lived Bearer tokens; rotated refresh tokens are Secure, HttpOnly, SameSite cookies. Mobile uses platform secure storage and a refresh flow approved for native clients. Third parties use scoped, expiring OAuth/service credentials only—never browser refresh cookies.
- Endpoint rate limits are enforced by identity, IP and tenant; recommended defaults: sign-in/reset 5 attempts/15 min/IP, refresh 30/min/session, read 300/min/user, write 60/min/user, uploads/action endpoints lower as risk dictates. Return `429` and `Retry-After`.
- Validate JSON shape, UUIDs, bounds, enums, URLs, MIME/file metadata and field-level permissions. Reject unknown fields on sensitive mutations; sanitize rich text.
- All authorization-sensitive, security, grade/review, enrolment, certificate, export, settings and moderation mutations produce audit events. Request IDs and idempotency keys propagate to audit/outbox records.

## 3. Common representations

These compact examples define reusable object fields. Individual endpoint examples below may omit stable metadata for clarity.

```json
{
  "user": { "id": "uuid", "displayName": "Ada Okafor", "email": "ada@example.com", "avatarUrl": null, "status": "active" },
  "page": { "id": "uuid", "createdAt": "2026-07-15T09:00:00Z", "updatedAt": "2026-07-15T09:00:00Z", "version": 1 }
}
```

Resource responses include `id`, audit timestamps, `version` when mutable, and `capabilities` where the caller may have action choices, e.g. `{ "canEdit": true, "canArchive": false }`. Sensitive properties are omitted rather than null when not authorized.

## 4. Endpoint specification

Each endpoint line supplies description, authentication/authorization, body schema/example, response example, validation, and expected success/error status. “Admin” below includes `ORG_ADMIN` or `ACADEMY_ADMIN` at matching scope; “Super” means platform `SUPER_ADMIN`; ownership/assignment rules always further constrain access.

### 4.1 Authentication and profile

| Method / path | Description, auth and permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `POST /auth/login` | start email/password sign-in; public | `{ "email":"ada@example.com","password":"…" }`; valid email, 8–128 password input | `200 {data:{accessToken:"jwt",expiresIn:900,user:{…},mfaRequired:false}}`; sets refresh cookie. `401 INVALID_CREDENTIALS`, `429` |
| `POST /auth/oidc/:provider` | begin Google/Microsoft/OIDC authorization; public | `{ "redirectUri":"https://app.../auth/callback" }`; provider allow-list, registered URI | `200 {data:{authorizationUrl:"https://..."}}`; `400 INVALID_PROVIDER` |
| `POST /auth/oidc/:provider/callback` | exchange authorization code; public | `{ "code":"…","state":"…","redirectUri":"…" }`; PKCE/state/nonce required | same login response or `401 MFA_REQUIRED`; `400 INVALID_CALLBACK` |
| `POST /auth/refresh` | rotate session and issue new access token; refresh cookie required | no body; CSRF header/origin required for browser | `200 {data:{accessToken:"jwt",expiresIn:900}}`; `401 TOKEN_EXPIRED/SESSION_REVOKED`, `429` |
| `POST /auth/logout` | revoke current session; authenticated/refresh cookie | `{ "allSessions":false }` optional | `204`; audit. `401` is idempotently treated as `204` |
| `POST /auth/forgot-password` | request reset; public, non-enumerating | `{ "email":"ada@example.com" }` | `202 {data:{message:"If an account exists…"}}`; `429` |
| `POST /auth/reset-password` | consume reset token | `{ "token":"…","newPassword":"…" }`; password policy, single-use token | `204`; revoke sessions. `400 INVALID_TOKEN`, `422 WEAK_PASSWORD` |
| `POST /auth/verify-email` | consume verification token; public | `{ "token":"…" }` | `204`; `400 INVALID_TOKEN`, `410 GONE` |
| `POST /auth/verification-email` | resend verification; authenticated or limited public flow | `{ "email":"ada@example.com" }` | `202`; non-enumerating, rate limited |
| `POST /auth/change-password` | change credential; authenticated, recent auth required | `{ "currentPassword":"…","newPassword":"…" }`; policy and current secret valid | `204`; rotates/revokes other sessions. `401 REAUTH_REQUIRED`, `422 WEAK_PASSWORD` |
| `GET /auth/sessions` | list caller sessions; authenticated | no body | `200 {data:[{id:"uuid",device:"Chrome",current:true,lastUsedAt:"…"}]}`; cursor pagination |
| `DELETE /auth/sessions/:sessionId` | revoke own session; authenticated | no body; must own session | `204`; `404` |
| `POST /auth/mfa/enroll` | begin TOTP factor enrolment; authenticated | `{ "type":"totp" }` | `201 {data:{factorId:"uuid",otpauthUri:"…",recoveryCodes:["…"]}}`; `409 MFA_ALREADY_ENABLED` |
| `POST /auth/mfa/verify` | verify MFA challenge or enrollment; authenticated/challenge token | `{ "factorId":"uuid","code":"123456" }`; 6–8 numeric chars | `200 {data:{accessToken:"jwt",mfaVerified:true}}`; `401 INVALID_MFA_CODE` |
| `GET /me` / `PATCH /me` | read/update caller profile; authenticated | PATCH `{ "displayName":"Ada", "timezone":"Africa/Lagos", "locale":"en-NG" }`; bounded/sanitized fields | `200 {data:{id:"uuid",displayName:"Ada",memberships:[…]}}`; `422`, `409` |

### 4.2 Users, roles and permissions

| Method / path | Description, auth/permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `GET /users` | scoped people directory; Admin, `user.read` | filters `role,status,academyId,q,sort`; only allowed fields returned | `200 {data:[{id:"uuid",displayName:"Ada",roles:["STUDENT"]}],meta:{page:{…}}}`; `403` |
| `GET /users/:userId` | user profile in active tenant; self or `user.read` | none | `200 {data:{user:{…},membership:{…},capabilities:{…}}}`; `403/404` |
| `POST /users/invitations` | invite a person; Admin, `membership.invite` | `{ "email":"new@example.com","roles":["MENTOR"],"academyId":"uuid" }`; valid role/scope, invite expiry | `202 {data:{invitationId:"uuid",status:"sent"}}`; `409 DUPLICATE`, `422` |
| `PATCH /users/:userId/status` | suspend/reactivate scoped membership; Admin, `membership.manage` | `{ "status":"suspended","reason":"…" }`; cannot remove last required admin | `200 {data:{membership:{status:"suspended"}}}`; `403`, `409` |
| `GET /roles` / `POST /roles` | list/create tenant custom roles; Admin, `role.read/create` | POST `{ "name":"Coordinator","key":"coordinator","permissionIds":["uuid"] }`; unique key, permitted permission set | `200` list / `201 {data:{id:"uuid",…}}`; `409`, `422` |
| `GET /roles/:roleId` / `PATCH /roles/:roleId` | role detail/update; Admin, `role.read/update` | PATCH `{ "name":"…","permissionIds":["uuid"],"version":2 }`; `If-Match`, system role restrictions | `200 {data:{id:"uuid",permissions:[…],version:3}}`; `409 VERSION_CONFLICT` |
| `DELETE /roles/:roleId` | retire custom role; Admin, `role.delete` | no body; role cannot be system/active assignment | `204`; `409 ROLE_IN_USE` |
| `GET /permissions` | permission catalogue; Admin/Super, `permission.read` | filters `resource,q` | `200 {data:[{id:"uuid",key:"submission.review",scopeCapability:"cohort"}]}` |
| `GET /users/:userId/memberships` / `PATCH /memberships/:id` | inspect/change membership roles/scope; self read or Admin; write `membership.manage` | PATCH `{ "roleIds":["uuid"],"academyId":"uuid","status":"active","version":1 }`; role/scope compatibility | `200 {data:{id:"uuid",roles:[…],version:2}}`; `403/409/422` |

### 4.3 Organizations and academies

| Method / path | Description, auth/permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `GET /organizations` | platform tenant list; Super, `organization.read` | `status,q,sort,cursor` | `200 {data:[{id:"uuid",name:"Tech Impact",status:"active"}],meta:{page:{…}}}` |
| `POST /organizations` | provision tenant; Super, `organization.create` | `{ "name":"Tech Impact Fellowship","slug":"tech-impact","defaultTimezone":"Africa/Lagos","adminEmail":"admin@example.com" }`; globally unique slug | `201 {data:{id:"uuid",status:"provisioning"}}`; `409`, `422` |
| `GET /organizations/:orgId` / `PATCH /organizations/:orgId` | tenant detail/config; Super or matching Org Admin as field policy permits | PATCH `{ "name":"…","defaultTimezone":"Africa/Lagos","version":1 }`; `If-Match` | `200 {data:{id:"uuid",…}}`; `403/409` |
| `POST /organizations/:orgId/actions/suspend` | suspend tenant; Super, `organization.suspend`, re-auth | `{ "reason":"…" }`; nonempty audited reason | `200 {data:{status:"suspended"}}`; `409` |
| `GET /academies` / `POST /academies` | list/create organization academies; Admin `academy.read/create` | POST `{ "name":"School of Technology","slug":"technology","timezone":"Africa/Lagos" }`; unique org slug | `200` list / `201 {data:{id:"uuid",…}}`; `409/422` |
| `GET /academies/:academyId` / `PATCH /academies/:academyId` | academy detail/update; matching Admin, `academy.read/update` | PATCH `{ "description":"…","status":"active","version":1 }`; `If-Match` | `200`; `403/404/409` |
| `POST /academies/:academyId/actions/archive` | archive academy; Admin, `academy.archive` | `{ "reason":"…" }`; no active delivery without explicit transition | `200 {data:{status:"archived"}}`; `409 ACTIVE_COHORTS_EXIST` |

### 4.4 Fellowships, courses and curriculum

| Method / path | Description, auth/permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `GET /fellowships` / `POST /fellowships` | list/create programmes; Student/Mentor read scoped; Admin `fellowship.create` | POST `{ "academyId":"uuid","title":"Frontend Development","slug":"frontend-dev","durationWeeks":24 }`; unique academy slug, 1–52 weeks | `200` list / `201 {data:{id:"uuid",status:"draft",version:1}}`; `422/409` |
| `GET /fellowships/:id` / `PATCH /fellowships/:id` | detail/edit draft; scoped read / Admin `fellowship.update` | PATCH `{ "summary":"…","durationWeeks":26,"version":1 }`; `If-Match` | `200`; `409 VERSION_CONFLICT` |
| `POST /fellowships/:id/actions/publish` / `retire` | publish or retire programme; Admin, `fellowship.publish` | `{ "version":2 }`; curriculum/completion policy must validate | `200 {data:{status:"published",version:3}}`; `422 CURRICULUM_INCOMPLETE` |
| `GET /fellowships/:id/courses` / `POST /fellowships/:id/courses` | ordered course list/create; scoped read / Admin `curriculum.edit` | POST `{ "title":"Web Foundations","slug":"web-foundations","sequence":1,"outcomes":["…"] }`; unique sequence/slug | `200` / `201 {data:{id:"uuid",sequence:1}}`; `409` |
| `GET /courses/:id` / `PATCH /courses/:id` / `DELETE /courses/:id` | read/update/archive course; scoped read / Admin `curriculum.edit` | PATCH `{ "title":"…","sequence":2,"version":1 }`; no cycle prerequisite | `200` / `204`; `409 PUBLISHED_VERSION_IMMUTABLE` |
| `GET /courses/:id/modules` / `POST /courses/:id/modules` | list/create module; scoped / Admin edit | POST `{ "title":"HTML & CSS","sequence":1 }`; unique course sequence | `200` / `201 {data:{id:"uuid",…}}`; `409` |
| `GET /modules/:id` / `PATCH /modules/:id` / `DELETE /modules/:id` | module detail/update/archive | PATCH `{ "title":"…","sequence":1,"version":1 }`; `If-Match` | `200` / `204`; `409` |
| `GET /modules/:id/weeks` / `POST /modules/:id/weeks` | list/create weekly unit | POST `{ "weekNumber":1,"title":"Introduction","sequence":1,"releaseRule":"cohort_start_plus_days" }`; valid release config | `200` / `201 {data:{id:"uuid",status:"draft"}}`; `422` |
| `GET /weeks/:id` / `PATCH /weeks/:id` / `DELETE /weeks/:id` | week detail/update/archive | PATCH `{ "title":"…","estimatedHours":8,"version":1 }` | `200` / `204`; `409 RELEASED_VERSION_IMMUTABLE` |
| `POST /courses/:id/actions/reorder` | atomically reorder module/week children; Admin `curriculum.edit` | `{ "items":[{"id":"uuid","sequence":1}],"version":4 }`; complete unique ordered set | `200 {data:{version:5}}`; `409/422` |
| `POST /fellowships/:id/actions/create-version` | fork published curriculum draft; Admin `curriculum.version` | `{ "name":"2027 revision" }` | `201 {data:{versionId:"uuid",status:"draft"}}`; `409` |

### 4.5 Lessons and resources

| Method / path | Description, auth/permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `GET /weeks/:id/lessons` / `POST /weeks/:id/lessons` | read released lessons/create draft lesson; learner scope / Admin edit | POST `{ "title":"Semantic HTML","sequence":1,"contentType":"article","content":"<p>…</p>","estimatedMinutes":40 }`; permitted type, sanitized content, unique sequence | `200 {data:[…]}` / `201 {data:{id:"uuid",…}}`; `403/422/409` |
| `GET /lessons/:id` / `PATCH /lessons/:id` / `DELETE /lessons/:id` | lesson workspace/update/archive | PATCH `{ "content":"…","captionsAssetId":"uuid","version":1 }`; release/publish constraints | `200` / `204`; `409` |
| `POST /lessons/:id/actions/complete` | mark current learner lesson complete; Student with active enrollment | `{ "enrollmentId":"uuid" }`; lesson released to own cohort | `200 {data:{lessonId:"uuid",status:"completed",courseProgressPercent":42}}`; `403/422` |
| `GET /weeks/:id/resources` / `POST /weeks/:id/resources` | list/create curated resource | POST `{ "title":"MDN semantics","resourceType":"article","url":"https://developer.mozilla.org/...","sequence":1 }`; valid HTTPS URL/provider or asset source | `200` / `201 {data:{id:"uuid",…}}`; `422` |
| `GET /resources/:id` / `PATCH /resources/:id` / `DELETE /resources/:id` | resource detail/update/archive | PATCH `{ "estimatedMinutes":20,"accessibilityNotes":"Transcript available","version":1 }` | `200` / `204`; `409` |
| `POST /files/uploads` / `POST /files/:id/finalize` | request direct upload/finalize ownership; authenticated, `file.upload` for scoped entity | request `{ "filename":"work.pdf","contentType":"application/pdf","size":24000,"scope":"submission" }`; MIME/size allow-list | `201 {data:{fileId:"uuid",uploadUrl:"https://…",expiresAt:"…"}}`; finalize `200 {data:{scanStatus:"pending"}}`; `413/415/422` |

### 4.6 Cohorts, enrolments, huddles and attendance

| Method / path | Description, auth/permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `GET /cohorts` / `POST /cohorts` | list/create cohort; scoped read / Admin `cohort.create` | POST `{ "fellowshipId":"uuid","name":"Cohort 2026","slug":"cohort-2026","startsAt":"2026-09-01T08:00:00Z","endsAt":"2027-02-28T17:00:00Z","timezone":"Africa/Lagos","capacity":100 }`; valid chronology/capacity | `200` / `201 {data:{id:"uuid",status:"draft"}}`; `409/422` |
| `GET /cohorts/:id` / `PATCH /cohorts/:id` | detail/update; scoped / Admin `cohort.update` | PATCH `{ "status":"enrolling","capacity":120,"version":1 }`; lifecycle and `If-Match` | `200`; `409 INVALID_STATE_TRANSITION` |
| `POST /cohorts/:id/actions/activate` / `complete` / `pause` | change delivery state; Admin matching scope | `{ "reason":"…","version":2 }`; curriculum snapshot and dates valid | `200 {data:{status:"active"}}`; `422/409` |
| `GET /cohorts/:id/enrollments` / `POST /cohorts/:id/enrollments` | list/invite or enrol learner; Mentor read assigned, Admin create | POST `{ "studentUserId":"uuid","status":"invited" }`; capacity, progression rule, learner membership | `200` / `201 {data:{id:"uuid",status:"invited"}}`; `409 CAPACITY_REACHED/ACTIVE_ENROLLMENT_EXISTS` |
| `PATCH /enrollments/:id` | update enrollment state/exception; Admin `enrollment.manage` | `{ "status":"active","reason":"approved","version":1 }`; documented exception where required | `200 {data:{id:"uuid",status:"active"}}`; `422/409` |
| `GET /cohorts/:id/mentors` / `POST /cohorts/:id/mentors` / `DELETE /cohorts/:id/mentors/:mentorId` | manage mentor assignment; Admin manage, mentor read own | POST `{ "mentorUserId":"uuid","role":"primary","capacityAllocation":25 }`; valid mentor member, no duplicate | `200` / `201` / `204`; `409` |
| `GET /cohorts/:id/huddles` / `POST /cohorts/:id/huddles` | list/schedule mentor huddle; cohort member read, Mentor/Admin create | POST `{ "title":"Weekly huddle","startsAt":"2026-09-08T17:00:00Z","endsAt":"2026-09-08T18:00:00Z","mentorUserId":"uuid","meetingType":"online" }`; assigned mentor and chronology | `200` / `201 {data:{id:"uuid",status:"scheduled"}}`; `422` |
| `GET /huddles/:id` / `PATCH /huddles/:id` / `POST /huddles/:id/actions/cancel` | huddle detail/change/cancel; cohort scoped, Mentor owner/Admin write | PATCH `{ "agenda":"…","version":1 }`; cancellation reason if after publish | `200`; cancel `200 {data:{status:"cancelled"}}`; `403/409` |
| `GET /huddles/:id/attendance` / `PUT /huddles/:id/attendance` | roster/read and upsert attendance; Mentor assigned/Admin `attendance.manage` | PUT `{ "records":[{"enrollmentId":"uuid","status":"present"}],"version":1 }`; each belongs to huddle cohort, valid statuses | `200 {data:{updated:1,records:[…]}}`; `422/409` |
| `GET /enrollments/:id/progress` | learner progress summary; own learner, assigned mentor, Admin | no body | `200 {data:{lessonCompletionPercent:42,attendancePercent:80,requiredAssignments:{approved:2,total:4}}}`; `403` |

### 4.7 Assignments, submissions and projects

| Method / path | Description, auth/permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `GET /assignments` | scoped assignments (student own cohort / mentor/admin); filters `cohortId,weekId,status,dueBefore,dueAfter` | no body | `200 {data:[{id:"uuid",title:"Landing page",dueAt:"…",submissionStatus:"draft"}],meta:{page:{…}}}`; `403` |
| `POST /weeks/:id/assignments` | create draft assignment; Admin `assignment.create` | `{ "title":"Landing page","instructions":"…","dueAt":"2026-09-12T22:00:00Z","maxAttempts":3,"rubric":{"version":1,"criteria":[{"name":"Accessibility","weight":40}]}}`; due/release/rubric weights valid | `201 {data:{id:"uuid",status:"draft",version:1}}`; `422` |
| `GET /assignments/:id` / `PATCH /assignments/:id` | view/update assignment; released scope / Admin edit | PATCH `{ "latePolicy":"allowed","version":1 }`; published changes require version policy | `200`; `409 PUBLISHED_VERSION_IMMUTABLE` |
| `POST /assignments/:id/actions/publish` / `close` | publish/close; Admin `assignment.publish` | `{ "version":1 }`; rubric/policy valid | `200 {data:{status:"published"}}`; `422` |
| `GET /assignments/:id/submissions` | review queue/list; assigned Mentor/Admin `submission.read` | filters `status,reviewerId,sort=-submittedAt,cursor` | `200 {data:[{id:"uuid",student:{…},status:"submitted"}],meta:{page:{…}}}`; `403` |
| `POST /assignments/:id/submissions` | create learner draft; Student active enrollment | `{ "enrollmentId":"uuid","text":"…","repositoryUrl":"https://github.com/org/repo","fileIds":["uuid"] }`; allowed evidence, attempt availability | `201 {data:{id:"uuid",status:"draft",attemptNumber:1}}`; `409 ATTEMPTS_EXHAUSTED` |
| `GET /submissions/:id` / `PATCH /submissions/:id` | view own/assigned submission; edit own draft only | PATCH `{ "text":"revised draft","fileIds":["uuid"],"version":1 }`; cannot edit finalized/reviewed state | `200`; `403/409` |
| `POST /submissions/:id/actions/submit` | finalize a draft; Student owner, `Idempotency-Key` | `{ "version":2 }`; permitted evidence, due/late policy, attempts | `200 {data:{id:"uuid",status:"submitted",submittedAt:"…",reviewDueAt:"…"}}`; `422/409` |
| `POST /submissions/:id/reviews` | record mentor decision; assigned Mentor/Admin `submission.review` | `{ "decision":"revision_required","rubricScores":[{"criterionId":"uuid","score":32}],"feedback":"Add alt text.","version":1 }`; actionable feedback for revision/rejection; score/rubric valid | `201 {data:{id:"uuid",status:"revision_required",review:{id:"uuid"}}}`; `403/422/409` |
| `GET /projects` / `POST /projects` | list/create learner project; own or scoped mentor/admin | POST `{ "enrollmentId":"uuid","title":"Community app","description":"…","repositoryUrl":"https://github.com/..." }`; enrollment ownership, valid URL | `200` / `201 {data:{id:"uuid",status:"draft"}}`; `422` |
| `GET /projects/:id` / `PATCH /projects/:id` | project detail/update; own/assigned/admin | PATCH `{ "status":"active","demoUrl":"https://…","version":1 }`; public needs consent | `200`; `403/409` |
| `POST /projects/:id/milestones` / `PATCH /project-milestones/:id` | add/update milestone; owner/assigned mentor/admin | POST `{ "title":"Deploy MVP","dueAt":"…","status":"pending" }`; parent scope/date | `201` / `200`; `422` |

### 4.8 Certificates, badges and achievements

| Method / path | Description, auth/permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `GET /certificates` | own certificates; mentor/admin scoped queue via filters | filters `enrollmentId,status,cohortId,cursor` | `200 {data:[{id:"uuid",status:"issued",verificationCode:"…"}],meta:{page:{…}}}` |
| `GET /certificates/:id` | certificate detail; holder, responsible staff or public policy | no body | `200 {data:{id:"uuid",status:"issued",programme:"Frontend Development",issuedAt:"…"}}`; `403/404` |
| `POST /enrollments/:id/certificates/recommend` | mentor recommendation; assigned Mentor `certificate.recommend` | `{ "note":"All required work approved." }`; eligibility/assignment scope | `201 {data:{id:"uuid",status:"pending"}}`; `422 ELIGIBILITY_NOT_MET` |
| `POST /certificates/:id/actions/issue` | approve/issue artifact; Admin `certificate.issue`, re-auth, idempotency key | `{ "version":1 }`; eligibility snapshot, recommendation, template valid | `202 {data:{id:"uuid",status:"pending_render",operationId:"uuid"}}`; `409/422` |
| `POST /certificates/:id/actions/revoke` | revoke award; Admin `certificate.revoke`, re-auth | `{ "reason":"Verified administrative error","version":2 }`; nonempty reason | `200 {data:{status:"revoked",revokedAt:"…"}}`; `409` |
| `GET /verify/:code` | public minimal certificate verification; unauthenticated, rate-limited | no body | `200 {data:{valid:true,status:"issued",learnerName:"Ada O.",fellowship:"…",issuedAt:"…"}}`; `404` for invalid code |
| `GET /badges` / `POST /badges` | list/create badge definitions; scoped read / Admin `badge.create` | POST `{ "name":"Accessibility Champion","key":"a11y-champion","criteria":{"type":"manual"} }`; unique scoped key | `200` / `201 {data:{id:"uuid",status:"active"}}`; `409` |
| `PATCH /badges/:id` / `POST /badges/:id/actions/retire` | update draft/version or retire; Admin | PATCH `{ "description":"…","version":1 }`; awarded definition semantic changes require version | `200`; `409` |
| `GET /achievements` / `POST /achievements` | list/create learner award; own read or staff; Admin/Mentor allowed policy | POST `{ "studentUserId":"uuid","badgeId":"uuid","enrollmentId":"uuid","evidence":"…" }`; criteria and scope | `200` / `201 {data:{id:"uuid",status:"awarded"}}`; `422/409` |
| `POST /achievements/:id/actions/revoke` | revoke achievement; Admin `achievement.revoke` | `{ "reason":"…" }` | `200 {data:{status:"revoked"}}`; `403` |

### 4.9 Announcements, notifications and messaging

| Method / path | Description, auth/permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `GET /announcements` / `POST /announcements` | list scoped broadcasts/create; members read / Mentor/Admin `announcement.create` | POST `{ "title":"Welcome","body":"…","audience":{"type":"cohort","id":"uuid"},"publishAt":"2026-09-01T09:00:00Z" }`; audience descendant, sanitized content | `200` / `201 {data:{id:"uuid",status:"scheduled"}}`; `403/422` |
| `GET /announcements/:id` / `PATCH /announcements/:id` | view/update draft/scheduled; audience member / author/admin | PATCH `{ "body":"…","publishAt":"…","version":1 }`; published edit policy | `200`; `403/409` |
| `POST /announcements/:id/actions/publish` / `cancel` | publish/cancel; author/admin `announcement.publish` | `{ "version":1 }`; audience valid | `200 {data:{status:"published"}}`; `409` |
| `GET /notifications` | caller notification inbox; authenticated | filters `unread,type,channel`; cursor `sort=-createdAt` | `200 {data:[{id:"uuid",type:"submission.reviewed",readAt:null,deepLink:"/…"}],meta:{page:{…}}}` |
| `POST /notifications/:id/actions/read` / `POST /notifications/actions/mark-all-read` | mark own notification(s) read; authenticated | no body / `{ "before":"2026-…" }` optional | `200 {data:{readAt:"…"}}` / `200 {data:{updated:12}}`; `404` |
| `GET /notification-preferences` / `PATCH /notification-preferences` | view/update caller channel preferences; authenticated | `{ "email":{"assignment_due":true},"whatsapp":{"optIn":true,"phone":"+234…"},"quietHours":{"start":"22:00","end":"07:00","timezone":"Africa/Lagos"} }`; consent/phone/timezone | `200 {data:{…}}`; `422` |
| `GET /conversations` / `POST /conversations` | inbox/create direct/group conversation; authenticated; policy/moderation applies | POST `{ "type":"direct","participantUserIds":["uuid"],"initialMessage":"Hello" }`; active scoped participants, direct pair unique | `200` / `201 {data:{id:"uuid",status:"active"}}`; `403/409` |
| `GET /conversations/:id` | conversation detail/participants; participant or moderator | no body | `200 {data:{id:"uuid",participants:[…],status:"active"}}`; `403/404` |
| `GET /conversations/:id/messages` | cursor message history; participant/moderator | `cursor,limit,before` | `200 {data:[{id:"uuid",body:"Hello",sentAt:"…",sender:{…}}],meta:{page:{…}}}`; `403` |
| `POST /conversations/:id/messages` | send message; active participant | `{ "body":"Hello","fileIds":["uuid"],"replyToId":null }`; body or allowed scanned attachment, length/rate/participant status | `201 {data:{id:"uuid",sentAt:"…"}}`; `403/422/429` |
| `PATCH /messages/:id` / `DELETE /messages/:id` | edit/delete-own display; author within policy / moderator | PATCH `{ "body":"Corrected text","version":1 }`; edit window, sanitized | `200` / `204`; `403/409` |
| `POST /messages/:id/reports` | report message; participant/authenticated recipient | `{ "reason":"harassment","detail":"…" }`; controlled category | `201 {data:{reportId:"uuid",status:"open"}}`; `422` |

### 4.10 Calendar and portfolios

| Method / path | Description, auth/permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `GET /calendar/events` / `POST /calendar/events` | scoped calendar range/create manual event; participant read / staff `calendar.create` | GET `start,end,cohortId,type`; POST `{ "title":"Portfolio clinic","startsAt":"2026-09-10T16:00:00Z","endsAt":"2026-09-10T17:00:00Z","timezone":"Africa/Lagos","scope":{"type":"cohort","id":"uuid"} }`; max range, chronology/scope | `200 {data:[…]}` / `201 {data:{id:"uuid",status:"scheduled"}}`; `422` |
| `GET /calendar/events/:id` / `PATCH /calendar/events/:id` / `POST /calendar/events/:id/actions/cancel` | detail/update/cancel; visible scope / creator-admin | PATCH `{ "title":"…","version":1 }`; generated event restrictions | `200`; cancel `200 {data:{status:"cancelled"}}`; `409` |
| `POST /calendar/events/:id/rsvp` | set attendance intent; event attendee | `{ "status":"going" }`; `going|maybe|declined` | `200 {data:{status:"going"}}`; `403` |
| `GET /calendar/events.ics` | export caller scoped events; authenticated | `start,end,cohortId`; max 12-month range | `200 text/calendar`; `422` |
| `GET /portfolios/me` / `PUT /portfolios/me` | get/create/update own portfolio; Student | PUT `{ "slug":"ada-okafor","headline":"Frontend Developer","visibility":"private","items":[{"projectId":"uuid"}] ,"version":1 }`; unique slug, owned/approved artifacts | `200 {data:{id:"uuid",visibility:"private",version:2}}`; `409/422` |
| `POST /portfolios/me/actions/publish` / `unpublish` | public visibility control; Student, explicit consent/re-auth policy | `{ "consent":true,"version":2 }`; consent required, public item validation | `200 {data:{visibility:"public",publishedAt:"…"}}`; `422` |
| `GET /portfolio/:organizationSlug/:slug` | public portfolio; unauthenticated | no body | `200 {data:{headline:"…",projects:[…],certificates:[…]}}`; `404` when private/unpublished |

### 4.11 Dashboards, analytics and reports

| Method / path | Description, auth/permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `GET /dashboard/student` | current learner’s prioritized dashboard; Student active enrollment | `cohortId` optional if one active; validate ownership | `200 {data:{nextAction:{type:"lesson",id:"uuid"},progress:{percent:42},nextDeadline:{…},upcomingHuddle:{…}}}`; `409 NO_ACTIVE_COHORT` |
| `GET /dashboard/mentor` | mentor review/cohort pulse; Mentor | filters `cohortId`; must be assigned | `200 {data:{reviewQueue:{count:8,overSla:1},atRiskStudents:[…],upcomingHuddles:[…]}}`; `403` |
| `GET /dashboard/admin` | academy operations dashboard; Admin | `academyId,period` | `200 {data:{cohorts:{active:3},enrollment:{…},certificateQueue:4,exceptions:[…]}}` |
| `GET /dashboard/platform` | platform health summary; Super | `period` | `200 {data:{organizations:{active:12},api:{errorRate:0.01},queues:[…]}}`; `403` |
| `GET /analytics/learning` | progress/completion analytics; Mentor/Admin scope | `cohortId,fellowshipId,start,end,groupBy=week`; bounded period | `200 {data:{series:[{label:"Week 1",completionRate:0.8}],freshAt:"…"}}`; `403` |
| `GET /analytics/engagement` | attendance/review-SLA activity; Mentor/Admin | `cohortId,start,end` | `200 {data:{attendanceRate:0.76,reviewSlaRate:0.93,table:[…]}}` |
| `GET /analytics/outcomes` | certificate/project/portfolio outcomes; Admin/Super appropriate scope | `academyId,fellowshipId,cohortId,period` | `200 {data:{eligibleCertificates:20,issuedCertificates:18}}` |
| `GET /leaderboards` / `GET /leaderboards/:id` | scoped leaderboard definitions/results; member read subject privacy | filters `cohortId,period`; results cursor | `200 {data:[{id:"uuid",name:"July progress"}]}` / `200 {data:{entries:[{rank:1,displayName:"…",score:90}]}}`; `403` |
| `POST /reports` | request export/scheduled report; Admin/Super `report.export`, re-auth for sensitive data | `{ "type":"cohort_progress","format":"csv","filters":{"cohortId":"uuid"} }`; approved type/scope/max range | `202 {data:{reportId:"uuid",status:"queued"}}`; `403/422/429` |
| `GET /reports` / `GET /reports/:id` | list own/scope report jobs and download state | filters `status,type`; cursor | `200 {data:[{id:"uuid",status:"ready",expiresAt:"…"}]}`; `403` |
| `POST /reports/:id/actions/download-url` | get short-lived signed report URL; report owner/authorized admin | no body | `200 {data:{url:"https://…",expiresAt:"…"}}`; `410 REPORT_EXPIRED` |

### 4.12 Settings and audit logs

| Method / path | Description, auth/permission | Request sample & validation | Success response / errors |
| --- | --- | --- | --- |
| `GET /settings` | resolved settings at requested scope; Admin/Super `settings.read` | `scopeType=academy&scopeId=uuid`; scope authorized | `200 {data:{values:{timezone:"Africa/Lagos",certificatePolicy:{…}},version:4}}`; `403` |
| `PATCH /settings` | write typed scoped settings; Admin/Super `settings.update`, re-auth for sensitive key | `{ "scopeType":"academy","scopeId":"uuid","values":{"timezone":"Africa/Lagos"},"version":4 }`; key schema/override policy, `If-Match` | `200 {data:{values:{…},version:5}}`; `409/422` |
| `GET /settings/integrations` | connection health/metadata; Admin/Super `integration.read` | filters `provider,status` | `200 {data:[{id:"uuid",provider:"slack",status:"connected"}]}`; secrets omitted |
| `POST /settings/integrations/:provider/connect` | initiate OAuth/provider connection; elevated Admin/Super | `{ "scopeType":"organization","scopeId":"uuid","redirectUri":"https://…" }`; registered callback | `200 {data:{authorizationUrl:"https://…"}}`; `422` |
| `DELETE /settings/integrations/:id` | disconnect integration; elevated Admin/Super, re-auth | `{ "reason":"…" }` optional | `204`; audit and queued cleanup; `403` |
| `GET /audit-logs` | immutable scoped audit search; Admin restricted scope or Super | filters `actorUserId,action,entityType,entityId,start,end,outcome`, cursor; max range | `200 {data:[{id:"uuid",occurredAt:"…",action:"certificate.issued",actor:{…},outcome:"success"}],meta:{page:{…}}}`; `403` |
| `GET /audit-logs/:id` | audit event detail; same authorization | no body | `200 {data:{id:"uuid",beforeRedacted:{…},afterRedacted:{…},requestId:"…"}}`; `404` |

## 5. Super-admin and platform operations

Super-admin users use the same resources with platform-level permissions but must never receive all tenant data by default. Platform-only routes require `SUPER_ADMIN`, re-authentication for destructive/support actions, and an audit reason.

| Method / path | Description, request and permission | Success / validation/errors |
| --- | --- | --- |
| `GET /platform/organizations/:id/health` | tenant health summary; Super `platform.health.read`; no body | `200 {data:{status:"healthy",queueLag:0,activeUsers:…}}`; tenant-safe operational details only |
| `POST /platform/support-sessions` | request time-boxed audited support access; Super `support.request`; `{ "organizationId":"uuid","reason":"…","expiresInMinutes":30 }` | `201 {data:{id:"uuid",status:"pending"}}`; valid reason, max expiry, approval policy |
| `POST /platform/support-sessions/:id/approve` / `end` | approve/end support session; separate privileged Super permission | `{ "version":1 }` / no body | `200 {data:{status:"active"}}` / `204`; all impersonation actions carry support-session ID |
| `GET /platform/feature-flags` / `PATCH /platform/feature-flags/:key` | list/update governed feature rollout; Super `feature_flag.manage` | PATCH `{ "enabled":true,"organizationIds":["uuid"],"version":1 }`; known key, rollout constraints | `200 {data:{key:"…",version:2}}`; `409/422` |

## 6. Integration API and webhooks

External integrations are opt-in, organization-scoped and adapter-backed. Public integration access uses OAuth 2.1/client credentials with least-privilege scopes such as `cohorts.read`, `calendar.write`, `reports.read`; tokens are tenant-bound, expiring, revocable, rate-limited and audited. API keys must be hashed and displayable only once if a limited legacy use case requires them.

| Method / path | Description / request | Success, authorization and validation |
| --- | --- | --- |
| `POST /integrations/webhooks` | register outbound webhook; Admin `webhook.manage`; `{ "url":"https://partner.example/hook","events":["submission.reviewed"],"secret":"…" }` | `201 {data:{id:"uuid",status:"active"}}`; HTTPS/SSRF allow-list, event allow-list, encrypted secret; `422` |
| `GET /integrations/webhooks` / `DELETE /integrations/webhooks/:id` | list/remove scoped webhook; Admin | `200` / `204`; secret never returned; audit |
| `POST /webhooks/:provider` | provider inbound callback; provider signature authentication, no browser JWT | provider-defined JSON + signature/timestamp; replay window, idempotency event ID | `202 {data:{accepted:true}}`; `401 INVALID_SIGNATURE`, `409 DUPLICATE_EVENT`, `422` |

Outbound webhook payloads use `{id,eventType,occurredAt,organizationId,data,version}`; sign raw body with HMAC timestamp signature; retry at-least-once with event ID idempotency. Supported initial events: `enrollment.created`, `huddle.updated`, `submission.submitted`, `submission.reviewed`, `certificate.issued`, `announcement.published`. No sensitive message body, credentials or private learner notes are sent unless a separately approved scope permits it.

## 7. API workflow and state guarantees

- **Submission:** create draft → update draft → idempotent submit → mentor review (`approved|revision_required|rejected`) → optional new attempt, maximum three by default. Review write requires current assignment/rubric version; feedback required for revision/rejection.
- **Certificates:** eligibility endpoint/list data is explanatory; mentor recommend → admin issue async → issued or error; revocation does not delete verification history. Eligibility requires 90% lessons, 75% huddles and approved required work unless audited exception.
- **Tenant scope:** a resource in another tenant returns `404` or `403` according to disclosure policy. Explicit route parent/resource mismatches return `404`.
- **Concurrency:** `version`/`If-Match` on mutable authoring/settings records returns `409 VERSION_CONFLICT` with current version and safe refresh instruction; no silent last-write-wins on curriculum, attendance batch, role or policy data.
- **Asynchrony:** exports, certificate rendering, large reports, notifications and integration delivery return `202` plus resource/job URL. Client polls the resource or receives a scoped notification; a failed side effect never undoes the committed business record.

## 8. Documentation, testing and change governance

The canonical machine-readable OpenAPI document is generated/maintained alongside this contract before endpoint implementation. Each operation must define request/response schemas, examples, security requirements, scope/permission, error codes, pagination/filter/sort parameters, idempotency behavior, audit event and deprecation status. CI validates OpenAPI breaking changes, generated mobile/web client compatibility, schema examples, authorization tests, contract tests, rate-limit behavior and security headers.

Changes require an ADR when they alter tenant isolation, authentication, authorization, resource semantics, state transitions, retention, public integration behavior or compatibility. Additive fields are documented before release; deprecations include replacement, announcement date and support window. This specification—not an undocumented frontend behavior—is the contract between clients and the backend.
