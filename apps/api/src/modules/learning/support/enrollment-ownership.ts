import { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import type { EnrollmentEntity } from '../../cohorts/entities/enrollment.entity';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

/** Given the caller (a Student) and an enrollment id, asserts the caller
 * owns that enrollment. Shared by every self-scoped student-facing action
 * across the `learning` module (progress recording, curriculum browsing,
 * bookmarks, portfolio). */
export async function assertOwnEnrollment(
  enrollmentsService: EnrollmentsService,
  scope: TenantScope,
  enrollmentId: string,
  callerId: string,
): Promise<EnrollmentEntity> {
  const enrollment = await enrollmentsService.get(scope, enrollmentId);
  if (enrollment.userId !== callerId) {
    throw AppException.forbidden('You can only act on your own enrollment.');
  }
  return enrollment;
}
