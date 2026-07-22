import { Injectable } from '@nestjs/common';
import type { PasswordCredential } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PasswordCredentialsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<PasswordCredential | null> {
    return this.prisma.passwordCredential.findUnique({ where: { userId } });
  }

  create(userId: string, passwordHash: string): Promise<PasswordCredential> {
    return this.prisma.passwordCredential.create({ data: { userId, passwordHash } });
  }

  updateHash(userId: string, passwordHash: string): Promise<PasswordCredential> {
    return this.prisma.passwordCredential.update({
      where: { userId },
      data: { passwordHash, changedAt: new Date(), failedAttempts: 0, lockedUntil: null },
    });
  }

  recordFailedAttempt(
    userId: string,
    failedAttempts: number,
    lockedUntil: Date | null,
  ): Promise<PasswordCredential> {
    return this.prisma.passwordCredential.update({
      where: { userId },
      data: { failedAttempts, lockedUntil },
    });
  }

  resetFailedAttempts(userId: string): Promise<PasswordCredential> {
    return this.prisma.passwordCredential.update({
      where: { userId },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  }
}
