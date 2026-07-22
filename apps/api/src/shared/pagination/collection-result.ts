export interface PageMeta {
  nextCursor: string | null;
  previousCursor: string | null;
  limit: number;
  hasMore: boolean;
}

/** Marks a service/controller return value as a paginated collection so the
 * response interceptor knows to place `page` under `meta` instead of `data`. */
export class CollectionResult<T> {
  constructor(
    public readonly items: T[],
    public readonly page: PageMeta,
  ) {}
}
