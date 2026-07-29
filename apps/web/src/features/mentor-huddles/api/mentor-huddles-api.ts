import type {
  HuddleAttendance,
  HuddleSession,
  RecordHuddleAttendanceRequest,
  UpsertHuddleSessionRequest,
} from '@forge/api-contract';
import { apiRequest } from '@/api/client';

export function getHuddleSession(
  cohortId: string,
  weekNumber: number,
  organizationId?: string,
): Promise<HuddleSession | null> {
  return apiRequest<HuddleSession | null>(`/mentors/cohorts/${cohortId}/huddles/${weekNumber}`, {
    organizationId,
  });
}

export function upsertHuddleSession(
  cohortId: string,
  weekNumber: number,
  body: UpsertHuddleSessionRequest,
  organizationId?: string,
): Promise<HuddleSession> {
  return apiRequest<HuddleSession>(`/mentors/cohorts/${cohortId}/huddles/${weekNumber}`, {
    method: 'PUT',
    body,
    organizationId,
  });
}

export function listSessionAttendance(
  sessionId: string,
  organizationId?: string,
): Promise<HuddleAttendance[]> {
  return apiRequest<HuddleAttendance[]>(`/mentors/huddles/${sessionId}/attendance`, {
    organizationId,
  });
}

export function recordAttendance(
  sessionId: string,
  body: RecordHuddleAttendanceRequest,
  organizationId?: string,
): Promise<HuddleAttendance[]> {
  return apiRequest<HuddleAttendance[]>(`/mentors/huddles/${sessionId}/attendance`, {
    method: 'PUT',
    body,
    organizationId,
  });
}
