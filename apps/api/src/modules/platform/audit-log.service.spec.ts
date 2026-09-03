import { AuditLogRepository } from './repositories/audit-log.repository';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  it('swallows a write failure rather than throwing', async () => {
    const repository: Partial<AuditLogRepository> = {
      create: jest.fn(async () => {
        throw new Error('db unavailable');
      }),
    };
    const service = new AuditLogService(repository as AuditLogRepository);

    await expect(
      service.record({ action: 'x', entityType: 'x', outcome: 'success' }),
    ).resolves.toBeUndefined();
  });

  it('search delegates to the repository and shapes a CollectionResult page', async () => {
    const rows = [
      { id: 'log-2', occurredAt: new Date() },
      { id: 'log-1', occurredAt: new Date() },
    ];
    const repository: Partial<AuditLogRepository> = {
      list: jest.fn(async () => ({ rows, hasMore: true }) as never),
    };
    const service = new AuditLogService(repository as AuditLogRepository);

    const result = await service.search({ organizationId: 'org-1', limit: 2 });
    expect(result.items).toBe(rows);
    expect(result.page).toMatchObject({ hasMore: true, nextCursor: 'log-1' });
  });
});
