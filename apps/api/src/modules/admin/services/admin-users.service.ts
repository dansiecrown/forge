import { Injectable } from '@nestjs/common';
import { MfaService } from '../../identity/services/mfa.service';
import { RefreshSessionService } from '../../identity/services/refresh-session.service';
import { UserProfilesService } from '../../identity/services/user-profiles.service';
import { UsersService } from '../../identity/services/users.service';
import { AcademiesService } from '../../organizations/services/academies.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { AdminAuditService } from './admin-audit.service';
import type { CreateAdminUserDto } from '../dtos/create-admin-user.dto';
import type { UpdateAdminUserProfileDto } from '../dtos/admin-user.dto';
import {
  AdminUsersRepository,
  type ScopedUserFilter,
} from '../repositories/admin-users.repository';

const KNOWN_ROLE_KEYS = new Set(['SUPER_ADMIN', 'ORG_ADMIN', 'ACADEMY_ADMIN', 'MENTOR', 'STUDENT']);

/** Every mutation here first confirms the target user actually has a
 * membership in the caller's active organization — and, for a restricted
 * caller (e.g. ACADEMY_ADMIN), in the caller's own academy specifically
 * (Milestone 7, closes DEBT-015) — tightening the pre-existing looseness in
 * `UsersController.get` where any `userId` is reachable given only
 * `user.read` in *some* org. Originally "no route/method here ever sets a
 * password directly" (ADR-0009's brief requirement); `create()` below is
 * now the one deliberate, disclosed exception — see ADR-0009's
 * 2026-09-06 addendum for why that reversal was made. Every other mutation
 * here still never touches a password directly. */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly usersService: UsersService,
    private readonly membershipsService: MembershipsService,
    private readonly mfaService: MfaService,
    private readonly refreshSessionService: RefreshSessionService,
    private readonly userProfilesService: UserProfilesService,
    private readonly adminAuditService: AdminAuditService,
    private readonly adminUsersRepository: AdminUsersRepository,
    private readonly auditLog: AuditLogService,
    private readonly academiesService: AcademiesService,
  ) {}

  /** Admin-set-password account creation — see `CreateAdminUserDto` and
   * docs/adr/0009-administration-platform.md's addendum. Guarded by the same
   * `membership.invite` permission as the older email-only invite flow
   * (`POST /users/invitations`); both stay available side by side. */
  async create(scope: TenantScope, actorUserId: string, dto: CreateAdminUserDto) {
    const requiresAcademy = dto.roleKeys.includes('ACADEMY_ADMIN');
    if (requiresAcademy && !dto.academyId) {
      throw AppException.validation([
        {
          field: 'academyId',
          code: 'ACADEMY_REQUIRED',
          message: 'Academy Admin requires an Academy to be selected.',
        },
      ]);
    }
    if (dto.academyId) {
      // Confirms the academy exists in this org (and, for a restricted
      // caller, in their own jurisdiction) before it's ever written onto a
      // new Membership row — the same existence+scope check every other
      // cross-entity reference in this codebase performs up front.
      await this.academiesService.get(scope, dto.academyId, actorUserId);
    }

    const user = await this.usersService.createWithPassword(
      {
        email: dto.email,
        username: dto.username,
        password: dto.password,
        displayName: dto.displayName,
        givenName: dto.givenName,
        familyName: dto.familyName,
      },
      actorUserId,
    );

    await this.membershipsService.inviteIntoOrganization(
      scope,
      user.id,
      dto.roleKeys,
      actorUserId,
      {
        status: 'active',
        academyId: dto.academyId,
      },
    );

    return { id: user.id, displayName: user.displayName, email: user.emailCanonical };
  }

  /** Resolves the caller's hierarchy scope into a repository filter, or
   * `null` when a restricted caller (e.g. ACADEMY_ADMIN) was never anchored
   * to an academy — the safe "sees nothing" case, never "sees everything". */
  private async resolveFilter(
    scope: TenantScope,
    callerId: string,
    roleKey?: string,
  ): Promise<ScopedUserFilter | null> {
    const academyScope = await this.membershipsService.getAcademyScope(scope, callerId);
    if (academyScope.restricted && !academyScope.academyId) {
      return null;
    }
    return {
      organizationId: scope.organizationId,
      restrictToAcademyId: academyScope.restricted ? academyScope.academyId! : undefined,
      // Unrecognized values are ignored rather than rejected — same
      // permissive-query-param convention every other list filter here uses.
      roleKey: roleKey && KNOWN_ROLE_KEYS.has(roleKey) ? roleKey : undefined,
    };
  }

  async list(
    scope: TenantScope,
    callerId: string,
    options: { q?: string; role?: string; cursor?: string; limit?: string },
  ) {
    const limit = parseLimit(options.limit);
    const filter = await this.resolveFilter(scope, callerId, options.role);
    if (!filter) {
      return new CollectionResult<never>([], {
        nextCursor: null,
        previousCursor: options.cursor ?? null,
        limit,
        hasMore: false,
      });
    }
    return this.adminUsersRepository.list({
      ...filter,
      q: options.q,
      cursor: options.cursor,
      limit,
    });
  }

  async get(scope: TenantScope, userId: string, callerId: string) {
    const filter = await this.resolveFilter(scope, callerId);
    const user = filter ? await this.adminUsersRepository.findScoped(userId, filter) : null;
    if (!user) {
      throw AppException.notFound('User not found in this organization.');
    }
    return user;
  }

  private async assertMember(scope: TenantScope, userId: string, callerId: string): Promise<void> {
    const filter = await this.resolveFilter(scope, callerId);
    const user = filter ? await this.adminUsersRepository.findScoped(userId, filter) : null;
    if (!user) {
      throw AppException.notFound('User not found in this organization.');
    }
  }

  async suspend(scope: TenantScope, userId: string, actorUserId: string): Promise<void> {
    await this.assertMember(scope, userId, actorUserId);
    await this.usersService.updateStatus(userId, 'suspended');
    await this.auditLog.record({
      action: 'user.suspended',
      entityType: 'user',
      entityId: userId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
  }

  async reactivate(scope: TenantScope, userId: string, actorUserId: string): Promise<void> {
    await this.assertMember(scope, userId, actorUserId);
    await this.usersService.updateStatus(userId, 'active');
    await this.auditLog.record({
      action: 'user.reactivated',
      entityType: 'user',
      entityId: userId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
  }

  async resetMfa(scope: TenantScope, userId: string, actorUserId: string): Promise<void> {
    await this.assertMember(scope, userId, actorUserId);
    await this.mfaService.adminDisable(userId);
    await this.auditLog.record({
      action: 'user.mfa_reset',
      entityType: 'user',
      entityId: userId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
  }

  async forcePasswordReset(scope: TenantScope, userId: string, actorUserId: string): Promise<void> {
    await this.assertMember(scope, userId, actorUserId);
    await this.usersService.forcePasswordReset(userId);
    await this.refreshSessionService.revokeAllForUser(userId);
    await this.auditLog.record({
      action: 'user.password_reset_forced',
      entityType: 'user',
      entityId: userId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
  }

  async listSessions(
    scope: TenantScope,
    userId: string,
    options: { cursor?: string; limit?: string },
    callerId: string,
  ) {
    await this.assertMember(scope, userId, callerId);
    return this.refreshSessionService.listActiveForUser(userId, {
      cursor: options.cursor,
      limit: parseLimit(options.limit),
    });
  }

  async revokeSession(
    scope: TenantScope,
    userId: string,
    sessionId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.assertMember(scope, userId, actorUserId);
    await this.refreshSessionService.revokeForUser(userId, sessionId);
    await this.auditLog.record({
      action: 'user.session_revoked',
      entityType: 'user',
      entityId: userId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { sessionId },
    });
  }

  async revokeAllSessions(scope: TenantScope, userId: string, actorUserId: string): Promise<void> {
    await this.assertMember(scope, userId, actorUserId);
    await this.refreshSessionService.revokeAllForUser(userId);
    await this.auditLog.record({
      action: 'user.all_sessions_revoked',
      entityType: 'user',
      entityId: userId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
  }

  async getLoginHistory(
    scope: TenantScope,
    userId: string,
    options: { cursor?: string; limit?: string },
    callerId: string,
  ) {
    await this.assertMember(scope, userId, callerId);
    return this.adminAuditService.search(scope, {
      actorUserId: userId,
      action: 'auth.login',
      cursor: options.cursor,
      limit: options.limit,
    });
  }

  /** Edits a Student/Mentor's own name (`User`) and profile fields
   * (`UserProfile`) — the admin's own id is passed as the audit actor to
   * `UserProfilesService.update()` so the trail attributes correctly rather
   * than misattributing the edit to the profile owner. */
  async updateProfile(
    scope: TenantScope,
    userId: string,
    actorUserId: string,
    dto: UpdateAdminUserProfileDto,
  ) {
    await this.assertMember(scope, userId, actorUserId);
    const { displayName, givenName, familyName, ...profileFields } = dto;
    const user = await this.usersService.updateMe(userId, { displayName, givenName, familyName });
    const profile = await this.userProfilesService.update(userId, profileFields, actorUserId);
    return { user, profile };
  }

  /** Reconciles a Student/Mentor's granted roles to exactly `roleKeys`. */
  async updateRoles(
    scope: TenantScope,
    userId: string,
    actorUserId: string,
    roleKeys: string[],
  ): Promise<void> {
    await this.assertMember(scope, userId, actorUserId);
    const membership = await this.membershipsService.getActiveMembership(scope, userId);
    if (!membership) {
      throw AppException.notFound('This user has no active membership in this organization.');
    }
    await this.membershipsService.updateRoles(scope, membership.id, roleKeys, actorUserId);
  }
}
