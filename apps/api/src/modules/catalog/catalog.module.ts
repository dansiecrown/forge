import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformModule } from '../platform/platform.module';
import { FellowshipsController } from './controllers/fellowships.controller';
import { LearningTracksController } from './controllers/learning-tracks.controller';
import { CoursesController } from './controllers/courses.controller';
import { WeeklyModulesController } from './controllers/weekly-modules.controller';
import { LessonsController } from './controllers/lessons.controller';
import { LearningResourcesController } from './controllers/learning-resources.controller';
import { PracticalTasksController } from './controllers/practical-tasks.controller';
import { FellowshipsRepository } from './repositories/fellowships.repository';
import { LearningTracksRepository } from './repositories/learning-tracks.repository';
import { CoursesRepository } from './repositories/courses.repository';
import { WeeklyModulesRepository } from './repositories/weekly-modules.repository';
import { LessonsRepository } from './repositories/lessons.repository';
import { LearningResourcesRepository } from './repositories/learning-resources.repository';
import { PracticalTasksRepository } from './repositories/practical-tasks.repository';
import { FellowshipsService } from './services/fellowships.service';
import { LearningTracksService } from './services/learning-tracks.service';
import { CoursesService } from './services/courses.service';
import { WeeklyModulesService } from './services/weekly-modules.service';
import { LessonsService } from './services/lessons.service';
import { LearningResourcesService } from './services/learning-resources.service';
import { PracticalTasksService } from './services/practical-tasks.service';
import { CurriculumSnapshotService } from './services/curriculum-snapshot.service';
import { FellowshipCloneService } from './services/fellowship-clone.service';

/** Owns fellowships (the reusable programme template) and, since Milestone
 * 4, the full curriculum tree beneath it — Learning Track, Course, Weekly
 * Module, Lesson, Learning Resource, Practical Task
 * (docs/project-structure.md §"api modules": "catalog owns fellowships,
 * courses, curriculum modules, weeks, lessons, and resources"). See
 * docs/adr/0006-curriculum-learning-engine.md for how this milestone's
 * shape reconciles with that doc's fuller (versioned, Module+Week,
 * graded-Assignment) design. */
@Module({
  imports: [OrganizationsModule, PlatformModule, ChatModule],
  controllers: [
    FellowshipsController,
    LearningTracksController,
    CoursesController,
    WeeklyModulesController,
    LessonsController,
    LearningResourcesController,
    PracticalTasksController,
  ],
  providers: [
    FellowshipsRepository,
    LearningTracksRepository,
    CoursesRepository,
    WeeklyModulesRepository,
    LessonsRepository,
    LearningResourcesRepository,
    PracticalTasksRepository,
    FellowshipsService,
    LearningTracksService,
    CoursesService,
    WeeklyModulesService,
    LessonsService,
    LearningResourcesService,
    PracticalTasksService,
    CurriculumSnapshotService,
    FellowshipCloneService,
  ],
  exports: [
    FellowshipsService,
    LearningTracksService,
    CoursesService,
    WeeklyModulesService,
    LessonsService,
    LearningResourcesService,
    PracticalTasksService,
    CurriculumSnapshotService,
  ],
})
export class CatalogModule {}
