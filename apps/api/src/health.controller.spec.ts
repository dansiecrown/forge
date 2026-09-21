import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from './database/prisma.service';
import { HealthController } from './health.controller';

/** Milestone 8 production hardening: `check()` (liveness) must never touch
 * the database — verified here by using a Prisma stub that would throw if
 * called, so a passing `check()` test proves it genuinely never queries.
 * `ready()` (readiness) is the one that does, and must fail loudly (503,
 * not a swallowed error) when the database is unreachable. */
describe('HealthController', () => {
  function controllerWith(prisma: {
    $queryRaw: (...args: unknown[]) => unknown;
  }): HealthController {
    return new HealthController(prisma as unknown as PrismaService);
  }

  it('liveness never queries the database', async () => {
    const prisma = {
      $queryRaw: jest.fn(() => {
        throw new Error('should never be called by liveness');
      }),
    };
    const controller = controllerWith(prisma);
    expect(controller.check()).toEqual({ status: 'ok', service: 'forge-api' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('readiness reports ok when the database responds', async () => {
    const prisma = { $queryRaw: jest.fn(async () => [{ '?column?': 1 }]) };
    const controller = controllerWith(prisma);
    await expect(controller.ready()).resolves.toEqual({ status: 'ok', service: 'forge-api' });
  });

  it('readiness throws 503 when the database is unreachable', async () => {
    const prisma = {
      $queryRaw: jest.fn(async () => {
        throw new Error('Can not reach database server');
      }),
    };
    const controller = controllerWith(prisma);
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
