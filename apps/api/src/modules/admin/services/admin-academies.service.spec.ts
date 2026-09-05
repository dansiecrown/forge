import type { AcademiesService } from '../../organizations/services/academies.service';
import type { FellowshipsService } from '../../catalog/services/fellowships.service';
import type { AdminStatsRepository } from '../repositories/admin-stats.repository';
import { AdminAcademiesService } from './admin-academies.service';

const SCOPE = { organizationId: 'org-1' };

function fakeCollection(items: unknown[]) {
  return { items, page: { nextCursor: null, previousCursor: null, limit: 25, hasMore: false } };
}

describe('AdminAcademiesService', () => {
  it('blocks archiving an academy that has a published fellowship', async () => {
    const fellowshipsService: Partial<FellowshipsService> = {
      list: jest.fn(async () => fakeCollection([{ id: 'fellowship-1' }]) as never),
    };
    const academiesService: Partial<AcademiesService> = { archive: jest.fn() };
    const service = new AdminAcademiesService(
      academiesService as AcademiesService,
      fellowshipsService as FellowshipsService,
      {} as AdminStatsRepository,
    );

    await expect(
      service.archiveWithValidation(SCOPE, 'academy-1', 'actor-1'),
    ).rejects.toMatchObject({ response: { code: 'ACADEMY_HAS_ACTIVE_FELLOWSHIPS' } });
    expect(academiesService.archive).not.toHaveBeenCalled();
  });

  it('archives an academy with no published fellowships', async () => {
    const fellowshipsService: Partial<FellowshipsService> = {
      list: jest.fn(async () => fakeCollection([]) as never),
    };
    const academiesService: Partial<AcademiesService> = {
      archive: jest.fn(async () => ({ id: 'academy-1', status: 'archived' }) as never),
    };
    const service = new AdminAcademiesService(
      academiesService as AcademiesService,
      fellowshipsService as FellowshipsService,
      {} as AdminStatsRepository,
    );

    const result = await service.archiveWithValidation(SCOPE, 'academy-1', 'actor-1');
    expect(result).toMatchObject({ status: 'archived' });
    expect(academiesService.archive).toHaveBeenCalledWith(SCOPE, 'academy-1', 'actor-1');
  });
});
