import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';

/** Declares the permission keys PermissionsGuard must find (all of them)
 * in the caller's resolved capability set for the active organization,
 * e.g. `@RequirePermissions('role.read')`. A platform SUPER_ADMIN grant
 * always satisfies this check. */
export const RequirePermissions = (...permissionKeys: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissionKeys);
