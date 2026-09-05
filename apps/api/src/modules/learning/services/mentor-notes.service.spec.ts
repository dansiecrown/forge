import type { MentorNote } from '@prisma/client';
import type { FellowshipTrackMentorsService } from '../../catalog/services/fellowship-track-mentors.service';
import type { CohortsService } from '../../cohorts/services/cohorts.service';
import type { EnrollmentEntity } from '../../cohorts/entities/enrollment.entity';
import type { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import {
  MentorNoteVersionConflictError,
  type MentorNotesRepository,
} from '../repositories/mentor-notes.repository';
import { MentorNotesService } from './mentor-notes.service';

const SCOPE = { organizationId: 'org-1' };

function fakeNote(overrides: Partial<MentorNote> = {}): MentorNote {
  return {
    id: 'note-1',
    organizationId: 'org-1',
    cohortId: 'cohort-1',
    enrollmentId: 'enrollment-1',
    authorMembershipId: 'membership-1',
    body: 'Doing great this week.',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildService(options: {
  note?: MentorNote | null;
  mentorAssignedToCohort?: boolean;
  canManageAnyEnrollment?: boolean;
  hasMembership?: boolean;
  updateThrows?: MentorNoteVersionConflictError;
}) {
  const mentorNotesRepository = {
    list: jest.fn(async () => [fakeNote()]),
    findById: jest.fn(async () => (options.note === undefined ? fakeNote() : options.note)),
    create: jest.fn(async (_scope, data) => fakeNote(data)),
    update: jest.fn(async (_scope, id, body) => {
      if (options.updateThrows) throw options.updateThrows;
      return fakeNote({ id, body, version: 2 });
    }),
    softDelete: jest.fn(async () => {
      if (options.updateThrows) throw options.updateThrows;
    }),
  } as unknown as MentorNotesRepository;

  const enrollmentsService = {
    get: jest.fn(
      async () =>
        ({ id: 'enrollment-1', userId: 'student-1', cohortId: 'cohort-1' }) as EnrollmentEntity,
    ),
  } as unknown as EnrollmentsService;

  const cohortsService = {
    hasActiveMentorAssignment: jest.fn(async () => options.mentorAssignedToCohort ?? true),
  } as unknown as CohortsService;

  const membershipsService = {
    getActiveMembership: jest.fn(async () =>
      (options.hasMembership ?? true) ? ({ id: 'membership-1' } as never) : null,
    ),
  } as unknown as MembershipsService;

  const permissionResolver = {
    hasPermission: jest.fn(async () => options.canManageAnyEnrollment ?? false),
  } as unknown as PermissionResolverService;

  const auditLog = { record: jest.fn(async () => undefined) } as unknown as AuditLogService;

  const fellowshipTrackMentorsService = {
    listActiveAssignmentsForMembership: jest.fn(async () => []),
  } as unknown as FellowshipTrackMentorsService;

  const service = new MentorNotesService(
    mentorNotesRepository,
    enrollmentsService,
    cohortsService,
    membershipsService,
    permissionResolver,
    auditLog,
    fellowshipTrackMentorsService,
  );
  return { service, mentorNotesRepository, auditLog };
}

describe('MentorNotesService.create', () => {
  it('rejects a mentor not assigned to the students cohort', async () => {
    const { service } = buildService({
      mentorAssignedToCohort: false,
      canManageAnyEnrollment: false,
    });
    await expect(
      service.create(SCOPE, 'enrollment-1', 'Some note', 'mentor-1'),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  });

  it('creates the note attributed to the callers membership and audit-logs it', async () => {
    const { service, mentorNotesRepository, auditLog } = buildService({});
    await service.create(SCOPE, 'enrollment-1', 'Some note', 'mentor-1');
    expect(mentorNotesRepository.create).toHaveBeenCalledWith(SCOPE, {
      cohortId: 'cohort-1',
      enrollmentId: 'enrollment-1',
      authorMembershipId: 'membership-1',
      body: 'Some note',
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mentor_note.created' }),
    );
  });
});

describe('MentorNotesService.update / delete — team-visible, not author-only', () => {
  it('lets any mentor assigned to the cohort edit a note authored by a different mentor', async () => {
    const { service } = buildService({
      note: fakeNote({ authorMembershipId: 'membership-2' }),
    });
    await expect(
      service.update(SCOPE, 'note-1', 'Edited body', 1, 'mentor-1'),
    ).resolves.toMatchObject({ body: 'Edited body' });
  });

  it('soft-deletes and audit-logs', async () => {
    const { service, mentorNotesRepository, auditLog } = buildService({});
    await service.delete(SCOPE, 'note-1', 1, 'mentor-1');
    expect(mentorNotesRepository.softDelete).toHaveBeenCalledWith(SCOPE, 'note-1', 1);
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mentor_note.deleted' }),
    );
  });

  it('maps a version conflict to VERSION_CONFLICT', async () => {
    const { service } = buildService({ updateThrows: new MentorNoteVersionConflictError(3) });
    await expect(
      service.update(SCOPE, 'note-1', 'Edited body', 1, 'mentor-1'),
    ).rejects.toMatchObject({ response: { code: 'VERSION_CONFLICT' } });
  });

  it('rejects mutation from a mentor not assigned to this note’s cohort', async () => {
    const { service } = buildService({
      mentorAssignedToCohort: false,
      canManageAnyEnrollment: false,
    });
    await expect(
      service.update(SCOPE, 'note-1', 'Edited body', 1, 'mentor-1'),
    ).rejects.toMatchObject({ response: { code: 'PERMISSION_DENIED' } });
  });
});
