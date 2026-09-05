import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformModule } from '../platform/platform.module';
import { CohortsController } from './controllers/cohorts.controller';
import { EnrollmentsController } from './controllers/enrollments.controller';
import { CohortsRepository } from './repositories/cohorts.repository';
import { EnrollmentsRepository } from './repositories/enrollments.repository';
import { CohortsService } from './services/cohorts.service';
import { EnrollmentsService } from './services/enrollments.service';

/** Owns cohorts (dated, capacity-bound delivery runs) and enrollment
 * relationships. Mentor huddles/attendance are cohorts' documented territory
 * too (docs/project-structure.md §"api modules") but out of scope for
 * Milestone 3 ("No attendance yet"). */
@Module({
  imports: [CatalogModule, OrganizationsModule, PlatformModule],
  controllers: [CohortsController, EnrollmentsController],
  providers: [CohortsRepository, EnrollmentsRepository, CohortsService, EnrollmentsService],
  exports: [CohortsService, EnrollmentsService],
})
export class CohortsModule {}
