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

  /** Upsert, not update: an invited user has no credential row yet when they
   * set their initial password through the reset-password flow (see
   * docs/adr/0003-identity-and-access-control-foundation.md — invitations
   * reuse this endpoint rather than a dedicated accept-invitation route). A
   * plain `update` would 500 with "record not found" for that case. */
  updateHash(userId: string, passwordHash: string): Promise<PasswordCredential> {
    return this.prisma.passwordCredential.upsert({
      where: { userId },
      create: { userId, passwordHash },
      update: { passwordHash, changedAt: new Date(), failedAttempts: 0, lockedUntil: null },
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
