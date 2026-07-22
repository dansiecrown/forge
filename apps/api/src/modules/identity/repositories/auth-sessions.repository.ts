import { Injectable } from '@nestjs/common';
import type { AuthSession } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface CreateSessionInput {
  userId: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  deviceLabel?: string;
  ipHash?: string;
  mfaVerifiedAt?: Date;
}

@Injectable()
export class AuthSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateSessionInput): Promise<AuthSession> {
    return this.prisma.authSession.create({ data: input });
  }

  findByRefreshTokenHash(refreshTokenHash: string): Promise<AuthSession | null> {
    return this.prisma.authSession.findFirst({ where: { refreshTokenHash } });
  }

  findById(id: string): Promise<AuthSession | null> {
    return this.prisma.authSession.findUnique({ where: { id } });
  }

  revoke(id: string, replacedBySessionId?: string): Promise<AuthSession> {
    return this.prisma.authSession.update({
      where: { id },
      data: { revokedAt: new Date(), replacedBySessionId },
    });
  }

  revokeFamily(familyId: string): Promise<{ count: number }> {
    return this.prisma.authSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForUser(userId: string): Promise<{ count: number }> {
    return this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  listActiveForUser(userId: string): Promise<AuthSession[]> {
    return this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
