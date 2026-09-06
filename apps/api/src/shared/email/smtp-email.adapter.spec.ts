import * as nodemailer from 'nodemailer';
import type { AppConfigService } from '../../config/app-config.service';
import { SmtpEmailAdapter } from './smtp-email.adapter';

jest.mock('nodemailer');

function fakeConfig(overrides: Partial<AppConfigService['email']> = {}): AppConfigService {
  return {
    app: { webOrigin: 'https://app.example.com', port: 3000 },
    email: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'user@example.com',
      password: 'secret',
      from: 'Project Forge <noreply@example.com>',
      ...overrides,
    },
  } as unknown as AppConfigService;
}

describe('SmtpEmailAdapter', () => {
  it('builds the transporter from configured host/port/secure/auth', () => {
    const createTransport = nodemailer.createTransport as jest.Mock;
    createTransport.mockReturnValue({ sendMail: jest.fn() });

    new SmtpEmailAdapter(fakeConfig());

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { user: 'user@example.com', pass: 'secret' },
      }),
    );
  });

  it('sends with the rendered subject/html/text and configured from address', async () => {
    const sendMail = jest.fn(async () => undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const adapter = new SmtpEmailAdapter(fakeConfig());
    await adapter.send({
      to: 'student@example.com',
      subject: 'Reset your password',
      templateKey: 'password-reset',
      variables: { token: 'tok-1', displayName: 'Ada' },
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Project Forge <noreply@example.com>',
        to: 'student@example.com',
        subject: 'Reset your password',
        html: expect.stringContaining('tok-1'),
        text: expect.stringContaining('tok-1'),
      }),
    );
  });

  it('never throws when the underlying send fails — a best-effort delivery, not a blocking one', async () => {
    const sendMail = jest.fn(async () => {
      throw new Error('connection refused');
    });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    const adapter = new SmtpEmailAdapter(fakeConfig());
    await expect(
      adapter.send({
        to: 'student@example.com',
        subject: 'Reset your password',
        templateKey: 'password-reset',
        variables: { token: 'tok-1', displayName: 'Ada' },
      }),
    ).resolves.toBeUndefined();
  });
});
