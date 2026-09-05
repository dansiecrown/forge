import type { CohortsService } from '../../cohorts/services/cohorts.service';
import type { FellowshipsService } from '../../catalog/services/fellowships.service';
import { AdminFellowshipsService } from './admin-fellowships.service';

const SCOPE = { organizationId: 'org-1' };

function fakeCollection(items: unknown[]) {
  return { items, page: { nextCursor: null, previousCursor: null, limit: 25, hasMore: false } };
}

describe('AdminFellowshipsService', () => {
  it('blocks retiring a fellowship that has a non-terminal cohort', async () => {
    const cohortsService: Partial<CohortsService> = {
      list: jest.fn(
        async (_scope, options) =>
          (options.status === 'active'
            ? fakeCollection([{ id: 'cohort-1' }])
            : fakeCollection([])) as never,
      ),
    };
    const fellowshipsService: Partial<FellowshipsService> = { retire: jest.fn() };
    const service = new AdminFellowshipsService(
      fellowshipsService as FellowshipsService,
      cohortsService as CohortsService,
    );

    await expect(
      service.retireWithValidation(SCOPE, 'fellowship-1', 1, 'actor-1'),
    ).rejects.toMatchObject({ response: { code: 'FELLOWSHIP_HAS_ACTIVE_COHORTS' } });
    expect(fellowshipsService.retire).not.toHaveBeenCalled();
  });

  it('retires a fellowship whose cohorts are all terminal', async () => {
    const cohortsService: Partial<CohortsService> = {
      list: jest.fn(async () => fakeCollection([]) as never),
    };
    const fellowshipsService: Partial<FellowshipsService> = {
      retire: jest.fn(async () => ({ id: 'fellowship-1', status: 'retired' }) as never),
    };
    const service = new AdminFellowshipsService(
      fellowshipsService as FellowshipsService,
      cohortsService as CohortsService,
    );

    const result = await service.retireWithValidation(SCOPE, 'fellowship-1', 1, 'actor-1');
    expect(result).toMatchObject({ status: 'retired' });
    expect(fellowshipsService.retire).toHaveBeenCalledWith(SCOPE, 'fellowship-1', 1, 'actor-1');
  });
});
