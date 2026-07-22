import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  requestId: string;
  user?: AuthenticatedUser;
  organizationId?: string;
}
