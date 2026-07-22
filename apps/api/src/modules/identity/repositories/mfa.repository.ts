import { Injectable } from '@nestjs/common';
import type { MfaFactor, RecoveryCode } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class MfaFactorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveByUserId(userId: string): Promise<MfaFactor | null> {
    return this.prisma.mfaFactor.findFirst({
      where: { userId, disabledAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<MfaFactor | null> {
    return this.prisma.mfaFactor.findUnique({ where: { id } });
  }

  create(userId: string, secretEncrypted: string): Promise<MfaFactor> {
    return this.prisma.mfaFactor.create({ data: { userId, secretEncrypted } });
  }

  markVerified(id: string): Promise<MfaFactor> {
    return this.prisma.mfaFactor.update({ where: { id }, data: { verifiedAt: new Date() } });
  }

  disable(id: string): Promise<MfaFactor> {
    return this.prisma.mfaFactor.update({ where: { id }, data: { disabledAt: new Date() } });
  }
}

@Injectable()
export class RecoveryCodesRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMany(
    userId: string,
    mfaFactorId: string,
    codeHashes: string[],
  ): Promise<{ count: number }> {
    return this.prisma.recoveryCode.createMany({
      data: codeHashes.map((codeHash) => ({ userId, mfaFactorId, codeHash })),
    });
  }

  findUnusedByUserId(userId: string): Promise<RecoveryCode[]> {
    return this.prisma.recoveryCode.findMany({ where: { userId, usedAt: null } });
  }

  markUsed(id: string): Promise<RecoveryCode> {
    return this.prisma.recoveryCode.update({ where: { id }, data: { usedAt: new Date() } });
  }
}
