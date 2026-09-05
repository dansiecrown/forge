import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { AppException } from '../../../shared/errors/app.exception';

const SUPER_ADMIN_ROLE_KEY = 'SUPER_ADMIN';

/** Shared by every `AdminModule` service that needs the platform-wide
 * (cross-organization) view — mirrors `OrganizationsService`'s private
 * `assertPlatformSuperAdmin` helper, extracted since several new services
 * (Dashboard, Audit, Settings) all need the identical check. */
export async function assertPlatformSuperAdmin(
  permissionResolver: PermissionResolverService,
  callerId: string,
): Promise<void> {
  const isSuperAdmin = await permissionResolver.hasPlatformRole(callerId, SUPER_ADMIN_ROLE_KEY);
  if (!isSuperAdmin) {
    throw AppException.forbidden('This action requires platform Super Admin authority.');
  }
}
