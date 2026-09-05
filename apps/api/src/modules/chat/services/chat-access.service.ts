import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface FellowshipChatFellowship {
  id: string;
  organizationId: string;
  academyId: string;
  title: string;
}

export interface FellowshipChatAuthorization {
  allowed: boolean;
  fellowship: FellowshipChatFellowship | null;
  /** True only for a Super Admin, an Org Admin, or an Academy Admin whose
   * academy owns this fellowship — never for a mentor or student, and never
   * for an Academy Admin scoped to a *different* academy. */
  canManageChannels: boolean;
  canModerate: boolean;
}

/** The single source of truth for "may this user access Fellowship X's
 * chat, and at what capability" — called from both the REST controllers and
 * the WebSocket gateway so the two can never drift apart. See
 * docs/adr/0014-fellowship-chat.md Decision 1.
 *
 * There is no FellowshipMembership table. Access is derived from whichever
 * of the existing relationships actually establishes it:
 *   - Super Admin: unconditional.
 *   - Org Admin (an org-wide role holding `chat.channel.manage`): any
 *     fellowship in their organization.
 *   - Academy Admin (an academy-scoped role holding `chat.channel.manage`):
 *     only fellowships under their own academy.
 *   - Mentor: an active (`unassignedAt: null`) CohortMentor assignment on
 *     any cohort under this fellowship.
 *   - Student: an active Enrollment (not `invited`, not `withdrawn`) in this
 *     fellowship — `Enrollment.fellowshipId` is already denormalized, so
 *     this is a single indexed lookup, not a per-cohort scan.
 * `chat.channel.manage` is deliberately the signal for "this caller is an
 * administrator, not a participant" rather than a role-name check — it's
 * granted only to ORG_ADMIN/ACADEMY_ADMIN in the seed, so a caller either
 * has it (branch into the admin, academy-scope-aware path) or doesn't
 * (branch into the participant, enrollment/assignment-derived path) with no
 * role-name string compared anywhere in this method. */
@Injectable()
export class ChatAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipsService: MembershipsService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async authorize(
    scope: TenantScope,
    userId: string,
    fellowshipId: string,
  ): Promise<FellowshipChatAuthorization> {
    const fellowship = await this.prisma.fellowship.findFirst({
      where: { id: fellowshipId, organizationId: scope.organizationId, deletedAt: null },
      select: { id: true, organizationId: true, academyId: true, title: true },
    });
    if (!fellowship) {
      return { allowed: false, fellowship: null, canManageChannels: false, canModerate: false };
    }

    const authorization = await this.permissionResolver.resolve(userId, scope.organizationId);
    if (authorization.isSuperAdmin) {
      return { allowed: true, fellowship, canManageChannels: true, canModerate: true };
    }

    if (authorization.permissionKeys.has('chat.channel.manage')) {
      const academyScope = await this.membershipsService.getAcademyScope(scope, userId);
      const allowed = !academyScope.restricted || academyScope.academyId === fellowship.academyId;
      return {
        allowed,
        fellowship,
        canManageChannels: allowed,
        canModerate: allowed && authorization.permissionKeys.has('chat.message.moderate'),
      };
    }

    const [enrollment, mentorAssignment] = await Promise.all([
      this.prisma.enrollment.findFirst({
        where: {
          fellowshipId,
          userId,
          status: { in: ['active', 'paused', 'completed'] },
        },
        select: { id: true },
      }),
      this.prisma.cohortMentor.findFirst({
        where: {
          unassignedAt: null,
          cohort: { fellowshipId },
          membership: { userId, organizationId: scope.organizationId },
        },
        select: { id: true },
      }),
    ]);

    const allowed = Boolean(enrollment) || Boolean(mentorAssignment);
    return { allowed, fellowship, canManageChannels: false, canModerate: false };
  }
}
