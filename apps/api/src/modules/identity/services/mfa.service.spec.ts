import { authenticator } from 'otplib';
import { AppConfigService } from '../../../config/app-config.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { MfaFactor, RecoveryCode } from '@prisma/client';
import type { MfaFactorsRepository, RecoveryCodesRepository } from '../repositories/mfa.repository';
import { MfaService } from './mfa.service';

const TEST_KEY = '0'.repeat(64); // 32-byte hex key

function fakeConfig(): AppConfigService {
  return { auth: { mfaEncryptionKey: TEST_KEY } } as unknown as AppConfigService;
}

function fakeMfaFactorsRepository() {
  const factors = new Map<string, MfaFactor>();
  let counter = 0;

  const repo: Partial<MfaFactorsRepository> = {
    findActiveByUserId: jest.fn(async (userId) => {
      for (const factor of factors.values()) {
        if (factor.userId === userId && !factor.disabledAt) return factor;
      }
      return null;
    }),
    findById: jest.fn(async (id) => factors.get(id) ?? null),
    create: jest.fn(async (userId, secretEncrypted) => {
      const factor = {
        id: `factor-${++counter}`,
        userId,
        type: 'totp',
        secretEncrypted,
        verifiedAt: null,
        disabledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as MfaFactor;
      factors.set(factor.id, factor);
      return factor;
    }),
    markVerified: jest.fn(async (id) => {
      const factor = factors.get(id)!;
      factor.verifiedAt = new Date();
      return factor;
    }),
    disable: jest.fn(async (id) => {
      const factor = factors.get(id)!;
      factor.disabledAt = new Date();
      return factor;
    }),
  };

  return repo as MfaFactorsRepository;
}

function fakeRecoveryCodesRepository() {
  const codes: RecoveryCode[] = [];
  let counter = 0;

  const repo: Partial<RecoveryCodesRepository> = {
    createMany: jest.fn(async (userId, mfaFactorId, hashes) => {
      for (const codeHash of hashes) {
        codes.push({
          id: `code-${++counter}`,
          userId,
          mfaFactorId,
          codeHash,
          usedAt: null,
          createdAt: new Date(),
        });
      }
      return { count: hashes.length };
    }),
    findUnusedByUserId: jest.fn(async (userId) =>
      codes.filter((c) => c.userId === userId && !c.usedAt),
    ),
    markUsed: jest.fn(async (id) => {
      const code = codes.find((c) => c.id === id)!;
      code.usedAt = new Date();
      return code;
    }),
  };

  return repo as RecoveryCodesRepository;
}

describe('MfaService', () => {
  function build() {
    return new MfaService(fakeMfaFactorsRepository(), fakeRecoveryCodesRepository(), fakeConfig());
  }

  it('enrolls a factor and verifies it with a real TOTP code', async () => {
    const service = build();
    const enrollment = await service.enroll('user-1', 'user@example.com');
    expect(enrollment.recoveryCodes).toHaveLength(8);

    const secret = new URL(
      enrollment.otpauthUri.replace('otpauth://totp/', 'https://x/'),
    ).searchParams.get('secret')!;
    const code = authenticator.generate(secret);

    await expect(
      service.verifyEnrollment('user-1', enrollment.factorId, code),
    ).resolves.toBeUndefined();
  });

  it('rejects an incorrect enrollment code', async () => {
    const service = build();
    const enrollment = await service.enroll('user-1', 'user@example.com');
    await expect(service.verifyEnrollment('user-1', enrollment.factorId, '000000')).rejects.toThrow(
      AppException,
    );
  });

  it('accepts a valid TOTP code as a login challenge once verified', async () => {
    const service = build();
    const enrollment = await service.enroll('user-1', 'user@example.com');
    const secret = new URL(
      enrollment.otpauthUri.replace('otpauth://totp/', 'https://x/'),
    ).searchParams.get('secret')!;
    await service.verifyEnrollment('user-1', enrollment.factorId, authenticator.generate(secret));

    expect(await service.isEnabled('user-1')).toBe(true);
    await expect(service.verifyChallenge('user-1', authenticator.generate(secret))).resolves.toBe(
      true,
    );
  });

  it('accepts a recovery code exactly once', async () => {
    const service = build();
    const enrollment = await service.enroll('user-1', 'user@example.com');
    const secret = new URL(
      enrollment.otpauthUri.replace('otpauth://totp/', 'https://x/'),
    ).searchParams.get('secret')!;
    await service.verifyEnrollment('user-1', enrollment.factorId, authenticator.generate(secret));

    const [recoveryCode] = enrollment.recoveryCodes;
    await expect(service.verifyChallenge('user-1', recoveryCode)).resolves.toBe(true);
    await expect(service.verifyChallenge('user-1', recoveryCode)).resolves.toBe(false);
  });

  describe('disable', () => {
    async function enrollAndVerify(service: MfaService) {
      const enrollment = await service.enroll('user-1', 'user@example.com');
      const secret = new URL(
        enrollment.otpauthUri.replace('otpauth://totp/', 'https://x/'),
      ).searchParams.get('secret')!;
      await service.verifyEnrollment('user-1', enrollment.factorId, authenticator.generate(secret));
      return { enrollment, secret };
    }

    it('disables an enabled factor given a valid current TOTP code', async () => {
      const service = build();
      const { secret } = await enrollAndVerify(service);

      await expect(
        service.disable('user-1', authenticator.generate(secret)),
      ).resolves.toBeUndefined();
      expect(await service.isEnabled('user-1')).toBe(false);
    });

    it('disables using an unused recovery code', async () => {
      const service = build();
      const { enrollment } = await enrollAndVerify(service);

      await expect(service.disable('user-1', enrollment.recoveryCodes[0])).resolves.toBeUndefined();
      expect(await service.isEnabled('user-1')).toBe(false);
    });

    it('rejects an invalid code and leaves the factor enabled', async () => {
      const service = build();
      await enrollAndVerify(service);

      await expect(service.disable('user-1', '000000')).rejects.toThrow(AppException);
      expect(await service.isEnabled('user-1')).toBe(true);
    });

    it('rejects disabling when no MFA factor is enabled', async () => {
      const service = build();
      await expect(service.disable('user-1', '000000')).rejects.toThrow(AppException);
    });
  });
});
