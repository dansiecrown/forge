import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreatePortfolioProjectRequest,
  UpdatePortfolioProjectRequest,
} from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { useMyEnrollment } from '@/contexts/enrollment-context';
import {
  createPortfolioProject,
  deletePortfolioProject,
  listPortfolioProjects,
  publishPortfolioProject,
  unpublishPortfolioProject,
  updatePortfolioProject,
} from '../api/portfolio-api';

export function usePortfolioProjects() {
  const { activeOrganizationId } = useActiveOrganization();
  const { enrollment } = useMyEnrollment();
  return useQuery({
    queryKey: ['portfolio-projects', 'list', enrollment?.id, activeOrganizationId],
    queryFn: () => listPortfolioProjects(enrollment?.id as string, activeOrganizationId),
    enabled: Boolean(enrollment?.id) && Boolean(activeOrganizationId),
  });
}

export function usePortfolioProject(id: string | undefined) {
  const { data: projects } = usePortfolioProjects();
  return projects?.find((p) => p.id === id);
}

export function useCreatePortfolioProject() {
  const { activeOrganizationId } = useActiveOrganization();
  const { enrollment } = useMyEnrollment();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePortfolioProjectRequest) =>
      createPortfolioProject(enrollment?.id as string, body, activeOrganizationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio-projects'] }),
  });
}

export function useUpdatePortfolioProject(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, version }: { body: UpdatePortfolioProjectRequest; version: number }) =>
      updatePortfolioProject(id, body, version, activeOrganizationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portfolio-projects'] }),
  });
}

export function usePortfolioProjectActions(id: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['portfolio-projects'] });

  const publish = useMutation({
    mutationFn: (version: number) => publishPortfolioProject(id, version, activeOrganizationId),
    onSuccess,
  });
  const unpublish = useMutation({
    mutationFn: (version: number) => unpublishPortfolioProject(id, version, activeOrganizationId),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (version: number) => deletePortfolioProject(id, version, activeOrganizationId),
    onSuccess,
  });

  return { publish, unpublish, remove };
}
