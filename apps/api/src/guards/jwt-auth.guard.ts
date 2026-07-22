import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenService } from '../modules/identity/services/access-token.service';
import { AppException } from '../shared/errors/app.exception';
import type { AuthenticatedRequest } from '../shared/http/authenticated-request';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenService: AccessTokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationHeader = request.header('Authorization');
    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      throw AppException.unauthenticated();
    }

    try {
      const payload = this.accessTokenService.verify(token);
      request.user = { id: payload.sub };
      return true;
    } catch {
      throw AppException.unauthenticated('Access token is invalid or expired.', 'TOKEN_EXPIRED');
    }
  }
}

function extractBearerToken(header?: string): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
}
