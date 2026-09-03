import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CohortsModule } from '../cohorts/cohorts.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformModule } from '../platform/platform.module';
import { HuddleSessionsController } from './controllers/huddle-sessions.controller';
import { LearningProgressController } from './controllers/learning-progress.controller';
import { MentorNotesController } from './controllers/mentor-notes.controller';
import { MentorWorkspaceController } from './controllers/mentor-workspace.controller';
import { PortfolioController } from './controllers/portfolio.controller';
import { StudentCurriculumController } from './controllers/student-curriculum.controller';
import { SubmissionReviewsController } from './controllers/submission-reviews.controller';
import { HuddleAttendanceRepository } from './repositories/huddle-attendance.repository';
import { HuddleSessionsRepository } from './repositories/huddle-sessions.repository';
import { LessonCompletionsRepository } from './repositories/lesson-completions.repository';
import { MentorNotesRepository } from './repositories/mentor-notes.repository';
import { PortfolioProjectsRepository } from './repositories/portfolio-projects.repository';
import { PracticalTaskSubmissionsRepository } from './repositories/practical-task-submissions.repository';
import { ResourceAcknowledgmentsRepository } from './repositories/resource-acknowledgments.repository';
import { ResourceBookmarksRepository } from './repositories/resource-bookmarks.repository';
import { SubmissionReviewsRepository } from './repositories/submission-reviews.repository';
import { DeadlineService } from './services/deadline.service';
import { HuddleSessionsService } from './services/huddle-sessions.service';
import { MentorDashboardService } from './services/mentor-dashboard.service';
import { MentorNotesService } from './services/mentor-notes.service';
import { MentorWorkspaceService } from './services/mentor-workspace.service';
import { PortfolioProjectsService } from './services/portfolio-projects.service';
import { ProgressionService } from './services/progression.service';
import { StudentCurriculumService } from './services/student-curriculum.service';
import { SubmissionReviewsService } from './services/submission-reviews.service';

/** Owns learner progression — lesson completion, resource acknowledgment,
 * practical task submission, the sequential-unlock progression engine, and
 * (Milestone 5) the student-facing curriculum browsing, deadline
 * computation, bookmarks, and portfolio surface. The deepest module in the
 * dependency chain (organizations -> catalog -> cohorts -> learning), plus
 * `identity` for the one thing this module needs from it (the caller's
 * timezone, for streak computation) — a one-directional addition since
 * `identity` depends on nothing in this chain. */
@Module({
  imports: [CatalogModule, CohortsModule, IdentityModule, OrganizationsModule, PlatformModule],
  controllers: [
    LearningProgressController,
    StudentCurriculumController,
    PortfolioController,
    SubmissionReviewsController,
    HuddleSessionsController,
    MentorNotesController,
    MentorWorkspaceController,
  ],
  providers: [
    LessonCompletionsRepository,
    ResourceAcknowledgmentsRepository,
    PracticalTaskSubmissionsRepository,
    ResourceBookmarksRepository,
    PortfolioProjectsRepository,
    SubmissionReviewsRepository,
    HuddleSessionsRepository,
    HuddleAttendanceRepository,
    MentorNotesRepository,
    ProgressionService,
    DeadlineService,
    StudentCurriculumService,
    PortfolioProjectsService,
    SubmissionReviewsService,
    HuddleSessionsService,
    MentorNotesService,
    MentorWorkspaceService,
    MentorDashboardService,
  ],
  // MentorWorkspaceService is additionally exported (Milestone 7) so
  // AdminModule can reuse its cohort-roster/at-risk logic for Cohort
  // Management instead of re-implementing it — see
  // docs/adr/0009-administration-platform.md.
  exports: [ProgressionService, MentorWorkspaceService],
})
export class LearningModule {}
