import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import {
  CreatePortfolioProjectDto,
  UpdatePortfolioProjectDto,
} from '../dtos/portfolio-project.dto';
import { CurriculumTransitionDto } from '../../catalog/dtos/curriculum-shared.dto';
import { PortfolioProjectsService } from '../services/portfolio-projects.service';

@Controller()
export class PortfolioController {
  constructor(private readonly portfolioProjectsService: PortfolioProjectsService) {}

  @Get('enrollments/:id/portfolio-projects')
  @RequirePermissions('learning.portfolio.manage')
  list(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.portfolioProjectsService.list(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  /** Kept separate from the student-facing route above rather than changing
   * `PermissionsGuard`'s all-required-permissions semantics to support an
   * "either/or" permission check — lower risk, same outcome. */
  @Get('mentors/students/:id/portfolio-projects')
  @RequirePermissions('mentor.workspace.read')
  listForMentor(
    @Param('id') id: string,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.portfolioProjectsService.listForMentor(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      user.id,
    );
  }

  @Post('enrollments/:id/portfolio-projects')
  @RequirePermissions('learning.portfolio.manage')
  create(
    @Param('id') id: string,
    @Body() dto: CreatePortfolioProjectDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.portfolioProjectsService.create(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto,
      user.id,
    );
  }

  @Patch('portfolio-projects/:projectId')
  @RequirePermissions('learning.portfolio.manage')
  update(
    @Param('projectId') projectId: string,
    @Body() dto: UpdatePortfolioProjectDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.portfolioProjectsService.update(
      { organizationId: requireOrganizationId(organizationId) },
      projectId,
      dto,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Delete('portfolio-projects/:projectId')
  @RequirePermissions('learning.portfolio.manage')
  delete(
    @Param('projectId') projectId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.portfolioProjectsService.delete(
      { organizationId: requireOrganizationId(organizationId) },
      projectId,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Post('portfolio-projects/:projectId/actions/publish')
  @RequirePermissions('learning.portfolio.manage')
  publish(
    @Param('projectId') projectId: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.portfolioProjectsService.publish(
      { organizationId: requireOrganizationId(organizationId) },
      projectId,
      dto.version,
      user.id,
    );
  }

  @Post('portfolio-projects/:projectId/actions/unpublish')
  @RequirePermissions('learning.portfolio.manage')
  unpublish(
    @Param('projectId') projectId: string,
    @Body() dto: CurriculumTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.portfolioProjectsService.unpublish(
      { organizationId: requireOrganizationId(organizationId) },
      projectId,
      dto.version,
      user.id,
    );
  }
}
