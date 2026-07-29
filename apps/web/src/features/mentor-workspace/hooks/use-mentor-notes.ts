import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateMentorNoteRequest, UpdateMentorNoteRequest } from '@forge/api-contract';
import { useActiveOrganization } from '@/contexts/organization-context';
import { createMentorNote, deleteMentorNote, updateMentorNote } from '../api/mentor-notes-api';

/** All three mutations invalidate the student workspace query, since that's
 * where the notes panel reads its list from — no separate "list notes"
 * query to keep in sync. */
function useInvalidateWorkspace(enrollmentId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['mentors', 'students', enrollmentId] });
  };
}

export function useCreateMentorNote(enrollmentId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const invalidate = useInvalidateWorkspace(enrollmentId);
  return useMutation({
    mutationFn: (body: CreateMentorNoteRequest) =>
      createMentorNote(enrollmentId, body, activeOrganizationId),
    onSuccess: invalidate,
  });
}

export function useUpdateMentorNote(enrollmentId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const invalidate = useInvalidateWorkspace(enrollmentId);
  return useMutation({
    mutationFn: ({
      noteId,
      body,
      version,
    }: {
      noteId: string;
      body: UpdateMentorNoteRequest;
      version: number;
    }) => updateMentorNote(noteId, body, version, activeOrganizationId),
    onSuccess: invalidate,
  });
}

export function useDeleteMentorNote(enrollmentId: string) {
  const { activeOrganizationId } = useActiveOrganization();
  const invalidate = useInvalidateWorkspace(enrollmentId);
  return useMutation({
    mutationFn: ({ noteId, version }: { noteId: string; version: number }) =>
      deleteMentorNote(noteId, version, activeOrganizationId),
    onSuccess: invalidate,
  });
}
