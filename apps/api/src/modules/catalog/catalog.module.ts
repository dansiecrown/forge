import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PlatformModule } from '../platform/platform.module';
import { FellowshipsController } from './controllers/fellowships.controller';
import { FellowshipsRepository } from './repositories/fellowships.repository';
import { FellowshipsService } from './services/fellowships.service';

/** Owns fellowships (the reusable programme template) — courses, curriculum
 * modules, weeks, lessons and resources are catalog's documented territory
 * too (docs/project-structure.md §"api modules") but are out of scope for
 * Milestone 3 ("No coursework yet"). */
@Module({
  imports: [OrganizationsModule, PlatformModule],
  controllers: [FellowshipsController],
  providers: [FellowshipsRepository, FellowshipsService],
  exports: [FellowshipsService],
})
export class CatalogModule {}
