import { Injectable, Logger } from '@nestjs/common';
import type { EmailAdapter, EmailMessage } from './email-adapter';

/** Dev-mode stub: logs the message instead of dispatching it. Swap for a
 * real provider adapter once one is configured — no calling code changes. */
@Injectable()
export class ConsoleEmailAdapter implements EmailAdapter {
  private readonly logger = new Logger('EmailAdapter');

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `[stub email] to=${message.to} template=${message.templateKey} subject="${message.subject}" vars=${JSON.stringify(
        message.variables,
      )}`,
    );
  }
}
