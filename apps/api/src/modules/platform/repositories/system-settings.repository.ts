import { Injectable } from '@nestjs/common';
import type { Prisma, SystemSettings } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

const SINGLETON_ID = 'global';

@Injectable()
export class SystemSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The migration seeds the singleton row, but `upsert` keeps `get()` safe
   * even against a database that skipped that seed (e.g. a fresh test DB). */
  get(): Promise<SystemSettings> {
    return this.prisma.systemSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  }

  async update(
    data: Prisma.SystemSettingsUpdateInput,
    expectedVersion: number,
  ): Promise<SystemSettings> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.systemSettings.upsert({
        where: { id: SINGLETON_ID },
        update: {},
        create: { id: SINGLETON_ID },
      });
      if (current.version !== expectedVersion) {
        throw new SystemSettingsVersionConflictError(current.version);
      }
      return tx.systemSettings.update({
        where: { id: SINGLETON_ID },
        data: { ...data, version: { increment: 1 } },
      });
    });
  }
}

export class SystemSettingsVersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('System settings have been modified since they were last read.');
  }
}
