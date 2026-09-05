import { PrismaService } from '../../../database/prisma.service';
import { AuditLogRepository } from '../../platform/repositories/audit-log.repository';
import { AuditLogService } from '../../platform/audit-log.service';
import { MembershipsRepository } from '../../organizations/repositories/memberships.repository';
import { RolesRepository } from '../../organizations/repositories/roles.repository';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { ChatAccessService } from './chat-access.service';

jest.setTimeout(30_000);

/** Hits the real dev Postgres (docker-compose.dev.yml). This is Phase 7's
 * core requirement made permanent: two Fellowships under two different
 * Academies in the same Organization, one user per role, and an exhaustive
 * allow/deny matrix — access must come from a genuine Enrollment/
 * CohortMentor/admin-scope relationship, never merely from knowing a
 * Fellowship ID. See docs/adr/0014-fellowship-chat.md Decision 1. */
describe('ChatAccessService — cross-Fellowship isolation (integration)', () => {
  const prisma = new PrismaService();
  const auditLog = new AuditLogService(new AuditLogRepository(prisma));
  const membershipsRepository = new MembershipsRepository(prisma);
  const permissionResolver = new PermissionResolverService(membershipsRepository);
  const membershipsService = new MembershipsService(
    membershipsRepository,
    new RolesRepository(prisma),
    auditLog,
    permissionResolver,
  );
  const accessService = new ChatAccessService(prisma, membershipsService, permissionResolver);

  let organizationId: string;
  let academyAId: string;
  let academyBId: string;
  let fellowshipAId: string; // under Academy A
  let fellowshipBId: string; // under Academy B
  let cohortAId: string;
  let cohortBId: string;

  let orgAdminUserId: string;
  let academyAAdminUserId: string;
  let mentorAssignedToAUserId: string;
  let studentActiveInAUserId: string;
  let studentInvitedOnlyInAUserId: string;
  let studentWithdrawnFromAUserId: string;
  let unrelatedUserId: string;

  const SCOPE = () => ({ organizationId });

  async function findRoleId(key: string): Promise<string> {
    const role = await prisma.role.findFirstOrThrow({ where: { key, isSystem: true } });
    return role.id;
  }

  async function createMembership(
    userId: string,
    academyId: string | null,
    roleKey: string,
  ): Promise<string> {
    const membership = await prisma.membership.create({
      data: { organizationId, userId, academyId, status: 'active', joinedAt: new Date() },
    });
    const roleId = await findRoleId(roleKey);
    await prisma.membershipRole.create({ data: { membershipId: membership.id, roleId } });
    return membership.id;
  }

  async function createUser(emailLocalPart: string): Promise<string> {
    const suffix = Date.now() + Math.random().toString(36).slice(2, 8);
    const user = await prisma.user.create({
      data: {
        emailCanonical: `${emailLocalPart}-${suffix}@chat-access-test.local`,
        displayName: emailLocalPart,
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    });
    return user.id;
  }

  beforeAll(async () => {
    await prisma.$connect();
    const suffix = Date.now();

    const organization = await prisma.organization.create({
      data: { name: 'Chat Access Test Org', slug: `chat-access-org-${suffix}` },
    });
    organizationId = organization.id;

    const academyA = await prisma.academy.create({
      data: { organizationId, name: 'Academy A', slug: `chat-access-academy-a-${suffix}` },
    });
    academyAId = academyA.id;
    const academyB = await prisma.academy.create({
      data: { organizationId, name: 'Academy B', slug: `chat-access-academy-b-${suffix}` },
    });
    academyBId = academyB.id;

    const fellowshipA = await prisma.fellowship.create({
      data: {
        organizationId,
        academyId: academyAId,
        title: 'Fellowship A',
        slug: `chat-access-fellowship-a-${suffix}`,
        durationWeeks: 12,
      },
    });
    fellowshipAId = fellowshipA.id;
    const fellowshipB = await prisma.fellowship.create({
      data: {
        organizationId,
        academyId: academyBId,
        title: 'Fellowship B',
        slug: `chat-access-fellowship-b-${suffix}`,
        durationWeeks: 12,
      },
    });
    fellowshipBId = fellowshipB.id;

    const cohortA = await prisma.cohort.create({
      data: {
        organizationId,
        academyId: academyAId,
        fellowshipId: fellowshipAId,
        name: 'Cohort A1',
        slug: `chat-access-cohort-a-${suffix}`,
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2026-06-01'),
        timezone: 'UTC',
        capacity: 30,
      },
    });
    cohortAId = cohortA.id;
    const cohortB = await prisma.cohort.create({
      data: {
        organizationId,
        academyId: academyBId,
        fellowshipId: fellowshipBId,
        name: 'Cohort B1',
        slug: `chat-access-cohort-b-${suffix}`,
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2026-06-01'),
        timezone: 'UTC',
        capacity: 30,
      },
    });
    cohortBId = cohortB.id;

    orgAdminUserId = await createUser('org-admin');
    await createMembership(orgAdminUserId, null, 'ORG_ADMIN');

    academyAAdminUserId = await createUser('academy-a-admin');
    await createMembership(academyAAdminUserId, academyAId, 'ACADEMY_ADMIN');

    mentorAssignedToAUserId = await createUser('mentor-assigned-a');
    const mentorMembershipId = await createMembership(
      mentorAssignedToAUserId,
      academyAId,
      'MENTOR',
    );
    await prisma.cohortMentor.create({
      data: { cohortId: cohortAId, membershipId: mentorMembershipId },
    });

    studentActiveInAUserId = await createUser('student-active-a');
    await createMembership(studentActiveInAUserId, academyAId, 'STUDENT');
    await prisma.enrollment.create({
      data: {
        organizationId,
        academyId: academyAId,
        fellowshipId: fellowshipAId,
        cohortId: cohortAId,
        userId: studentActiveInAUserId,
        status: 'active',
        joinedAt: new Date(),
      },
    });

    studentInvitedOnlyInAUserId = await createUser('student-invited-a');
    await createMembership(studentInvitedOnlyInAUserId, academyAId, 'STUDENT');
    await prisma.enrollment.create({
      data: {
        organizationId,
        academyId: academyAId,
        fellowshipId: fellowshipAId,
        cohortId: cohortAId,
        userId: studentInvitedOnlyInAUserId,
        status: 'invited',
      },
    });

    studentWithdrawnFromAUserId = await createUser('student-withdrawn-a');
    await createMembership(studentWithdrawnFromAUserId, academyAId, 'STUDENT');
    await prisma.enrollment.create({
      data: {
        organizationId,
        academyId: academyAId,
        fellowshipId: fellowshipAId,
        cohortId: cohortAId,
        userId: studentWithdrawnFromAUserId,
        status: 'withdrawn',
        joinedAt: new Date(),
        endedAt: new Date(),
      },
    });

    unrelatedUserId = await createUser('unrelated-student');
    await createMembership(unrelatedUserId, academyBId, 'STUDENT');
  });

  afterAll(async () => {
    // RESTRICT (not CASCADE) FKs throughout this schema — children must be
    // torn down before their parents, deepest first.
    await prisma.cohortMentor.deleteMany({ where: { cohortId: { in: [cohortAId, cohortBId] } } });
    await prisma.enrollment.deleteMany({ where: { organizationId } });
    await prisma.membershipRole.deleteMany({ where: { membership: { organizationId } } });
    await prisma.membership.deleteMany({ where: { organizationId } });
    await prisma.cohort.deleteMany({ where: { organizationId } });
    await prisma.fellowship.deleteMany({ where: { organizationId } });
    await prisma.academy.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it('grants a Super Admin full manage+moderate access to any Fellowship', async () => {
    // SUPER_ADMIN is a platform-scoped grant (`findPlatformRoleGrants`
    // matches on role key + scopeType alone) — resolved independent of
    // which organization the membership row itself is anchored to.
    const superAdminUserId = await createUser('super-admin');
    await createMembership(superAdminUserId, null, 'SUPER_ADMIN');

    const authorization = await accessService.authorize(SCOPE(), superAdminUserId, fellowshipBId);
    expect(authorization).toMatchObject({
      allowed: true,
      canManageChannels: true,
      canModerate: true,
    });
  });

  it('grants an Org Admin manage access to every Fellowship across every Academy in their org', async () => {
    const authorizationA = await accessService.authorize(SCOPE(), orgAdminUserId, fellowshipAId);
    const authorizationB = await accessService.authorize(SCOPE(), orgAdminUserId, fellowshipBId);
    expect(authorizationA).toMatchObject({ allowed: true, canManageChannels: true });
    expect(authorizationB).toMatchObject({ allowed: true, canManageChannels: true });
  });

  it("grants an Academy Admin manage access to their own Academy's Fellowship", async () => {
    const authorization = await accessService.authorize(
      SCOPE(),
      academyAAdminUserId,
      fellowshipAId,
    );
    expect(authorization).toMatchObject({ allowed: true, canManageChannels: true });
  });

  // Below this point, the Fellowship genuinely exists (and `fellowship` on
  // the result may reflect that) — `allowed: false` is the only field every
  // real caller (`ChatChannelsService`/`ChatMessagesService`) actually
  // checks before ever touching `fellowship`, so that's what these assert.
  // `fellowship: null` is reserved for "no such Fellowship in this org at
  // all" (last test below).
  it("denies an Academy Admin access to a different Academy's Fellowship, even in the same org", async () => {
    const authorization = await accessService.authorize(
      SCOPE(),
      academyAAdminUserId,
      fellowshipBId,
    );
    expect(authorization.allowed).toBe(false);
    expect(authorization.canManageChannels).toBe(false);
  });

  it('grants a Mentor access to a Fellowship they have an active cohort assignment under', async () => {
    const authorization = await accessService.authorize(
      SCOPE(),
      mentorAssignedToAUserId,
      fellowshipAId,
    );
    expect(authorization).toMatchObject({ allowed: true, canManageChannels: false });
  });

  it('denies a Mentor access to a Fellowship they have no assignment under', async () => {
    const authorization = await accessService.authorize(
      SCOPE(),
      mentorAssignedToAUserId,
      fellowshipBId,
    );
    expect(authorization.allowed).toBe(false);
  });

  it('grants a Student with an active Enrollment access to that Fellowship', async () => {
    const authorization = await accessService.authorize(
      SCOPE(),
      studentActiveInAUserId,
      fellowshipAId,
    );
    expect(authorization).toMatchObject({
      allowed: true,
      canManageChannels: false,
      canModerate: false,
    });
  });

  it('denies a Student whose Enrollment is only "invited" (never joined)', async () => {
    const authorization = await accessService.authorize(
      SCOPE(),
      studentInvitedOnlyInAUserId,
      fellowshipAId,
    );
    expect(authorization.allowed).toBe(false);
  });

  it('denies a Student whose Enrollment has been withdrawn', async () => {
    const authorization = await accessService.authorize(
      SCOPE(),
      studentWithdrawnFromAUserId,
      fellowshipAId,
    );
    expect(authorization.allowed).toBe(false);
  });

  it('denies a Student with no relationship at all to the requested Fellowship — merely knowing the ID is not enough', async () => {
    const authorization = await accessService.authorize(SCOPE(), unrelatedUserId, fellowshipAId);
    expect(authorization.allowed).toBe(false);
    const authorizationB = await accessService.authorize(SCOPE(), unrelatedUserId, fellowshipBId);
    expect(authorizationB.allowed).toBe(false);
  });

  it('denies access to a Fellowship that does not exist in this organization at all', async () => {
    const authorization = await accessService.authorize(
      SCOPE(),
      studentActiveInAUserId,
      '00000000-0000-0000-0000-000000000000',
    );
    expect(authorization).toMatchObject({ allowed: false, fellowship: null });
  });
});
