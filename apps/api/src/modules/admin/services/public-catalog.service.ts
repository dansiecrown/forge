import { Injectable } from '@nestjs/common';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import {
  PublicCatalogRepository,
  type PublicCatalogFellowship,
} from '../repositories/public-catalog.repository';

@Injectable()
export class PublicCatalogService {
  constructor(private readonly publicCatalogRepository: PublicCatalogRepository) {}

  async listPublicFellowships(options: {
    cursor?: string;
    limit?: string;
  }): Promise<CollectionResult<PublicCatalogFellowship>> {
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.publicCatalogRepository.listPublicFellowships({
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows, {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }
}
