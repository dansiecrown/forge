import { HttpStatus } from '@nestjs/common';
import { AppException } from '../errors/app.exception';

/** Shared by every tenant-scoped controller added from Milestone 3 onward
 * (Organizations/Academies/Fellowships/Cohorts/Enrollments) — previously
 * duplicated per-controller (see RolesController), now used widely enough
 * to extract. */
export function requireOrganizationId(organizationId: string | undefined): string {
  if (!organizationId) {
    throw AppException.forbidden('An active organization is required for this action.');
  }
  return organizationId;
}

/** `If-Match` carries the caller's expected `version` for optimistic
 * concurrency, per docs/api-specification.md §2. */
export function requireIfMatchVersion(ifMatch: string | undefined): number {
  const version = Number(ifMatch);
  if (!ifMatch || !Number.isInteger(version) || version < 1) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      'INVALID_REQUEST',
      'A numeric If-Match header with the expected version is required.',
    );
  }
  return version;
}
