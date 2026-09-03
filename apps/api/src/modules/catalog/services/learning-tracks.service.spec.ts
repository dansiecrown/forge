import type { LearningTrack } from '@prisma/client';
import type { FellowshipEntity } from '../entities/fellowship.entity';
import type { FellowshipsService } from './fellowships.service';
import type { AuditLogService } from '../../platform/audit-log.service';
import { LearningTracksRepository } from '../repositories/learning-tracks.repository';
import { LearningTracksService } from './learning-tracks.service';

function fakeTrack(overrides: Partial<LearningTrack> = {}): LearningTrack {
  return {
    id: 'track-1',
    organizationId: 'org-1',
    fellowshipId: 'fellowship-1',
    name: 'Web Development',
    slug: 'web-development',
    description: null,
    iconMetadata: null,
    difficulty: 'beginner',
    estimatedWeeks: null,
    status: 'draft',
    displayOrder: 0,
    prerequisitesMetadata: null,
    learningOutcomes: [],
    tags: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function fakeFellowshipsService(): FellowshipsService {
  return {
    get: jest.fn(async () => ({ id: 'fellowship-1' }) as FellowshipEntity),
    assertExistsInOrg: jest.fn(async () => ({ id: 'fellowship-1' }) as FellowshipEntity),
  } as unknown as FellowshipsService;
}

function fakeAuditLog(): AuditLogService {
  return { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
}

describe('LearningTracksService', () => {
  it('treats a track from another organization as not found', async () => {
    const repository: Partial<LearningTracksRepository> = {
      findById: jest.fn(async (scope) => (scope.organizationId === 'org-1' ? fakeTrack() : null)),
    };
    const service = new LearningTracksService(
      repository as LearningTracksRepository,
      fakeFellowshipsService(),
      fakeAuditLog(),
    );

    await expect(service.get({ organizationId: 'org-2' }, 'track-1')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('rejects a duplicate slug within the same fellowship', async () => {
    const repository: Partial<LearningTracksRepository> = {
      findBySlug: jest.fn(async () => fakeTrack()),
    };
    const service = new LearningTracksService(
      repository as LearningTracksRepository,
      fakeFellowshipsService(),
      fakeAuditLog(),
    );

    await expect(
      service.create(
        { organizationId: 'org-1' },
        'fellowship-1',
        { name: 'Web Development', slug: 'web-development' },
        'user-1',
      ),
    ).rejects.toMatchObject({ response: { code: 'SLUG_TAKEN' } });
  });

  it('only allows draft -> published -> archived, never published -> draft', async () => {
    const repository: Partial<LearningTracksRepository> = {
      findById: jest.fn(async () => fakeTrack({ status: 'published' })),
      updateStatus: jest.fn(async () => fakeTrack({ status: 'archived', version: 2 })),
    };
    const service = new LearningTracksService(
      repository as LearningTracksRepository,
      fakeFellowshipsService(),
      fakeAuditLog(),
    );

    await expect(service.publish({ organizationId: 'org-1' }, 'track-1', 1)).rejects.toMatchObject({
      response: { code: 'INVALID_STATE_TRANSITION' },
    });
    await expect(service.archive({ organizationId: 'org-1' }, 'track-1', 1)).resolves.toMatchObject(
      { status: 'archived' },
    );
  });

  it('restores an archived track back to draft, not to its prior published state', async () => {
    const repository: Partial<LearningTracksRepository> = {
      findByIdIncludingArchived: jest.fn(async () => fakeTrack({ status: 'archived', version: 2 })),
      restore: jest.fn(async () => fakeTrack({ status: 'draft', version: 3 })),
    };
    const service = new LearningTracksService(
      repository as LearningTracksRepository,
      fakeFellowshipsService(),
      fakeAuditLog(),
    );

    await expect(service.restore({ organizationId: 'org-1' }, 'track-1', 2)).resolves.toMatchObject(
      { status: 'draft' },
    );
  });

  it('rejects a reorder request naming an id outside this fellowship', async () => {
    const repository: Partial<LearningTracksRepository> = {
      reorder: jest.fn(async () => {
        throw Object.assign(new Error('invalid'), {
          response: { code: 'VALIDATION_ERROR' },
        });
      }),
    };
    const service = new LearningTracksService(
      repository as LearningTracksRepository,
      fakeFellowshipsService(),
      fakeAuditLog(),
    );

    await expect(
      service.reorder({ organizationId: 'org-1' }, 'fellowship-1', [
        { id: 'not-in-this-fellowship', displayOrder: 0 },
      ]),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });
});
