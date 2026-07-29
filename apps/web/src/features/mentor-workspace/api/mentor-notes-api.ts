import type {
  CreateMentorNoteRequest,
  MentorNote,
  UpdateMentorNoteRequest,
} from '@forge/api-contract';
import { apiRequest } from '@/api/client';

export function createMentorNote(
  enrollmentId: string,
  body: CreateMentorNoteRequest,
  organizationId?: string,
): Promise<MentorNote> {
  return apiRequest<MentorNote>(`/enrollments/${enrollmentId}/mentor-notes`, {
    method: 'POST',
    body,
    organizationId,
  });
}

export function updateMentorNote(
  noteId: string,
  body: UpdateMentorNoteRequest,
  ifMatch: number,
  organizationId?: string,
): Promise<MentorNote> {
  return apiRequest<MentorNote>(`/mentor-notes/${noteId}`, {
    method: 'PATCH',
    body,
    ifMatch,
    organizationId,
  });
}

export function deleteMentorNote(
  noteId: string,
  ifMatch: number,
  organizationId?: string,
): Promise<void> {
  return apiRequest<void>(`/mentor-notes/${noteId}`, { method: 'DELETE', ifMatch, organizationId });
}
