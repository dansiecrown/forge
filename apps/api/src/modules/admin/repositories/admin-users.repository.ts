import { Injectable } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CollectionResult, type PageMeta } from '../../../shared/pagination/collection-result';

export interface ScopedUserFilter {
  organizationId: string;
  /** Confines the list to users who are either a member or an enrolled
   * student of this one Academy — set only for a restricted caller (e.g.
   * ACADEMY_ADMIN). Undefined means org-wide. */
  restrictToAcademyId?: string;
  /** Confines the list to users holding this role key anywhere in their
   * active membership (not "only this role" — a user can appear under more
   * than one role tab). Undefined means no role filter (every role). */
  roleKey?: string;
}

export interface ListScopedUsersOptions extends ScopedUserFilter {
  q?: string;
  cursor?: string;
  limit: number;
}

export type AdminUserWithRoles = User & { roleKeys: string[] };

const ROLES_INCLUDE = {
  memberships: {
    where: { status: { in: ['active', 'invited'] as const } },
    include: {
      membershipRoles: { where: { revokedAt: null }, include: { role: true } },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithMembershipRoles = Prisma.UserGetPayload<{ include: typeof ROLES_INCLUDE }>;

function toAdminUserWithRoles(user: UserWithMembershipRoles): AdminUserWithRoles {
  const { memberships, ...rest } = user;
  const roleKeys = Array.from(
    new Set(memberships.flatMap((m) => m.membershipRoles.map((mr) => mr.role.key))),
  );
  return { ...rest, roleKeys };
}

/** The User Management list/detail views need organization (and, for a
 * restricted caller, academy) scoping that `identity`'s own
 * `UsersRepository` cannot apply itself — `identity` sits upstream of
 * `organizations` in the one-directional module chain and must not depend
 * on `Membership`/`Enrollment`. `AdminModule` is the correct composition
 * point (same precedent as `AdminStatsRepository`: inject `PrismaService`
 * directly rather than invert the chain). Closes DEBT-015's "Users list is
 * platform-wide" gap. */
@Injectable()
export class AdminUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: ListScopedUsersOptions): Promise<CollectionResult<AdminUserWithRoles>> {
    const conditions: Prisma.UserWhereInput[] = [
      {
        memberships: {
          some: {
            organizationId: options.organizationId,
            status: { in: ['active', 'invited'] },
          },
        },
      },
    ];
    if (options.roleKey) {
      conditions.push({
        memberships: {
          some: {
            organizationId: options.organizationId,
            status: { in: ['active', 'invited'] },
            membershipRoles: { some: { revokedAt: null, role: { key: options.roleKey } } },
          },
        },
      });
    }
    if (options.q) {
      conditions.push({
        OR: [
          { displayName: { contains: options.q, mode: 'insensitive' } },
          { emailCanonical: { contains: options.q.toLowerCase() } },
        ],
      });
    }
    if (options.restrictToAcademyId) {
      conditions.push({
        OR: [
          {
            memberships: {
              some: {
                organizationId: options.organizationId,
                academyId: options.restrictToAcademyId,
              },
            },
          },
          {
            enrollments: {
              some: {
                organizationId: options.organizationId,
                academyId: options.restrictToAcademyId,
              },
            },
          },
        ],
      });
    }

    const rows = await this.prisma.user.findMany({
      where: { AND: conditions },
      include: ROLES_INCLUDE,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = rows.length > options.limit;
    const items = (hasMore ? rows.slice(0, options.limit) : rows).map(toAdminUserWithRoles);
    const page: PageMeta = {
      nextCursor: hasMore ? items[items.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit: options.limit,
      hasMore,
    };

    return new CollectionResult(items, page);
  }

  /** Existence check for `AdminUsersService.get()` and every mutation
   * (`suspend`/`resetMfa`/etc.) — confirms the target user is a member of
   * the organization and, for a restricted caller, of the caller's own
   * academy specifically. */
  async findScoped(userId: string, options: ScopedUserFilter): Promise<AdminUserWithRoles | null> {
    const conditions: Prisma.UserWhereInput[] = [
      { id: userId },
      {
        memberships: {
          some: {
            organizationId: options.organizationId,
            status: { in: ['active', 'invited'] },
          },
        },
      },
    ];
    if (options.restrictToAcademyId) {
      conditions.push({
        OR: [
          {
            memberships: {
              some: {
                organizationId: options.organizationId,
                academyId: options.restrictToAcademyId,
              },
            },
          },
          {
            enrollments: {
              some: {
                organizationId: options.organizationId,
                academyId: options.restrictToAcademyId,
              },
            },
          },
        ],
      });
    }
    const user = await this.prisma.user.findFirst({
      where: { AND: conditions },
      include: ROLES_INCLUDE,
    });
    return user ? toAdminUserWithRoles(user) : null;
  }
}
