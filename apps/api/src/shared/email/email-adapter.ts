export interface EmailMessage {
  to: string;
  subject: string;
  templateKey: string;
  variables: Record<string, string>;
}

/** Adapter port per docs/project-structure.md §5 — email is a swappable
 * integration, never called from more than one place in a domain service. */
export const EMAIL_ADAPTER = Symbol('EMAIL_ADAPTER');

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}
