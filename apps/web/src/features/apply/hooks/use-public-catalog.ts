import { useQuery } from '@tanstack/react-query';
import { listPublicFellowships } from '../api/public-catalog-api';

export function usePublicCatalog() {
  const query = useQuery({
    queryKey: ['public-catalog', 'fellowships'],
    queryFn: () => listPublicFellowships({ limit: 50 }),
  });
  return {
    fellowships: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
