import { Injectable } from '@nestjs/common';
import type { Permission } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(resource?: string): Promise<Permission[]> {
    return this.prisma.permission.findMany({
      where: resource ? { resource } : undefined,
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  findByIds(ids: string[]): Promise<Permission[]> {
    return this.prisma.permission.findMany({ where: { id: { in: ids } } });
  }
}
