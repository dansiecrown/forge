import { Injectable } from '@nestjs/common';
import type { AuthSession } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CollectionResult, type PageMeta } from '../../../shared/pagination/collection-result';

export interface ListSessionsOptions {
  cursor?: string;
  limit: number;
}

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

  async listActiveForUser(
    userId: string,
    options: ListSessionsOptions,
  ): Promise<CollectionResult<AuthSession>> {
    const rows = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { issuedAt: 'desc' },
    });

    const hasMore = rows.length > options.limit;
    const items = hasMore ? rows.slice(0, options.limit) : rows;
    const page: PageMeta = {
      nextCursor: hasMore ? items[items.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit: options.limit,
      hasMore,
    };

    return new CollectionResult(items, page);
  }
}
