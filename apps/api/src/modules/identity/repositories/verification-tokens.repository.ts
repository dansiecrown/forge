import { Injectable } from '@nestjs/common';
import type { EmailVerificationToken, PasswordResetToken } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PasswordResetTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  markUsed(id: string): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }
}

@Injectable()
export class EmailVerificationTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, tokenHash: string, expiresAt: Date): Promise<EmailVerificationToken> {
    return this.prisma.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  findByTokenHash(tokenHash: string): Promise<EmailVerificationToken | null> {
    return this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  }

  markUsed(id: string): Promise<EmailVerificationToken> {
    return this.prisma.emailVerificationToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}
