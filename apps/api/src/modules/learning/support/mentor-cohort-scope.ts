import { CohortsService } from '../../cohorts/services/cohorts.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

/** Given the caller (a Mentor, or staff acting on a cohort) and a cohort id,
 * asserts the caller is either an org/academy admin (via `enrollment.manage`
 * — deliberately not `enrollment.read`, which MENTOR already holds
 * org-wide and would defeat this scoping entirely) or an actively-assigned
 * mentor of that cohort. Shared by every mentor-facing action across the
 * `learning` module and by `ProgressionService.assertCanRead` — see
 * docs/adr/0008-mentor-experience.md Decision 3. */
export async function assertMentorAssignedToCohort(
  cohortsService: CohortsService,
  membershipsService: MembershipsService,
  permissionResolver: PermissionResolverService,
  scope: TenantScope,
  callerId: string,
  cohortId: string,
): Promise<void> {
  const canManageAnyEnrollment = await permissionResolver.hasPermission(
    callerId,
    scope.organizationId,
    'enrollment.manage',
  );
  if (canManageAnyEnrollment) {
    return;
  }

  const membership = await membershipsService.getActiveMembership(scope, callerId);
  const assigned = membership
    ? await cohortsService.hasActiveMentorAssignment(cohortId, membership.id)
    : false;
  if (!assigned) {
    throw AppException.forbidden('You are not assigned to this cohort.');
  }
}
