export interface PageMeta {
  nextCursor: string | null;
  previousCursor: string | null;
  limit: number;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** Clamps a raw `?limit=` query value to a safe page size, defaulting to 25
 * and capping at 100 — shared by every cursor-paginated list endpoint. */
export function parseLimit(rawLimit: string | undefined): number {
  return Math.min(Math.max(Number(rawLimit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
}

/** Marks a service/controller return value as a paginated collection so the
 * response interceptor knows to place `page` under `meta` instead of `data`. */
export class CollectionResult<T> {
  constructor(
    public readonly items: T[],
    public readonly page: PageMeta,
  ) {}
}
