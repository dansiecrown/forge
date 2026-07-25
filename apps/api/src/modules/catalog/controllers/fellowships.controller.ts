import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ActiveOrganizationId } from '../../../decorators/active-organization-id.decorator';
import { CurrentUser } from '../../../decorators/current-user.decorator';
import { RequirePermissions } from '../../../decorators/require-permissions.decorator';
import { requireIfMatchVersion, requireOrganizationId } from '../../../shared/http/request-helpers';
import {
  CreateFellowshipDto,
  FellowshipTransitionDto,
  UpdateFellowshipDto,
} from '../dtos/fellowship.dto';
import { FellowshipsService } from '../services/fellowships.service';

@Controller()
export class FellowshipsController {
  constructor(private readonly fellowshipsService: FellowshipsService) {}

  @Get('fellowships')
  @RequirePermissions('fellowship.read')
  list(
    @ActiveOrganizationId() organizationId: string | undefined,
    @Query('academyId') academyId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fellowshipsService.list(
      { organizationId: requireOrganizationId(organizationId) },
      { academyId, status, q, cursor, limit },
    );
  }

  @Post('fellowships')
  @RequirePermissions('fellowship.create')
  create(
    @Body() dto: CreateFellowshipDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.fellowshipsService.create(
      { organizationId: requireOrganizationId(organizationId) },
      dto,
      user.id,
    );
  }

  @Get('fellowships/:id')
  @RequirePermissions('fellowship.read')
  get(@Param('id') id: string, @ActiveOrganizationId() organizationId: string | undefined) {
    return this.fellowshipsService.get(
      { organizationId: requireOrganizationId(organizationId) },
      id,
    );
  }

  @Patch('fellowships/:id')
  @RequirePermissions('fellowship.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFellowshipDto,
    @Headers('if-match') ifMatch: string | undefined,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.fellowshipsService.update(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto,
      requireIfMatchVersion(ifMatch),
      user.id,
    );
  }

  @Post('fellowships/:id/actions/publish')
  @RequirePermissions('fellowship.publish')
  publish(
    @Param('id') id: string,
    @Body() dto: FellowshipTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.fellowshipsService.publish(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }

  @Post('fellowships/:id/actions/retire')
  @RequirePermissions('fellowship.retire')
  retire(
    @Param('id') id: string,
    @Body() dto: FellowshipTransitionDto,
    @ActiveOrganizationId() organizationId: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.fellowshipsService.retire(
      { organizationId: requireOrganizationId(organizationId) },
      id,
      dto.version,
      user.id,
    );
  }
}
