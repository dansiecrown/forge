import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { MembershipsRepository } from '../repositories/memberships.repository';
import { RolesRepository } from '../repositories/roles.repository';
import { PermissionResolverService, SUPER_ADMIN_ROLE_KEY } from './permission-resolver.service';

/** Result of resolving how far into the organization's hierarchy a caller
 * may see/act: `restricted: false` means org-wide (Super Admin or any
 * organization-scoped role, e.g. ORG_ADMIN); `restricted: true` means
 * confined to a single Academy (`academyId`, which may itself be `null` if
 * the membership was never anchored to one — treated as "sees nothing",
 * never "sees everything"). */
export interface AcademyScope {
  restricted: boolean;
  academyId: string | null;
}

@Injectable()
export class MembershipsService {
  constructor(
    private readonly membershipsRepository: MembershipsRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly auditLog: AuditLogService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  /** Resolves how far into the org hierarchy `userId` may see/act, per the
   * Milestone 7 admin-scoping requirement: Super Admin and any
   * organization-scoped role (ORG_ADMIN) get the whole organization;
   * academy-scoped roles (ACADEMY_ADMIN) are confined to the one Academy
   * their membership is anchored to. Closes DEBT-015. */
  async getAcademyScope(scope: TenantScope, userId: string): Promise<AcademyScope> {
    const isSuperAdmin = await this.permissionResolver.hasPlatformRole(
      userId,
      SUPER_ADMIN_ROLE_KEY,
    );
    if (isSuperAdmin) {
      return { restricted: false, academyId: null };
    }

    const membership = await this.membershipsRepository.findActive(scope, userId);
    if (!membership) {
      return { restricted: true, academyId: null };
    }

    const scopeTypes = membership.membershipRoles.map((grant) => grant.role.scopeType);
    const hasOrgWideRole = scopeTypes.some(
      (scopeType) => scopeType === 'platform' || scopeType === 'organization',
    );
    if (hasOrgWideRole) {
      return { restricted: false, academyId: null };
    }

    return { restricted: true, academyId: membership.academyId };
  }

  listForUser(userId: string) {
    return this.membershipsRepository.listForUser(userId);
  }

  /** Organization Management's "organization administrators" list. */
  listAdmins(scope: TenantScope) {
    return this.membershipsRepository.listByRoleKey(scope, 'ORG_ADMIN');
  }

  /** Organization Management's "membership overview" summary. */
  getOverview(scope: TenantScope) {
    return this.membershipsRepository.getOverview(scope);
  }

  /** Existence + org-scope check for other modules (cohorts) validating a
   * caller-supplied membershipId — e.g. confirming a mentor assignment
   * target is actually a member of this organization. */
  findById(scope: TenantScope, id: string) {
    return this.membershipsRepository.findById(scope, id);
  }

  /** Used by the cohorts module to confirm an enrollment's target user is
   * actually a member of the organization before enrolling them. */
  async hasActiveMembership(scope: TenantScope, userId: string): Promise<boolean> {
    const membership = await this.membershipsRepository.findActive(scope, userId);
    return membership !== null;
  }

  /** Resolves the caller's own active membership within `scope` — used by
   * `assertMentorAssignedToCohort` and the Mentor Portal to translate a
   * userId into the membershipId that `CohortMentor`/`SubmissionReview`/
   * `HuddleSession`/`MentorNote` all key off. */
  getActiveMembership(scope: TenantScope, userId: string) {
    return this.membershipsRepository.findActive(scope, userId);
  }

  /** Creates the membership for a newly invited user — who may be a brand
   * new identity or an existing one joining an additional organization,
   * see docs/adr/0003 Part A addendum — and grants the requested system
   * roles, all within the inviter's active organization. */
  async inviteIntoOrganization(
    scope: TenantScope,
    userId: string,
    roleKeys: string[],
    invitedBy?: string,
  ): Promise<void> {
    const existingMembership = await this.membershipsRepository.findByOrganizationAndUser(
      scope.organizationId,
      userId,
    );
    if (existingMembership) {
      throw AppException.conflict(
        'ALREADY_MEMBER',
        'This person is already a member of this organization.',
      );
    }

    const membership = await this.membershipsRepository.create(scope, userId);

    for (const roleKey of roleKeys) {
      const role = await this.rolesRepository.findByKey(roleKey);
      if (!role) {
        throw AppException.validation([
          { field: 'roles', code: 'UNKNOWN_ROLE', message: `Unknown role key: ${roleKey}` },
        ]);
      }
      await this.membershipsRepository.grantRole(membership.id, role.id, invitedBy);
    }

    await this.auditLog.record({
      action: 'membership.role_granted',
      entityType: 'membership',
      entityId: membership.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: invitedBy,
      metadata: { roleKeys },
    });
  }

  async updateStatus(
    scope: TenantScope,
    membershipId: string,
    status: 'active' | 'suspended',
    actorUserId?: string,
  ): Promise<void> {
    const membership = await this.membershipsRepository.findById(scope, membershipId);
    if (!membership) {
      throw AppException.notFound('Membership not found.');
    }

    await this.membershipsRepository.updateStatus(scope, membershipId, status);
    await this.auditLog.record({
      action: 'membership.status_changed',
      entityType: 'membership',
      entityId: membershipId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { status },
    });
  }

  /** Resolves the caller's own membership within `scope` to authorize the
   * `PATCH /users/:userId/status` convenience route, which addresses a
   * membership indirectly by (organization, user) rather than membership id. */
  async updateStatusForUser(
    scope: TenantScope,
    userId: string,
    status: 'active' | 'suspended',
    actorUserId?: string,
  ): Promise<void> {
    const membership = await this.membershipsRepository.findActive(scope, userId);
    if (!membership) {
      throw AppException.notFound('Membership not found.');
    }
    await this.updateStatus(scope, membership.id, status, actorUserId);
  }

  /** Reconciles a membership's granted roles to exactly `roleKeys` — revokes
   * whatever's currently granted but missing from the list, grants whatever's
   * in the list but not currently granted. Used by Admin Users' role editor
   * (Milestone 8); reuses the same `grantRole`/`revokeRole` primitives
   * `inviteIntoOrganization` already relies on. No `version`/`If-Match`
   * concurrency check — `Membership` carries no `version` column and this is
   * a low-contention admin action, same reasoning as `updateStatus` above. */
  async updateRoles(
    scope: TenantScope,
    membershipId: string,
    roleKeys: string[],
    actorUserId?: string,
  ): Promise<void> {
    const membership = await this.membershipsRepository.findById(scope, membershipId);
    if (!membership) {
      throw AppException.notFound('Membership not found.');
    }

    const currentGrants = membership.membershipRoles.filter((grant) => !grant.revokedAt);
    const currentKeys = new Set(currentGrants.map((grant) => grant.role.key));
    const nextKeys = new Set(roleKeys);

    for (const grant of currentGrants) {
      if (!nextKeys.has(grant.role.key)) {
        await this.membershipsRepository.revokeRole(membershipId, grant.role.id);
      }
    }
    for (const roleKey of nextKeys) {
      if (!currentKeys.has(roleKey)) {
        const role = await this.rolesRepository.findByKey(roleKey);
        if (!role) {
          throw AppException.validation([
            { field: 'roleKeys', code: 'UNKNOWN_ROLE', message: `Unknown role key: ${roleKey}` },
          ]);
        }
        await this.membershipsRepository.grantRole(membershipId, role.id, actorUserId);
      }
    }

    await this.auditLog.record({
      action: 'membership.roles_updated',
      entityType: 'membership',
      entityId: membershipId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { roleKeys },
    });
  }
}
