import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateUserProfileRequest } from '@forge/api-contract';
import { getMyProfile, updateMyProfile } from '../api/profile-api';

export function useMyProfile() {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: getMyProfile,
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateUserProfileRequest) => updateMyProfile(body),
    onSuccess: (updated) => queryClient.setQueryData(['profile', 'me'], updated),
  });
}
