import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { AppConfigService } from '../../../config/app-config.service';
import { decryptSecret, encryptSecret } from '../../../shared/crypto/symmetric-encryption';
import { generateOpaqueToken, hashOpaqueToken } from '../../../shared/crypto/opaque-token';
import { AppException } from '../../../shared/errors/app.exception';
import { MfaFactorsRepository, RecoveryCodesRepository } from '../repositories/mfa.repository';

const ISSUER = 'Project Forge';
const RECOVERY_CODE_COUNT = 8;

export interface MfaEnrollment {
  factorId: string;
  otpauthUri: string;
  recoveryCodes: string[];
}

@Injectable()
export class MfaService {
  constructor(
    private readonly mfaFactorsRepository: MfaFactorsRepository,
    private readonly recoveryCodesRepository: RecoveryCodesRepository,
    private readonly config: AppConfigService,
  ) {}

  async enroll(userId: string, email: string): Promise<MfaEnrollment> {
    const existing = await this.mfaFactorsRepository.findActiveByUserId(userId);
    if (existing?.verifiedAt) {
      throw AppException.conflict(
        'MFA_ALREADY_ENABLED',
        'MFA is already enabled for this account.',
      );
    }

    const secret = authenticator.generateSecret();
    const encrypted = encryptSecret(secret, this.config.auth.mfaEncryptionKey);
    const factor = await this.mfaFactorsRepository.create(userId, encrypted);
    const otpauthUri = authenticator.keyuri(email, ISSUER, secret);

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateOpaqueToken(6));
    await this.recoveryCodesRepository.createMany(
      userId,
      factor.id,
      recoveryCodes.map((code) => hashOpaqueToken(code)),
    );

    return { factorId: factor.id, otpauthUri, recoveryCodes };
  }

  async verifyEnrollment(userId: string, factorId: string, code: string): Promise<void> {
    const factor = await this.mfaFactorsRepository.findById(factorId);
    if (!factor || factor.userId !== userId) {
      throw AppException.notFound('MFA factor not found.');
    }

    const secret = decryptSecret(factor.secretEncrypted, this.config.auth.mfaEncryptionKey);
    if (!authenticator.verify({ token: code, secret })) {
      throw AppException.unauthenticated('The verification code is invalid.', 'INVALID_MFA_CODE');
    }

    await this.mfaFactorsRepository.markVerified(factorId);
  }

  /** Verifies a login-time MFA challenge against the caller's active,
   * verified factor. Accepts a TOTP code or a single-use recovery code. */
  async verifyChallenge(userId: string, code: string): Promise<boolean> {
    const factor = await this.mfaFactorsRepository.findActiveByUserId(userId);
    if (!factor || !factor.verifiedAt) {
      return false;
    }

    const secret = decryptSecret(factor.secretEncrypted, this.config.auth.mfaEncryptionKey);
    if (authenticator.verify({ token: code, secret })) {
      return true;
    }

    return this.tryConsumeRecoveryCode(userId, code);
  }

  async isEnabled(userId: string): Promise<boolean> {
    const factor = await this.mfaFactorsRepository.findActiveByUserId(userId);
    return Boolean(factor?.verifiedAt);
  }

  /** Self-service disable from Settings — requires proving current
   * possession of the factor (a valid TOTP code or an unused recovery code,
   * same acceptance rule as `verifyChallenge`) rather than trusting the
   * authenticated session alone. */
  async disable(userId: string, code: string): Promise<void> {
    const factor = await this.mfaFactorsRepository.findActiveByUserId(userId);
    if (!factor || !factor.verifiedAt) {
      throw AppException.conflict('MFA_NOT_ENABLED', 'MFA is not enabled for this account.');
    }

    const valid = await this.verifyChallenge(userId, code);
    if (!valid) {
      throw AppException.unauthenticated('The verification code is invalid.', 'INVALID_MFA_CODE');
    }

    await this.mfaFactorsRepository.disable(factor.id);
  }

  private async tryConsumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const hash = hashOpaqueToken(code.trim());
    const unused = await this.recoveryCodesRepository.findUnusedByUserId(userId);
    const match = unused.find((recoveryCode) => recoveryCode.codeHash === hash);
    if (!match) {
      return false;
    }
    await this.recoveryCodesRepository.markUsed(match.id);
    return true;
  }
}
