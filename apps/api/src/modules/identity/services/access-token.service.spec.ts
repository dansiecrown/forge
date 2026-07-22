import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../../config/app-config.service';
import { AppException } from '../../../shared/errors/app.exception';
import { AccessTokenService } from './access-token.service';

function fakeConfig(): AppConfigService {
  return {
    auth: { jwtAccessSecret: 'test-secret-at-least-32-characters-long', jwtAccessTtlSeconds: 900 },
  } as unknown as AppConfigService;
}

describe('AccessTokenService', () => {
  const service = new AccessTokenService(new JwtService(), fakeConfig());

  it('issues a token that verifies back to the same user id', () => {
    const { token } = service.issue('user-1');
    const payload = service.verify(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.type).toBe('access');
  });

  it('rejects a garbage token', () => {
    expect(() => service.verify('not-a-jwt')).toThrow();
  });

  it('never accepts an MFA challenge token as a full access token', () => {
    const challenge = service.issueMfaChallenge('user-1');
    expect(() => service.verify(challenge)).toThrow(AppException);
  });

  it('never accepts a full access token as an MFA challenge token', () => {
    const { token } = service.issue('user-1');
    expect(() => service.verifyMfaChallenge(token)).toThrow(AppException);
  });

  it('round-trips an MFA challenge token', () => {
    const challenge = service.issueMfaChallenge('user-1');
    const payload = service.verifyMfaChallenge(challenge);
    expect(payload.sub).toBe('user-1');
  });

  it('peekType distinguishes access vs challenge tokens without throwing', () => {
    const access = service.issue('user-1').token;
    const challenge = service.issueMfaChallenge('user-1');
    expect(service.peekType(access)).toBe('access');
    expect(service.peekType(challenge)).toBe('mfa_challenge');
    expect(service.peekType('garbage')).toBeNull();
  });
});
