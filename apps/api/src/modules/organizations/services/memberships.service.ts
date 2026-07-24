import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { MembershipsRepository } from '../repositories/memberships.repository';
import { RolesRepository } from '../repositories/roles.repository';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly membershipsRepository: MembershipsRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  listForUser(userId: string) {
    return this.membershipsRepository.listForUser(userId);
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
}
