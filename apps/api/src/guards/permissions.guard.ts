import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionResolverService } from '../modules/organizations/services/permission-resolver.service';
import { AppException } from '../shared/errors/app.exception';
import type { AuthenticatedRequest } from '../shared/http/authenticated-request';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

/** Enforces tenant scope + role permissions (docs/system-architecture.md §7,
 * items 1–2). A platform SUPER_ADMIN grant bypasses the organization-header
 * requirement entirely, since that authority is not tenant-scoped. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw AppException.unauthenticated();
    }

    const isSuperAdmin = await this.permissionResolver.hasPlatformRole(
      request.user.id,
      'SUPER_ADMIN',
    );
    const organizationId = request.header('X-Organization-Id');

    if (isSuperAdmin) {
      request.organizationId = organizationId;
      return true;
    }

    if (!organizationId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'TENANT_SCOPE_DENIED',
        'X-Organization-Id is required for this endpoint.',
      );
    }

    const authorization = await this.permissionResolver.resolve(request.user.id, organizationId);
    const missing = requiredPermissions.filter((key) => !authorization.permissionKeys.has(key));
    if (missing.length > 0) {
      throw AppException.forbidden();
    }

    request.organizationId = organizationId;
    return true;
  }
}
