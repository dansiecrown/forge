import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { PermissionResolverService } from '../modules/organizations/services/permission-resolver.service';
import { AppException } from '../shared/errors/app.exception';
import type { AuthenticatedRequest } from '../shared/http/authenticated-request';
import { PermissionsGuard } from './permissions.guard';

function fakeContext(
  request: Partial<AuthenticatedRequest>,
  requiredPermissions?: string[],
): ExecutionContext {
  const handler = () => undefined;
  if (requiredPermissions) {
    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, requiredPermissions, handler);
  }
  class FakeClass {}

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => FakeClass,
  } as unknown as ExecutionContext;
}

function buildRequest(
  userId: string | undefined,
  organizationId?: string,
): Partial<AuthenticatedRequest> {
  return {
    user: userId ? { id: userId } : undefined,
    header: jest.fn((name: string) =>
      name === 'X-Organization-Id' ? organizationId : undefined,
    ) as never,
  };
}

describe('PermissionsGuard', () => {
  it('passes through routes with no @RequirePermissions metadata', async () => {
    const resolver = {
      hasPlatformRole: jest.fn(),
      resolve: jest.fn(),
    } as unknown as PermissionResolverService;
    const guard = new PermissionsGuard(new Reflector(), resolver);
    await expect(guard.canActivate(fakeContext(buildRequest('user-1')))).resolves.toBe(true);
    expect(resolver.hasPlatformRole).not.toHaveBeenCalled();
  });

  it('requires authentication before checking permissions', async () => {
    const resolver = {
      hasPlatformRole: jest.fn(),
      resolve: jest.fn(),
    } as unknown as PermissionResolverService;
    const guard = new PermissionsGuard(new Reflector(), resolver);
    await expect(
      guard.canActivate(fakeContext(buildRequest(undefined), ['role.read'])),
    ).rejects.toThrow(AppException);
  });

  it('a platform SUPER_ADMIN bypasses the X-Organization-Id requirement entirely', async () => {
    const resolver = {
      hasPlatformRole: jest.fn(async () => true),
      resolve: jest.fn(),
    } as unknown as PermissionResolverService;
    const guard = new PermissionsGuard(new Reflector(), resolver);
    const request = buildRequest('super-admin'); // no organization header
    await expect(guard.canActivate(fakeContext(request, ['role.delete']))).resolves.toBe(true);
  });

  it('requires X-Organization-Id for a non-super-admin caller', async () => {
    const resolver = {
      hasPlatformRole: jest.fn(async () => false),
      resolve: jest.fn(),
    } as unknown as PermissionResolverService;
    const guard = new PermissionsGuard(new Reflector(), resolver);
    await expect(
      guard.canActivate(fakeContext(buildRequest('user-1'), ['role.read'])),
    ).rejects.toThrow(AppException);
  });

  it('denies when the resolved permission set is missing a required key', async () => {
    const resolver = {
      hasPlatformRole: jest.fn(async () => false),
      resolve: jest.fn(async () => ({
        organizationId: 'org-1',
        permissionKeys: new Set(['role.read']),
        isSuperAdmin: false,
      })),
    } as unknown as PermissionResolverService;
    const guard = new PermissionsGuard(new Reflector(), resolver);
    const request = buildRequest('user-1', 'org-1');
    await expect(guard.canActivate(fakeContext(request, ['role.delete']))).rejects.toThrow(
      AppException,
    );
  });

  it('allows and records the active organization id when every required permission is granted', async () => {
    const resolver = {
      hasPlatformRole: jest.fn(async () => false),
      resolve: jest.fn(async () => ({
        organizationId: 'org-1',
        permissionKeys: new Set(['role.read', 'role.delete']),
        isSuperAdmin: false,
      })),
    } as unknown as PermissionResolverService;
    const guard = new PermissionsGuard(new Reflector(), resolver);
    const request = buildRequest('user-1', 'org-1');

    await expect(
      guard.canActivate(fakeContext(request, ['role.read', 'role.delete'])),
    ).resolves.toBe(true);
    expect(request.organizationId).toBe('org-1');
  });
});
