import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { MembershipsController } from './controllers/memberships.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { RolesController } from './controllers/roles.controller';
import { MembershipsRepository } from './repositories/memberships.repository';
import { OrganizationsRepository } from './repositories/organizations.repository';
import { PermissionsRepository } from './repositories/permissions.repository';
import { RolesRepository } from './repositories/roles.repository';
import { MembershipsService } from './services/memberships.service';
import { PermissionResolverService } from './services/permission-resolver.service';
import { PermissionsService } from './services/permissions.service';
import { RolesService } from './services/roles.service';

@Module({
  imports: [PlatformModule],
  controllers: [RolesController, PermissionsController, MembershipsController],
  providers: [
    OrganizationsRepository,
    RolesRepository,
    PermissionsRepository,
    MembershipsRepository,
    RolesService,
    PermissionsService,
    MembershipsService,
    PermissionResolverService,
  ],
  exports: [
    MembershipsRepository,
    MembershipsService,
    PermissionResolverService,
    RolesRepository,
    OrganizationsRepository,
  ],
})
export class OrganizationsModule {}
