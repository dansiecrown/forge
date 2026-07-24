import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { MembershipsController } from './controllers/memberships.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { RolesController } from './controllers/roles.controller';
import { MembershipsRepository } from './repositories/memberships.repository';
import { PermissionsRepository } from './repositories/permissions.repository';
import { RolesRepository } from './repositories/roles.repository';
import { MembershipsService } from './services/memberships.service';
import { PermissionResolverService } from './services/permission-resolver.service';
import { PermissionsService } from './services/permissions.service';
import { RolesService } from './services/roles.service';

/** Only services are exported — repositories stay module-private per
 * docs/project-structure.md §6. Other modules must go through
 * MembershipsService/PermissionResolverService, never the repositories
 * directly. */
@Module({
  imports: [PlatformModule],
  controllers: [RolesController, PermissionsController, MembershipsController],
  providers: [
    RolesRepository,
    PermissionsRepository,
    MembershipsRepository,
    RolesService,
    PermissionsService,
    MembershipsService,
    PermissionResolverService,
  ],
  exports: [MembershipsService, PermissionResolverService],
})
export class OrganizationsModule {}
