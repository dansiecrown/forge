import { renderEmailBody } from './templates';

const WEB_ORIGIN = 'https://app.example.com';

describe('renderEmailBody', () => {
  it('renders an invitation with a reset-password link carrying the token', () => {
    const { html, text } = renderEmailBody(
      { templateKey: 'invitation', variables: { token: 'tok-123', displayName: 'Ada' } },
      WEB_ORIGIN,
    );
    expect(html).toContain('https://app.example.com/reset-password?token=tok-123');
    expect(html).toContain('Ada');
    expect(text).toContain('https://app.example.com/reset-password?token=tok-123');
  });

  it('renders a password-reset email with the same reset-password link shape', () => {
    const { html } = renderEmailBody(
      { templateKey: 'password-reset', variables: { token: 'tok-456', displayName: 'Bola' } },
      WEB_ORIGIN,
    );
    expect(html).toContain('https://app.example.com/reset-password?token=tok-456');
  });

  it('renders an email-verification link at /verify-email, not /reset-password', () => {
    const { html } = renderEmailBody(
      { templateKey: 'email-verification', variables: { token: 'tok-789', displayName: 'Chidi' } },
      WEB_ORIGIN,
    );
    expect(html).toContain('https://app.example.com/verify-email?token=tok-789');
    expect(html).not.toContain('/reset-password');
  });

  it('renders an account-created email with no token, linking to the app itself', () => {
    const { html, text } = renderEmailBody(
      { templateKey: 'account-created', variables: { displayName: 'Dee' } },
      WEB_ORIGIN,
    );
    expect(html).toContain('Dee');
    expect(html).toContain(WEB_ORIGIN);
    expect(text).toContain(WEB_ORIGIN);
  });

  it('URL-encodes the token', () => {
    const { html } = renderEmailBody(
      { templateKey: 'password-reset', variables: { token: 'a b+c', displayName: 'Eve' } },
      WEB_ORIGIN,
    );
    expect(html).toContain(encodeURIComponent('a b+c'));
  });

  it('escapes HTML in interpolated values so a display name can never inject markup', () => {
    const { html } = renderEmailBody(
      {
        templateKey: 'account-created',
        variables: { displayName: '<script>alert(1)</script>' },
      },
      WEB_ORIGIN,
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('falls back to a plain body for an unrecognized templateKey, rather than throwing', () => {
    const { html, text } = renderEmailBody(
      { templateKey: 'some.future.template', variables: { body: 'Fallback content' } },
      WEB_ORIGIN,
    );
    expect(html).toContain('Fallback content');
    expect(text).toBe('Fallback content');
  });
});
