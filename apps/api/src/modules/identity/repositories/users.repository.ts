import { Injectable } from '@nestjs/common';
import type { User, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CollectionResult, type PageMeta } from '../../../shared/pagination/collection-result';

export interface CreateUserInput {
  emailCanonical: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  locale?: string;
  timezone?: string;
  /** Admin-set at creation, or self-set later from Settings — see
   * docs/adr/0009-administration-platform.md's addendum. */
  username?: string;
  status?: UserStatus;
  emailVerifiedAt?: Date;
}

export interface ListUsersOptions {
  cursor?: string;
  limit: number;
  q?: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(emailCanonical: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { emailCanonical: emailCanonical.toLowerCase() } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Batch lookup for the Mentor Portal's cohort roster — avoids an N+1
   * query when rendering a list of enrollments' student names/emails. */
  findByIds(ids: string[]): Promise<User[]> {
    return this.prisma.user.findMany({ where: { id: { in: ids } } });
  }

  create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        emailCanonical: input.emailCanonical.toLowerCase(),
        displayName: input.displayName,
        givenName: input.givenName,
        familyName: input.familyName,
        locale: input.locale ?? 'en-NG',
        timezone: input.timezone ?? 'Africa/Lagos',
        username: input.username,
        status: input.status,
        emailVerifiedAt: input.emailVerifiedAt,
      },
    });
  }

  update(
    id: string,
    data: Partial<
      Pick<
        User,
        | 'displayName'
        | 'givenName'
        | 'familyName'
        | 'locale'
        | 'timezone'
        | 'status'
        | 'emailVerifiedAt'
        | 'lastLoginAt'
        | 'username'
      >
    >,
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async list(options: ListUsersOptions): Promise<CollectionResult<User>> {
    const where = options.q
      ? {
          OR: [
            { displayName: { contains: options.q, mode: 'insensitive' as const } },
            { emailCanonical: { contains: options.q.toLowerCase() } },
          ],
        }
      : {};

    const rows = await this.prisma.user.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
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
