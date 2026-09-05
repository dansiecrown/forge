import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { AcademiesController } from './controllers/academies.controller';
import { MembershipsController } from './controllers/memberships.controller';
import { OrganizationsController } from './controllers/organizations.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { RolesController } from './controllers/roles.controller';
import { AcademiesRepository } from './repositories/academies.repository';
import { MembershipsRepository } from './repositories/memberships.repository';
import { OrganizationsRepository } from './repositories/organizations.repository';
import { PermissionsRepository } from './repositories/permissions.repository';
import { RolesRepository } from './repositories/roles.repository';
import { AcademiesService } from './services/academies.service';
import { MembershipsService } from './services/memberships.service';
import { OrganizationsService } from './services/organizations.service';
import { PermissionResolverService } from './services/permission-resolver.service';
import { PermissionsService } from './services/permissions.service';
import { RolesService } from './services/roles.service';

/** Only services are exported — repositories stay module-private per
 * docs/project-structure.md §6. Other modules must go through
 * MembershipsService/PermissionResolverService/AcademiesService/
 * OrganizationsService, never the repositories directly. */
@Module({
  imports: [PlatformModule],
  controllers: [
    RolesController,
    PermissionsController,
    MembershipsController,
    OrganizationsController,
    AcademiesController,
  ],
  providers: [
    RolesRepository,
    PermissionsRepository,
    MembershipsRepository,
    OrganizationsRepository,
    AcademiesRepository,
    RolesService,
    PermissionsService,
    MembershipsService,
    OrganizationsService,
    AcademiesService,
    PermissionResolverService,
  ],
  exports: [MembershipsService, PermissionResolverService, AcademiesService, OrganizationsService],
})
export class OrganizationsModule {}
