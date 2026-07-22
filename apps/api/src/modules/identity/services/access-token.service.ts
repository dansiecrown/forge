import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../../config/app-config.service';
import { AppException } from '../../../shared/errors/app.exception';

const MFA_CHALLENGE_TTL_SECONDS = 300;

export interface AccessTokenPayload {
  sub: string;
  jti: string;
  type: 'access';
}

interface MfaChallengePayload {
  sub: string;
  jti: string;
  type: 'mfa_challenge';
}

export interface IssuedAccessToken {
  token: string;
  expiresIn: number;
}

/** Issues and verifies two distinct, non-interchangeable token kinds from
 * the same secret: full access tokens, and short-lived MFA challenge
 * tokens. The `type` claim is checked on every verification so a challenge
 * token can never be replayed as a general-purpose access token. */
@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  issue(userId: string): IssuedAccessToken {
    const expiresIn = this.config.auth.jwtAccessTtlSeconds;
    const payload: AccessTokenPayload = { sub: userId, jti: randomUUID(), type: 'access' };
    const token = this.jwtService.sign(payload, {
      secret: this.config.auth.jwtAccessSecret,
      expiresIn,
    });
    return { token, expiresIn };
  }

  verify(token: string): AccessTokenPayload {
    const payload = this.jwtService.verify<AccessTokenPayload>(token, {
      secret: this.config.auth.jwtAccessSecret,
    });
    if (payload.type !== 'access') {
      throw AppException.unauthenticated('Access token is invalid or expired.', 'TOKEN_EXPIRED');
    }
    return payload;
  }

  issueMfaChallenge(userId: string): string {
    const payload: MfaChallengePayload = { sub: userId, jti: randomUUID(), type: 'mfa_challenge' };
    return this.jwtService.sign(payload, {
      secret: this.config.auth.jwtAccessSecret,
      expiresIn: MFA_CHALLENGE_TTL_SECONDS,
    });
  }

  verifyMfaChallenge(token: string): MfaChallengePayload {
    const payload = this.jwtService.verify<MfaChallengePayload>(token, {
      secret: this.config.auth.jwtAccessSecret,
    });
    if (payload.type !== 'mfa_challenge') {
      throw AppException.unauthenticated('MFA challenge is invalid or expired.', 'MFA_REQUIRED');
    }
    return payload;
  }

  /** Reads the `type` claim without verifying the signature, so callers can
   * pick the right strict verification path (used by the dual-purpose
   * POST /auth/mfa/verify endpoint, which accepts either token kind). */
  peekType(token: string): 'access' | 'mfa_challenge' | null {
    const decoded = this.jwtService.decode<{ type?: string }>(token);
    return decoded?.type === 'access' || decoded?.type === 'mfa_challenge' ? decoded.type : null;
  }
}
