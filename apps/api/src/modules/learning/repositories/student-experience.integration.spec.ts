import { PrismaService } from '../../../database/prisma.service';
import { UserProfilesRepository } from '../../identity/repositories/user-profiles.repository';
import { PortfolioProjectsRepository } from './portfolio-projects.repository';

jest.setTimeout(30_000);

/** Hits the real dev Postgres (docker-compose.dev.yml). Covers what unit
 * tests can't: (1) `user_profiles.user_id`'s unique constraint (the table
 * was `student_profiles` prior to Milestone 6 — see
 * docs/adr/0008-mentor-experience.md Decision 4) — a second
 * `PATCH /me/profile` updates the same row rather than creating a duplicate,
 * and (2) the hand-written partial unique index
 * `portfolio_projects_org_public_slug_active_key` — Prisma's schema DSL
 * cannot express a `WHERE` clause on `@@unique`, so this proves the
 * hand-assembled migration SQL actually enforces it. Requires
 * `pnpm docker:up` first. */
describe('Student Experience — database constraints (integration)', () => {
  const prisma = new PrismaService();
  const userProfilesRepository = new UserProfilesRepository(prisma);
  const portfolioProjectsRepository = new PortfolioProjectsRepository(prisma);

  let organizationId: string;
  let academyId: string;
  let fellowshipId: string;
  let cohortId: string;
  let userId: string;
  let enrollmentId: string;
  let submissionAId: string;
  let submissionBId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const suffix = Date.now();

    const organization = await prisma.organization.create({
      data: { name: 'Student Experience Test Org', slug: `student-experience-org-${suffix}` },
    });
    organizationId = organization.id;

    const academy = await prisma.academy.create({
      data: { organizationId, name: 'Test Academy', slug: `student-experience-academy-${suffix}` },
    });
    academyId = academy.id;

    const fellowship = await prisma.fellowship.create({
      data: {
        organizationId,
        academyId,
        title: 'Test Fellowship',
        slug: `student-experience-fellowship-${suffix}`,
        durationWeeks: 12,
        status: 'published',
      },
    });
    fellowshipId = fellowship.id;

    const cohort = await prisma.cohort.create({
      data: {
        organizationId,
        academyId,
        fellowshipId,
        name: 'Cohort A',
        slug: `student-experience-cohort-${suffix}`,
        startsAt: new Date('2027-01-01T00:00:00Z'),
        endsAt: new Date('2027-06-01T00:00:00Z'),
        timezone: 'Africa/Lagos',
        capacity: 10,
      },
    });
    cohortId = cohort.id;

    const user = await prisma.user.create({
      data: {
        emailCanonical: `student-experience-${suffix}@example.com`,
        displayName: 'Test Student',
      },
    });
    userId = user.id;

    const enrollment = await prisma.enrollment.create({
      data: { organizationId, academyId, fellowshipId, cohortId, userId },
    });
    enrollmentId = enrollment.id;

    const track = await prisma.learningTrack.create({
      data: { organizationId, fellowshipId, name: 'Web Dev', slug: `web-dev-${suffix}` },
    });
    const course = await prisma.course.create({
      data: {
        organizationId,
        learningTrackId: track.id,
        title: 'Foundations',
        slug: `foundations-${suffix}`,
      },
    });
    const weeklyModule = await prisma.weeklyModule.create({
      data: { organizationId, courseId: course.id, weekNumber: 1, title: 'Week 1' },
    });
    const task = await prisma.practicalTask.create({
      data: { organizationId, weeklyModuleId: weeklyModule.id, title: 'Build a page' },
    });

    const submissionA = await prisma.practicalTaskSubmission.create({
      data: {
        enrollmentId,
        practicalTaskId: task.id,
        status: 'submitted',
        submittedAt: new Date(),
      },
    });
    submissionAId = submissionA.id;

    const taskB = await prisma.practicalTask.create({
      data: { organizationId, weeklyModuleId: weeklyModule.id, title: 'Build another page' },
    });
    const submissionB = await prisma.practicalTaskSubmission.create({
      data: {
        enrollmentId,
        practicalTaskId: taskB.id,
        status: 'submitted',
        submittedAt: new Date(),
      },
    });
    submissionBId = submissionB.id;
  });

  afterAll(async () => {
    await prisma.portfolioProject.deleteMany({ where: { enrollmentId } });
    await prisma.practicalTaskSubmission.deleteMany({ where: { enrollmentId } });
    await prisma.practicalTask.deleteMany({
      where: { weeklyModule: { course: { learningTrack: { fellowshipId } } } },
    });
    await prisma.weeklyModule.deleteMany({
      where: { course: { learningTrack: { fellowshipId } } },
    });
    await prisma.course.deleteMany({ where: { learningTrack: { fellowshipId } } });
    await prisma.learningTrack.deleteMany({ where: { fellowshipId } });
    await prisma.enrollment.deleteMany({ where: { fellowshipId } });
    await prisma.cohort.deleteMany({ where: { fellowshipId } });
    await prisma.fellowship.deleteMany({ where: { id: fellowshipId } });
    await prisma.academy.deleteMany({ where: { id: academyId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.userProfile.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  describe('user_profiles.user_id unique constraint', () => {
    it('a second update for the same user updates the same row, never creating a duplicate', async () => {
      await userProfilesRepository.upsert(userId, { bio: 'First bio' });
      const afterFirst = await prisma.userProfile.findMany({ where: { userId } });
      expect(afterFirst).toHaveLength(1);

      await userProfilesRepository.upsert(userId, { bio: 'Second bio' });
      const afterSecond = await prisma.userProfile.findMany({ where: { userId } });
      expect(afterSecond).toHaveLength(1);
      expect(afterSecond[0].bio).toBe('Second bio');
      expect(afterSecond[0].version).toBe(2);
    });
  });

  describe('portfolio_projects partial unique index (organization_id, public_slug)', () => {
    it('rejects a second row with the same public_slug for the same organization', async () => {
      const scope = { organizationId };
      const projectA = await portfolioProjectsRepository.create(scope, {
        enrollmentId,
        practicalTaskSubmissionId: submissionAId,
        title: 'Project A',
        completionDate: new Date(),
      });
      const projectB = await portfolioProjectsRepository.create(scope, {
        enrollmentId,
        practicalTaskSubmissionId: submissionBId,
        title: 'Project B',
        completionDate: new Date(),
      });

      await prisma.portfolioProject.update({
        where: { id: projectA.id },
        data: { publicSlug: 'shared-slug', visibility: 'public', publishedAt: new Date() },
      });

      await expect(
        prisma.portfolioProject.update({
          where: { id: projectB.id },
          data: { publicSlug: 'shared-slug', visibility: 'public', publishedAt: new Date() },
        }),
      ).rejects.toThrow();
    });

    it('allows the same public_slug to be reused once the original is soft-deleted', async () => {
      const scope = { organizationId };
      const projectA = await portfolioProjectsRepository.create(scope, {
        enrollmentId,
        practicalTaskSubmissionId: submissionAId,
        title: 'Project reused A',
        completionDate: new Date(),
      });
      await prisma.portfolioProject.update({
        where: { id: projectA.id },
        data: { publicSlug: 'reusable-slug', deletedAt: new Date() },
      });

      const projectB = await portfolioProjectsRepository.create(scope, {
        enrollmentId,
        practicalTaskSubmissionId: submissionBId,
        title: 'Project reused B',
        completionDate: new Date(),
      });
      await expect(
        prisma.portfolioProject.update({
          where: { id: projectB.id },
          data: { publicSlug: 'reusable-slug' },
        }),
      ).resolves.toMatchObject({ publicSlug: 'reusable-slug' });

      await prisma.portfolioProject.deleteMany({
        where: { id: { in: [projectA.id, projectB.id] } },
      });
    });
  });
});
