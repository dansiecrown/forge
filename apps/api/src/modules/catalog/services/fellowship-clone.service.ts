import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AcademiesService } from '../../organizations/services/academies.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toFellowshipEntity, type FellowshipEntity } from '../entities/fellowship.entity';
import { CurriculumSnapshotService } from './curriculum-snapshot.service';
import { FellowshipsService } from './fellowships.service';

export interface CloneFellowshipInput {
  title: string;
  slug: string;
  academyId?: string;
}

/** Duplicates a fellowship's curriculum tree into a brand-new draft
 * fellowship. Reuses `CurriculumSnapshotService.build()`'s existing,
 * unmodified read (the tree-walk shape) as the source, then — inside one
 * transaction — creates a fresh row per node with new ids, always landing
 * the clone in `draft` regardless of the source's status (a clone never
 * inherits "published," so nothing can accidentally look live before an
 * admin reviews it). Stays entirely inside `catalog` — Fellowship and the
 * whole curriculum tree it clones are both owned here, no cross-chain
 * composition needed. See docs/adr/0009-administration-platform.md. */
@Injectable()
export class FellowshipCloneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fellowshipsService: FellowshipsService,
    private readonly academiesService: AcademiesService,
    private readonly curriculumSnapshotService: CurriculumSnapshotService,
    private readonly auditLog: AuditLogService,
  ) {}

  async clone(
    scope: TenantScope,
    sourceFellowshipId: string,
    input: CloneFellowshipInput,
    actorUserId: string,
  ): Promise<FellowshipEntity> {
    const source = await this.fellowshipsService.get(scope, sourceFellowshipId, actorUserId);
    // A restricted caller (e.g. ACADEMY_ADMIN) may only clone into their own
    // academy — an explicit override target is validated the same way
    // `FellowshipsService.create` validates `input.academyId`.
    if (input.academyId) {
      await this.academiesService.assertBelongsToScope(scope, input.academyId, actorUserId);
    }
    const academyId = input.academyId ?? source.academyId;

    const existingSlug = await this.prisma.fellowship.findFirst({
      where: { organizationId: scope.organizationId, academyId, slug: input.slug },
    });
    if (existingSlug) {
      throw AppException.conflict(
        'SLUG_TAKEN',
        'This fellowship slug is already in use in this academy.',
      );
    }

    const snapshot = await this.curriculumSnapshotService.build(scope, sourceFellowshipId);

    const cloned = await this.prisma.$transaction(async (tx) => {
      const fellowship = await tx.fellowship.create({
        data: {
          organizationId: scope.organizationId,
          academyId,
          title: input.title,
          slug: input.slug,
          status: 'draft',
          durationWeeks: source.durationWeeks,
          description: source.description,
          summary: source.summary,
          defaultCapacity: source.defaultCapacity,
          isPublic: false,
          eligibilityMetadata: source.eligibilityMetadata as never,
        },
      });

      for (const track of snapshot.tracks) {
        const newTrack = await tx.learningTrack.create({
          data: {
            organizationId: scope.organizationId,
            fellowshipId: fellowship.id,
            name: track.name,
            slug: track.slug,
            description: track.description,
            difficulty: track.difficulty as never,
            estimatedWeeks: track.estimatedWeeks,
            learningOutcomes: track.learningOutcomes,
            status: 'draft',
            displayOrder: track.displayOrder,
          },
        });

        for (const course of track.courses) {
          const newCourse = await tx.course.create({
            data: {
              organizationId: scope.organizationId,
              learningTrackId: newTrack.id,
              title: course.title,
              slug: course.slug,
              status: 'draft',
              displayOrder: course.displayOrder,
            },
          });

          for (const weeklyModule of course.weeklyModules) {
            const newModule = await tx.weeklyModule.create({
              data: {
                organizationId: scope.organizationId,
                courseId: newCourse.id,
                weekNumber: weeklyModule.weekNumber,
                title: weeklyModule.title,
                objectives: weeklyModule.objectives,
                summary: weeklyModule.summary,
                estimatedStudyHours: weeklyModule.estimatedStudyHours,
                status: 'draft',
                requiresMentorHuddle: weeklyModule.requiresMentorHuddle,
                requiresPracticalWork: weeklyModule.requiresPracticalWork,
                unlockRules: weeklyModule.unlockRules as never,
                huddleScheduleMetadata: weeklyModule.huddleScheduleMetadata as never,
                huddleMeetingLink: weeklyModule.huddleMeetingLink,
                mentorHuddleNotes: weeklyModule.mentorHuddleNotes,
                huddleAttendanceRequired: weeklyModule.huddleAttendanceRequired,
              },
            });

            if (weeklyModule.lessons.length > 0) {
              await tx.lesson.createMany({
                data: weeklyModule.lessons.map((lesson) => ({
                  organizationId: scope.organizationId,
                  weeklyModuleId: newModule.id,
                  title: lesson.title,
                  description: lesson.description,
                  lessonType: lesson.lessonType as never,
                  estimatedDurationMinutes: lesson.estimatedDurationMinutes,
                  resourceUrl: lesson.resourceUrl,
                  attachmentMetadata: lesson.attachmentMetadata as never,
                  embeddedContentMetadata: lesson.embeddedContentMetadata as never,
                  completionRequired: lesson.completionRequired,
                  displayOrder: lesson.displayOrder,
                  status: 'draft',
                })),
              });
            }

            if (weeklyModule.resources.length > 0) {
              await tx.learningResource.createMany({
                data: weeklyModule.resources.map((resource) => ({
                  organizationId: scope.organizationId,
                  weeklyModuleId: newModule.id,
                  title: resource.title,
                  resourceType: resource.resourceType as never,
                  url: resource.url,
                  author: resource.author,
                  provider: resource.provider,
                  estimatedDurationMinutes: resource.estimatedDurationMinutes,
                  notes: resource.notes,
                  isRequired: resource.isRequired,
                  displayOrder: resource.displayOrder,
                  status: 'draft',
                })),
              });
            }

            if (weeklyModule.practicalTasks.length > 0) {
              await tx.practicalTask.createMany({
                data: weeklyModule.practicalTasks.map((task) => ({
                  organizationId: scope.organizationId,
                  weeklyModuleId: newModule.id,
                  title: task.title,
                  description: task.description,
                  instructions: task.instructions,
                  deliverables: task.deliverables,
                  dueOffsetDays: task.dueOffsetDays,
                  rubricMetadata: task.rubricMetadata as never,
                  maxScore: task.maxScore,
                  displayOrder: task.displayOrder,
                  status: 'draft',
                })),
              });
            }
          }
        }
      }

      return fellowship;
    });

    await this.auditLog.record({
      action: 'fellowship.duplicated',
      entityType: 'fellowship',
      entityId: cloned.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { sourceFellowshipId },
    });

    return toFellowshipEntity(cloned);
  }
}
