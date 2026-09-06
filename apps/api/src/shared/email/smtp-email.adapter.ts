import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AppConfigService } from '../../config/app-config.service';
import type { EmailAdapter, EmailMessage } from './email-adapter';
import { renderEmailBody } from './templates';

/** Real delivery via generic SMTP — works with any provider that exposes an
 * SMTP relay (a personal account with an app password, a transactional
 * provider's own SMTP endpoint, or a sandbox like Mailtrap for testing
 * without sending real mail). Bound in `IdentityModule` only when
 * `SMTP_HOST` is configured; the dev-mode `ConsoleEmailAdapter` remains the
 * default otherwise, so an environment with no email credentials configured
 * keeps working exactly as before. See
 * docs/adr/0009-administration-platform.md's 2026-09-06 email addendum. */
@Injectable()
export class SmtpEmailAdapter implements EmailAdapter {
  private readonly logger = new Logger('EmailAdapter');
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: AppConfigService) {
    const { host, port, secure, user, password } = this.config.email;
    this.transporter = nodemailer.createTransport({
      host: host!,
      port,
      secure,
      auth: user && password ? { user, pass: password } : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    const { from } = this.config.email;
    const { html, text } = renderEmailBody(message, this.config.app.webOrigin);
    try {
      await this.transporter.sendMail({
        from: from ?? this.config.email.user ?? undefined,
        to: message.to,
        subject: message.subject,
        html,
        text,
      });
    } catch (error) {
      // Matches `NotificationsService`'s own "never let a delivery failure
      // block the caller" convention — the caller already has a working
      // fallback (a token-based link, or (for admin-set-password creation)
      // a password that already works without email at all).
      this.logger.error(`Failed to send email to ${message.to}: ${(error as Error).message}`);
    }
  }
}
