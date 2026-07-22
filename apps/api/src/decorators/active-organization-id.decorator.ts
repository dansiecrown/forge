import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../shared/http/authenticated-request';

/** Reads the organization id resolved by PermissionsGuard (from
 * `X-Organization-Id`). Only populated on routes that declare
 * `@RequirePermissions(...)`. */
export const ActiveOrganizationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.organizationId;
  },
);
