import type { EmailMessage } from './email-adapter';

/** Renders the actual HTML/text body for each real `templateKey` this
 * codebase sends today (`UsersService`/`AuthService`) — the dev-mode
 * `ConsoleEmailAdapter` never needed real markup since it only logs the raw
 * `variables`, but `SmtpEmailAdapter` actually delivers this to an inbox.
 * Deliberately plain, inline-styled HTML (no template engine, no external
 * asset pipeline) — email clients strip `<style>` blocks and remote
 * stylesheets unreliably, so inline styles are the only dependable option
 * without introducing a dedicated email-template dependency. */
export function renderEmailBody(
  message: Pick<EmailMessage, 'templateKey' | 'variables'>,
  webOrigin: string,
): { html: string; text: string } {
  const { templateKey, variables } = message;
  const displayName = variables.displayName ?? 'there';

  switch (templateKey) {
    case 'invitation': {
      const link = `${webOrigin}/reset-password?token=${encodeURIComponent(variables.token)}`;
      return wrap(
        `Hi ${displayName},`,
        `You've been invited to join Project Forge. Set your password to get started:`,
        link,
        'Set your password',
      );
    }
    case 'password-reset': {
      const link = `${webOrigin}/reset-password?token=${encodeURIComponent(variables.token)}`;
      return wrap(
        `Hi ${displayName},`,
        `We received a request to reset your Project Forge password. If this wasn't you, you can safely ignore this email.`,
        link,
        'Reset your password',
      );
    }
    case 'email-verification': {
      const link = `${webOrigin}/verify-email?token=${encodeURIComponent(variables.token)}`;
      return wrap(
        `Hi ${displayName},`,
        `Please verify your email address to finish setting up your Project Forge account.`,
        link,
        'Verify email',
      );
    }
    case 'account-created':
      return wrap(
        `Hi ${displayName},`,
        `Your Project Forge account is ready. An administrator has already set your password, so you can log in right away.`,
        webOrigin,
        'Go to Project Forge',
      );
    default:
      // Unknown/future templateKey — plain fallback so nothing throws.
      return {
        html: `<p>${escapeHtml(variables.body ?? '')}</p>`,
        text: variables.body ?? '',
      };
  }
}

function wrap(greeting: string, body: string, linkHref: string, linkLabel: string) {
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <p>${escapeHtml(greeting)}</p>
      <p>${escapeHtml(body)}</p>
      <p style="margin: 24px 0;">
        <a href="${linkHref}" style="background: #111827; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">${escapeHtml(linkLabel)}</a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">Or copy this link: ${linkHref}</p>
    </div>
  `.trim();
  const text = `${greeting}\n\n${body}\n\n${linkLabel}: ${linkHref}`;
  return { html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
