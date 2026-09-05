import type { Page } from '@/api/client';
import { apiRequestPage } from '@/api/client';
import type { ListPublicFellowshipsParams, PublicCatalogFellowship } from '@forge/api-contract';

export function listPublicFellowships(
  params: ListPublicFellowshipsParams = {},
): Promise<Page<PublicCatalogFellowship>> {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  return apiRequestPage<PublicCatalogFellowship>(`/public/fellowships${query ? `?${query}` : ''}`, {
    authenticated: false,
  });
}
