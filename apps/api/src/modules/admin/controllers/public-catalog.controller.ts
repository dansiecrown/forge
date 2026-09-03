import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../../decorators/public.decorator';
import { PublicCatalogService } from '../services/public-catalog.service';

/** Genuinely cross-tenant, unauthenticated — no `X-Organization-Id`, no
 * session. A prospect browsing the public catalog has no organization
 * context yet; see docs/adr/0010-cohort-applications.md. */
@Controller('public/fellowships')
export class PublicCatalogController {
  constructor(private readonly publicCatalogService: PublicCatalogService) {}

  @Get()
  @Public()
  list(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.publicCatalogService.listPublicFellowships({ cursor, limit });
  }
}
