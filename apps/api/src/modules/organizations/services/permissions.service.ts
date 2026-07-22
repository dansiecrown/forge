import { Injectable } from '@nestjs/common';
import type { Permission } from '@prisma/client';
import { PermissionsRepository } from '../repositories/permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  list(resource?: string): Promise<Permission[]> {
    return this.permissionsRepository.list(resource);
  }
}
