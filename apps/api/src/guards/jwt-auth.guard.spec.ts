import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { AccessTokenService } from '../modules/identity/services/access-token.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException } from '../shared/errors/app.exception';
import type { AuthenticatedRequest } from '../shared/http/authenticated-request';
import { JwtAuthGuard } from './jwt-auth.guard';

function fakeContext(request: Partial<AuthenticatedRequest>, isPublic: boolean): ExecutionContext {
  const handler = () => undefined;
  if (isPublic) {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  }
  class FakeClass {}

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => FakeClass,
  } as unknown as ExecutionContext;
}

function buildRequest(header?: string): Partial<AuthenticatedRequest> {
  return {
    header: jest.fn((name: string) => (name === 'Authorization' ? header : undefined)) as never,
  };
}

describe('JwtAuthGuard', () => {
  it('allows a route marked @Public() without a token', () => {
    const accessTokenService = { verify: jest.fn() } as unknown as AccessTokenService;
    const guard = new JwtAuthGuard(new Reflector(), accessTokenService);
    expect(guard.canActivate(fakeContext(buildRequest(), true))).toBe(true);
    expect(accessTokenService.verify).not.toHaveBeenCalled();
  });

  it('rejects a protected route with no Authorization header', () => {
    const accessTokenService = { verify: jest.fn() } as unknown as AccessTokenService;
    const guard = new JwtAuthGuard(new Reflector(), accessTokenService);
    expect(() => guard.canActivate(fakeContext(buildRequest(), false))).toThrow(AppException);
  });

  it('rejects a malformed Authorization header (no Bearer scheme)', () => {
    const accessTokenService = { verify: jest.fn() } as unknown as AccessTokenService;
    const guard = new JwtAuthGuard(new Reflector(), accessTokenService);
    expect(() => guard.canActivate(fakeContext(buildRequest('Token abc'), false))).toThrow(
      AppException,
    );
  });

  it('attaches the authenticated user and allows the request on a valid token', () => {
    const accessTokenService = {
      verify: jest.fn(() => ({ sub: 'user-1', jti: 'jti-1', type: 'access' })),
    } as unknown as AccessTokenService;
    const guard = new JwtAuthGuard(new Reflector(), accessTokenService);
    const request = buildRequest('Bearer valid-token');

    expect(guard.canActivate(fakeContext(request, false))).toBe(true);
    expect(request.user).toEqual({ id: 'user-1' });
  });

  it('rejects an expired or invalid token', () => {
    const accessTokenService = {
      verify: jest.fn(() => {
        throw new Error('expired');
      }),
    } as unknown as AccessTokenService;
    const guard = new JwtAuthGuard(new Reflector(), accessTokenService);
    expect(() =>
      guard.canActivate(fakeContext(buildRequest('Bearer expired-token'), false)),
    ).toThrow(AppException);
  });
});
