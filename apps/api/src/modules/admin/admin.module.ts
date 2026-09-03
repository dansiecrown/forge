import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CohortsModule } from '../cohorts/cohorts.module';
import { IdentityModule } from '../identity/identity.module';
import { LearningModule } from '../learning/learning.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformModule } from '../platform/platform.module';
import { AdminAcademiesController } from './controllers/admin-academies.controller';
import { AdminAnnouncementsController } from './controllers/admin-announcements.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import {
  AdminCertificateEligibilityController,
  AdminCertificatesController,
} from './controllers/admin-certificates.controller';
import { AdminCohortApplicationsController } from './controllers/admin-cohort-applications.controller';
import { AdminCohortsController } from './controllers/admin-cohorts.controller';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminFellowshipsController } from './controllers/admin-fellowships.controller';
import { AdminOrganizationsController } from './controllers/admin-organizations.controller';
import { AdminReportsController } from './controllers/admin-reports.controller';
import {
  AdminSettingsController,
  PublicSettingsController,
} from './controllers/admin-settings.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { CertificateVerificationController } from './controllers/certificate-verification.controller';
import {
  CohortApplicationsController,
  PublicCohortApplicationsController,
} from './controllers/cohort-applications.controller';
import { PublicCatalogController } from './controllers/public-catalog.controller';
import { AdminStatsRepository } from './repositories/admin-stats.repository';
import { AdminUsersRepository } from './repositories/admin-users.repository';
import { AnnouncementsRepository } from './repositories/announcements.repository';
import { CertificateTemplatesRepository } from './repositories/certificate-templates.repository';
import { CertificatesRepository } from './repositories/certificates.repository';
import { CohortApplicationsRepository } from './repositories/cohort-applications.repository';
import { PublicCatalogRepository } from './repositories/public-catalog.repository';
import { AdminAcademiesService } from './services/admin-academies.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminCohortsService } from './services/admin-cohorts.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminFellowshipsService } from './services/admin-fellowships.service';
import { AdminReportsService } from './services/admin-reports.service';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminUsersService } from './services/admin-users.service';
import { AnnouncementsService } from './services/announcements.service';
import { CertificatesService } from './services/certificates.service';
import { CohortApplicationsService } from './services/cohort-applications.service';
import { PublicCatalogService } from './services/public-catalog.service';

/** New cross-cutting module — the deepest leaf in the module chain
 * (`organizations -> catalog -> cohorts -> learning`, now
 * `-> admin` one level deeper). A capability lives here iff it needs to
 * read/orchestrate across two modules where the natural owner can't import
 * the other without inverting the chain (e.g. Academy/Fellowship
 * archive-validation, which needs `catalog`/`cohorts` data from inside
 * `organizations`/`catalog`). Otherwise it's added directly to the owning
 * module — see the placement-rule comment in
 * docs/adr/0009-administration-platform.md §0. */
@Module({
  imports: [
    OrganizationsModule,
    CatalogModule,
    CohortsModule,
    LearningModule,
    IdentityModule,
    PlatformModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminOrganizationsController,
    AdminAcademiesController,
    AdminFellowshipsController,
    AdminCohortsController,
    AdminReportsController,
    AdminAuditController,
    AdminAnnouncementsController,
    AdminCertificatesController,
    AdminCertificateEligibilityController,
    CertificateVerificationController,
    AdminSettingsController,
    PublicSettingsController,
    AdminCohortApplicationsController,
    CohortApplicationsController,
    PublicCohortApplicationsController,
    PublicCatalogController,
  ],
  providers: [
    AdminStatsRepository,
    AdminUsersRepository,
    AnnouncementsRepository,
    CertificateTemplatesRepository,
    CertificatesRepository,
    CohortApplicationsRepository,
    PublicCatalogRepository,
    AdminDashboardService,
    AdminUsersService,
    AdminAcademiesService,
    AdminFellowshipsService,
    AdminCohortsService,
    AdminReportsService,
    AdminAuditService,
    AnnouncementsService,
    CertificatesService,
    AdminSettingsService,
    CohortApplicationsService,
    PublicCatalogService,
  ],
})
export class AdminModule {}
