import { PrismaService } from '../../../database/prisma.service';
import {
  CurriculumSnapshotService,
  type CurriculumSnapshot,
} from '../services/curriculum-snapshot.service';
import { LearningTracksRepository } from './learning-tracks.repository';
import { CohortsRepository } from '../../cohorts/repositories/cohorts.repository';

jest.setTimeout(30_000);

/** Hits the real dev Postgres (docker-compose.dev.yml). Covers two things
 * unit tests can't: (1) the new partial unique indexes
 * `apps/api/prisma/migrations/*_curriculum_learning_engine` adds, and (2)
 * the cohort-snapshot versioning resolution end-to-end — editing curriculum
 * after a cohort exists must leave that cohort's stored snapshot untouched
 * until `sync-curriculum` is explicitly applied, while a *new* cohort always
 * gets the current structure automatically (docs/adr/0006-curriculum-learning-engine.md
 * Decision 1). Requires `pnpm docker:up` first. */
describe('Curriculum & Learning Engine — database constraints and snapshot behavior (integration)', () => {
  const prisma = new PrismaService();
  const snapshotService = new CurriculumSnapshotService(prisma);
  const cohortsRepository = new CohortsRepository(prisma);
  const learningTracksRepository = new LearningTracksRepository(prisma);

  let organizationId: string;
  let academyId: string;
  let fellowshipId: string;
  let trackId: string;
  let courseId: string;
  let moduleId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const suffix = Date.now();

    const organization = await prisma.organization.create({
      data: { name: 'Curriculum Test Org', slug: `curriculum-test-org-${suffix}` },
    });
    organizationId = organization.id;

    const academy = await prisma.academy.create({
      data: { organizationId, name: 'Test Academy', slug: 'curriculum-test-academy' },
    });
    academyId = academy.id;

    const fellowship = await prisma.fellowship.create({
      data: {
        organizationId,
        academyId,
        title: 'Test Fellowship',
        slug: 'curriculum-test-fellowship',
        durationWeeks: 12,
        status: 'published',
      },
    });
    fellowshipId = fellowship.id;

    const track = await prisma.learningTrack.create({
      data: { organizationId, fellowshipId, name: 'Web Development', slug: 'web-development' },
    });
    trackId = track.id;

    const course = await prisma.course.create({
      data: {
        organizationId,
        learningTrackId: trackId,
        title: 'HTML Foundations',
        slug: 'html-foundations',
      },
    });
    courseId = course.id;

    const weeklyModule = await prisma.weeklyModule.create({
      data: { organizationId, courseId, weekNumber: 1, title: 'Week 1' },
    });
    moduleId = weeklyModule.id;

    await prisma.lesson.create({
      data: {
        organizationId,
        weeklyModuleId: moduleId,
        title: 'Intro to HTML',
        lessonType: 'article',
      },
    });
  });

  afterAll(async () => {
    // Scoped by fellowshipId/academyId (not just the specific fixture ids
    // created in beforeAll) so any row a test creates along the way —
    // including the reused-slug row below — is cleaned up too, the same
    // defensive pattern enrollments.repository.integration.spec.ts uses.
    const tracks = await prisma.learningTrack.findMany({
      where: { fellowshipId },
      select: { id: true },
    });
    const trackIds = tracks.map((t) => t.id);
    const courses = await prisma.course.findMany({
      where: { learningTrackId: { in: trackIds } },
      select: { id: true },
    });
    const courseIds = courses.map((c) => c.id);
    const modules = await prisma.weeklyModule.findMany({
      where: { courseId: { in: courseIds } },
      select: { id: true },
    });
    const moduleIds = modules.map((m) => m.id);

    await prisma.lessonCompletion.deleteMany({
      where: { lesson: { weeklyModuleId: { in: moduleIds } } },
    });
    await prisma.lesson.deleteMany({ where: { weeklyModuleId: { in: moduleIds } } });
    await prisma.weeklyModule.deleteMany({ where: { courseId: { in: courseIds } } });
    await prisma.course.deleteMany({ where: { learningTrackId: { in: trackIds } } });
    await prisma.learningTrack.deleteMany({ where: { fellowshipId } });
    await prisma.cohort.deleteMany({ where: { fellowshipId } });
    await prisma.fellowship.deleteMany({ where: { id: fellowshipId } });
    await prisma.academy.deleteMany({ where: { id: academyId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  describe('partial unique indexes', () => {
    it('rejects a second learning track with the same slug in the same fellowship', async () => {
      await expect(
        prisma.learningTrack.create({
          data: { organizationId, fellowshipId, name: 'Duplicate', slug: 'web-development' },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('rejects a second course with the same slug in the same learning track', async () => {
      await expect(
        prisma.course.create({
          data: {
            organizationId,
            learningTrackId: trackId,
            title: 'Duplicate',
            slug: 'html-foundations',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('rejects a second weekly module with the same week number in the same course', async () => {
      await expect(
        prisma.weeklyModule.create({
          data: { organizationId, courseId, weekNumber: 1, title: 'Duplicate week 1' },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('allows the same slug to be reused once the original is soft-deleted (archived)', async () => {
      const archivable = await prisma.learningTrack.create({
        data: { organizationId, fellowshipId, name: 'Archivable', slug: 'archivable-track' },
      });
      await prisma.learningTrack.update({
        where: { id: archivable.id },
        data: { status: 'archived', deletedAt: new Date() },
      });

      const reused = await prisma.learningTrack.create({
        data: { organizationId, fellowshipId, name: 'Reused slug', slug: 'archivable-track' },
      });
      expect(reused.slug).toBe('archivable-track');

      // Cleaned up here rather than left for afterAll — later tests in this
      // file assume `fellowshipId` has exactly one (the fixture) track.
      await prisma.learningTrack.deleteMany({ where: { id: { in: [archivable.id, reused.id] } } });
    });
  });

  describe('progression table unique constraints', () => {
    it('rejects a second LessonCompletion for the same (enrollment, lesson) pair', async () => {
      const user = await prisma.user.create({
        data: {
          emailCanonical: `curriculum-test-student-${Date.now()}@example.com`,
          displayName: 'Student',
        },
      });
      const cohort = await prisma.cohort.create({
        data: {
          organizationId,
          academyId,
          fellowshipId,
          name: 'Constraint Test Cohort',
          slug: `constraint-test-cohort-${Date.now()}`,
          startsAt: new Date('2027-01-01T00:00:00Z'),
          endsAt: new Date('2027-06-01T00:00:00Z'),
          timezone: 'Africa/Lagos',
          capacity: 5,
        },
      });
      const enrollment = await prisma.enrollment.create({
        data: { organizationId, academyId, fellowshipId, cohortId: cohort.id, userId: user.id },
      });
      const lesson = await prisma.lesson.findFirstOrThrow({ where: { weeklyModuleId: moduleId } });

      await prisma.lessonCompletion.create({
        data: { enrollmentId: enrollment.id, lessonId: lesson.id },
      });
      await expect(
        prisma.lessonCompletion.create({
          data: { enrollmentId: enrollment.id, lessonId: lesson.id },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      await prisma.lessonCompletion.deleteMany({ where: { enrollmentId: enrollment.id } });
      await prisma.enrollment.deleteMany({ where: { id: enrollment.id } });
      await prisma.cohort.deleteMany({ where: { id: cohort.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    });
  });

  describe('cross-organization isolation', () => {
    it("returns null (not the row) when a learning track is queried with a different organization's scope", async () => {
      const suffix = Date.now();
      const otherOrg = await prisma.organization.create({
        data: { name: 'Isolation Org B', slug: `curriculum-isolation-org-b-${suffix}` },
      });

      const track = await learningTracksRepository.findById({ organizationId }, trackId);
      expect(track?.id).toBe(trackId);

      const crossOrgTrack = await learningTracksRepository.findById(
        { organizationId: otherOrg.id },
        trackId,
      );
      expect(crossOrgTrack).toBeNull();

      await prisma.organization.deleteMany({ where: { id: otherOrg.id } });
    });
  });

  describe('cohort curriculum snapshot versioning resolution', () => {
    it('freezes a cohort at creation, leaves it untouched by later edits, and only updates via explicit sync', async () => {
      const initialSnapshot = await snapshotService.build({ organizationId }, fellowshipId);
      expect(initialSnapshot.tracks[0].courses[0].weeklyModules[0].lessons).toHaveLength(1);

      const cohort = await prisma.cohort.create({
        data: {
          organizationId,
          academyId,
          fellowshipId,
          name: 'Snapshot Test Cohort',
          slug: `snapshot-test-cohort-${Date.now()}`,
          startsAt: new Date('2027-01-01T00:00:00Z'),
          endsAt: new Date('2027-06-01T00:00:00Z'),
          timezone: 'Africa/Lagos',
          capacity: 5,
          curriculumSnapshot: initialSnapshot as never,
          curriculumSnapshotAt: new Date(),
        },
      });

      // Edit curriculum after the cohort exists — add a second lesson.
      await prisma.lesson.create({
        data: {
          organizationId,
          weeklyModuleId: moduleId,
          title: 'A new lesson added after the cohort started',
          lessonType: 'article',
        },
      });

      // The existing cohort's stored snapshot must be unchanged — "future
      // cohorts only" is the default; nothing propagates without an
      // explicit sync call.
      const unchangedCohort = await prisma.cohort.findUniqueOrThrow({ where: { id: cohort.id } });
      const unchangedSnapshot = unchangedCohort.curriculumSnapshot as unknown as CurriculumSnapshot;
      expect(unchangedSnapshot.tracks[0].courses[0].weeklyModules[0].lessons).toHaveLength(1);

      // Explicit sync — the "apply to this already-running cohort now" action.
      const refreshedSnapshot = await snapshotService.build({ organizationId }, fellowshipId);
      await cohortsRepository.updateCurriculumSnapshot(cohort.id, refreshedSnapshot as never);

      const syncedCohort = await prisma.cohort.findUniqueOrThrow({ where: { id: cohort.id } });
      const syncedSnapshot = syncedCohort.curriculumSnapshot as unknown as CurriculumSnapshot;
      expect(syncedSnapshot.tracks[0].courses[0].weeklyModules[0].lessons).toHaveLength(2);

      // A cohort created *after* the edit gets the new structure automatically,
      // with no sync call.
      const laterSnapshot = await snapshotService.build({ organizationId }, fellowshipId);
      const laterCohort = await prisma.cohort.create({
        data: {
          organizationId,
          academyId,
          fellowshipId,
          name: 'Later Cohort',
          slug: `later-cohort-${Date.now()}`,
          startsAt: new Date('2028-01-01T00:00:00Z'),
          endsAt: new Date('2028-06-01T00:00:00Z'),
          timezone: 'Africa/Lagos',
          capacity: 5,
          curriculumSnapshot: laterSnapshot as never,
          curriculumSnapshotAt: new Date(),
        },
      });
      const laterCohortSnapshot = laterCohort.curriculumSnapshot as unknown as CurriculumSnapshot;
      expect(laterCohortSnapshot.tracks[0].courses[0].weeklyModules[0].lessons).toHaveLength(2);

      await prisma.cohort.deleteMany({ where: { id: { in: [cohort.id, laterCohort.id] } } });
    });
  });
});
