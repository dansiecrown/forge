import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../errors/app.exception';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotentReplay<T> = { replayed: true; body: T } | { replayed: false };

/** Backs `Idempotency-Key` handling for retry-sensitive mutations per
 * docs/api-specification.md §2. Deliberately scoped to being called
 * explicitly from the one or two endpoints that need it (currently
 * `POST /users/invitations`), not a generic interceptor applied everywhere —
 * see docs/adr/0003. */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  hashRequest(body: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(body ?? {}))
      .digest('hex');
  }

  /** Returns the stored response if this key was already used for an
   * identical request on this route. Throws a conflict if the same key was
   * reused with a different payload. */
  async checkReplay<T>(
    key: string,
    route: string,
    requestHash: string,
  ): Promise<IdempotentReplay<T>> {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key_route: { key, route } },
    });

    if (!existing) {
      return { replayed: false };
    }

    if (existing.requestHash !== requestHash) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was already used for a different request.',
      );
    }

    return { replayed: true, body: existing.responseBody as T };
  }

  async record(
    key: string,
    route: string,
    requestHash: string,
    status: number,
    body: unknown,
  ): Promise<void> {
    await this.prisma.idempotencyKey.create({
      data: {
        key,
        route,
        requestHash,
        responseStatus: status,
        responseBody: body as never,
        expiresAt: new Date(Date.now() + DEFAULT_TTL_MS),
      },
    });
  }
}
