import { PrismaService } from '../../../database/prisma.service';

jest.setTimeout(30_000);

/** Hits the real dev Postgres (docker-compose.dev.yml) to verify the
 * database-level guarantees `prisma/migrations/*_multi_tenant_foundation`
 * adds — the partial unique indexes Prisma's schema DSL can't express, so
 * they can only be proven by exercising a live database, not by unit-testing
 * application code. Requires `pnpm docker:up` first. */
describe('Multi-tenant foundation — database constraints (integration)', () => {
  const prisma = new PrismaService();
  let organizationId: string;
  let academyId: string;
  let fellowshipId: string;
  let cohortAId: string;
  let cohortBId: string;
  let studentUserId: string;

  beforeAll(async () => {
    await prisma.$connect();

    const organization = await prisma.organization.create({
      data: { name: 'Integration Test Org', slug: `integration-test-org-${Date.now()}` },
    });
    organizationId = organization.id;

    const academy = await prisma.academy.create({
      data: { organizationId, name: 'Test Academy', slug: 'test-academy' },
    });
    academyId = academy.id;

    const fellowship = await prisma.fellowship.create({
      data: {
        organizationId,
        academyId,
        title: 'Test Fellowship',
        slug: 'test-fellowship',
        durationWeeks: 12,
        status: 'published',
      },
    });
    fellowshipId = fellowship.id;

    const cohortA = await prisma.cohort.create({
      data: {
        organizationId,
        academyId,
        fellowshipId,
        name: 'Cohort A',
        slug: 'cohort-a',
        startsAt: new Date('2027-01-01T00:00:00Z'),
        endsAt: new Date('2027-06-01T00:00:00Z'),
        timezone: 'Africa/Lagos',
        capacity: 10,
      },
    });
    cohortAId = cohortA.id;

    const cohortB = await prisma.cohort.create({
      data: {
        organizationId,
        academyId,
        fellowshipId,
        name: 'Cohort B',
        slug: 'cohort-b',
        startsAt: new Date('2027-07-01T00:00:00Z'),
        endsAt: new Date('2027-12-01T00:00:00Z'),
        timezone: 'Africa/Lagos',
        capacity: 10,
      },
    });
    cohortBId = cohortB.id;

    const user = await prisma.user.create({
      data: {
        emailCanonical: `integration-test-student-${Date.now()}@example.com`,
        displayName: 'Integration Test Student',
      },
    });
    studentUserId = user.id;
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { fellowshipId } });
    await prisma.cohort.deleteMany({ where: { fellowshipId } });
    await prisma.fellowship.deleteMany({ where: { id: fellowshipId } });
    await prisma.academy.deleteMany({ where: { id: academyId } });
    // Defensive: a test user has no dependents in normal operation here, but
    // clear anything that could exist before deleting the row itself so
    // cleanup never leaves orphaned fixture data behind on a partial failure.
    await prisma.passwordResetToken.deleteMany({ where: { userId: studentUserId } });
    await prisma.emailVerificationToken.deleteMany({ where: { userId: studentUserId } });
    await prisma.membership.deleteMany({ where: { userId: studentUserId } });
    await prisma.user.deleteMany({ where: { id: studentUserId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it('rejects a second academy with the same slug in the same organization', async () => {
    await expect(
      prisma.academy.create({ data: { organizationId, name: 'Duplicate', slug: 'test-academy' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects a second fellowship with the same slug in the same academy', async () => {
    await expect(
      prisma.fellowship.create({
        data: {
          organizationId,
          academyId,
          title: 'Duplicate',
          slug: 'test-fellowship',
          durationWeeks: 8,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects a second cohort with the same slug in the same academy', async () => {
    await expect(
      prisma.cohort.create({
        data: {
          organizationId,
          academyId,
          fellowshipId,
          name: 'Duplicate',
          slug: 'cohort-a',
          startsAt: new Date('2028-01-01T00:00:00Z'),
          endsAt: new Date('2028-06-01T00:00:00Z'),
          timezone: 'Africa/Lagos',
          capacity: 5,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects a cohort whose endsAt is not after startsAt (chronology check constraint)', async () => {
    await expect(
      prisma.cohort.create({
        data: {
          organizationId,
          academyId,
          fellowshipId,
          name: 'Backwards',
          slug: 'cohort-backwards',
          startsAt: new Date('2027-06-01T00:00:00Z'),
          endsAt: new Date('2027-01-01T00:00:00Z'),
          timezone: 'Africa/Lagos',
          capacity: 5,
        },
      }),
    ).rejects.toThrow();
  });

  it('allows one active enrollment per fellowship, and rejects a second active/pending one in a different cohort', async () => {
    await prisma.enrollment.create({
      data: { organizationId, academyId, fellowshipId, cohortId: cohortAId, userId: studentUserId },
    });

    await expect(
      prisma.enrollment.create({
        data: {
          organizationId,
          academyId,
          fellowshipId,
          cohortId: cohortBId,
          userId: studentUserId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows a new enrollment once the prior one reaches a terminal status', async () => {
    await prisma.enrollment.updateMany({
      where: { fellowshipId, userId: studentUserId, cohortId: cohortAId },
      data: { status: 'withdrawn' },
    });

    await expect(
      prisma.enrollment.create({
        data: {
          organizationId,
          academyId,
          fellowshipId,
          cohortId: cohortBId,
          userId: studentUserId,
        },
      }),
    ).resolves.toMatchObject({ cohortId: cohortBId, status: 'invited' });
  });
});
