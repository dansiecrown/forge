import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

export interface CurriculumSnapshotLesson {
  id: string;
  title: string;
  description: string | null;
  lessonType: string;
  estimatedDurationMinutes: number | null;
  resourceUrl: string | null;
  attachmentMetadata: unknown;
  embeddedContentMetadata: unknown;
  completionRequired: boolean;
  displayOrder: number;
  status: string;
}

export interface CurriculumSnapshotResource {
  id: string;
  title: string;
  resourceType: string;
  url: string | null;
  author: string | null;
  provider: string | null;
  estimatedDurationMinutes: number | null;
  notes: string | null;
  isRequired: boolean;
  displayOrder: number;
  status: string;
}

export interface CurriculumSnapshotTask {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  deliverables: string[];
  dueOffsetDays: number | null;
  rubricMetadata: unknown;
  maxScore: number | null;
  displayOrder: number;
  status: string;
}

export interface CurriculumSnapshotModule {
  id: string;
  weekNumber: number;
  title: string;
  objectives: string[];
  summary: string | null;
  estimatedStudyHours: number | null;
  status: string;
  requiresMentorHuddle: boolean;
  requiresPracticalWork: boolean;
  unlockRules: unknown;
  huddleScheduleMetadata: unknown;
  huddleMeetingLink: string | null;
  mentorHuddleNotes: string | null;
  huddleAttendanceRequired: boolean;
  lessons: CurriculumSnapshotLesson[];
  resources: CurriculumSnapshotResource[];
  practicalTasks: CurriculumSnapshotTask[];
}

export interface CurriculumSnapshotCourse {
  id: string;
  title: string;
  slug: string;
  status: string;
  displayOrder: number;
  weeklyModules: CurriculumSnapshotModule[];
}

export interface CurriculumSnapshotTrack {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  difficulty: string;
  estimatedWeeks: number | null;
  learningOutcomes: string[];
  status: string;
  displayOrder: number;
  courses: CurriculumSnapshotCourse[];
}

export interface CurriculumSnapshot {
  generatedAt: string;
  fellowshipId: string;
  tracks: CurriculumSnapshotTrack[];
}

/** Builds the frozen read-model a Cohort's `curriculumSnapshot` column
 * stores. The only thing the `cohorts` module needs from `catalog` beyond
 * what it already imports — see docs/adr/0006-curriculum-learning-engine.md
 * Decision 1 for why this is a snapshot rather than a live join. */
@Injectable()
export class CurriculumSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  /** `cohortId` scopes the snapshot to only the tracks that Cohort has
   * explicitly opted into (`CohortLearningTrack` — see
   * docs/adr/0016-cohort-scoped-tracks.md Decision 1). Omitted at cohort
   * *creation* (the cohort has no id yet to have opted into anything) and
   * for any cohort that has never made a selection — both cases fall back
   * to every track under the Fellowship, preserving the pre-existing
   * behavior for every cohort created before this feature existed. */
  async build(
    scope: TenantScope,
    fellowshipId: string,
    cohortId?: string,
  ): Promise<CurriculumSnapshot> {
    let offeredTrackIds: string[] | undefined;
    if (cohortId) {
      const offered = await this.prisma.cohortLearningTrack.findMany({
        where: { cohortId },
        select: { learningTrackId: true },
      });
      if (offered.length > 0) {
        offeredTrackIds = offered.map((row) => row.learningTrackId);
      }
    }

    const tracks = await this.prisma.learningTrack.findMany({
      where: {
        organizationId: scope.organizationId,
        fellowshipId,
        deletedAt: null,
        ...(offeredTrackIds ? { id: { in: offeredTrackIds } } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        courses: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
          include: {
            weeklyModules: {
              where: { deletedAt: null },
              orderBy: { weekNumber: 'asc' },
              include: {
                lessons: {
                  where: { deletedAt: null },
                  orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
                },
                resources: {
                  where: { deletedAt: null },
                  orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
                },
                practicalTasks: {
                  where: { deletedAt: null },
                  orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
                },
              },
            },
          },
        },
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      fellowshipId,
      tracks: tracks.map((track) => ({
        id: track.id,
        name: track.name,
        slug: track.slug,
        description: track.description,
        difficulty: track.difficulty,
        estimatedWeeks: track.estimatedWeeks,
        learningOutcomes: track.learningOutcomes,
        status: track.status,
        displayOrder: track.displayOrder,
        courses: track.courses.map((course) => ({
          id: course.id,
          title: course.title,
          slug: course.slug,
          status: course.status,
          displayOrder: course.displayOrder,
          weeklyModules: course.weeklyModules.map((weeklyModule) => ({
            id: weeklyModule.id,
            weekNumber: weeklyModule.weekNumber,
            title: weeklyModule.title,
            objectives: weeklyModule.objectives,
            summary: weeklyModule.summary,
            estimatedStudyHours: weeklyModule.estimatedStudyHours,
            status: weeklyModule.status,
            requiresMentorHuddle: weeklyModule.requiresMentorHuddle,
            requiresPracticalWork: weeklyModule.requiresPracticalWork,
            unlockRules: weeklyModule.unlockRules,
            huddleScheduleMetadata: weeklyModule.huddleScheduleMetadata,
            huddleMeetingLink: weeklyModule.huddleMeetingLink,
            mentorHuddleNotes: weeklyModule.mentorHuddleNotes,
            huddleAttendanceRequired: weeklyModule.huddleAttendanceRequired,
            lessons: weeklyModule.lessons.map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              description: lesson.description,
              lessonType: lesson.lessonType,
              estimatedDurationMinutes: lesson.estimatedDurationMinutes,
              resourceUrl: lesson.resourceUrl,
              attachmentMetadata: lesson.attachmentMetadata,
              embeddedContentMetadata: lesson.embeddedContentMetadata,
              completionRequired: lesson.completionRequired,
              displayOrder: lesson.displayOrder,
              status: lesson.status,
            })),
            resources: weeklyModule.resources.map((resource) => ({
              id: resource.id,
              title: resource.title,
              resourceType: resource.resourceType,
              url: resource.url,
              author: resource.author,
              provider: resource.provider,
              estimatedDurationMinutes: resource.estimatedDurationMinutes,
              notes: resource.notes,
              isRequired: resource.isRequired,
              displayOrder: resource.displayOrder,
              status: resource.status,
            })),
            practicalTasks: weeklyModule.practicalTasks.map((task) => ({
              id: task.id,
              title: task.title,
              description: task.description,
              instructions: task.instructions,
              deliverables: task.deliverables,
              dueOffsetDays: task.dueOffsetDays,
              rubricMetadata: task.rubricMetadata,
              maxScore: task.maxScore,
              displayOrder: task.displayOrder,
              status: task.status,
            })),
          })),
        })),
      })),
    };
  }
}
