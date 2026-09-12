import type { User } from '@prisma/client';
import type { AppConfigService } from '../../../config/app-config.service';
import type { EmailAdapter } from '../../../shared/email/email-adapter';
import type { AuditLogService } from '../../platform/audit-log.service';
import type { PasswordCredentialsRepository } from '../repositories/password-credentials.repository';
import type { PasswordResetTokensRepository } from '../repositories/verification-tokens.repository';
import type { UsersRepository } from '../repositories/users.repository';
import type { PasswordService } from './password.service';
import { UsersService } from './users.service';

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    emailCanonical: 'new.person@example.com',
    username: null,
    displayName: 'New Person',
    givenName: null,
    familyName: null,
    status: 'invited',
    emailVerifiedAt: null,
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildService(options: {
  existingByEmail?: User | null;
  existingByUsername?: User | null;
  emailSendFails?: boolean;
}) {
  const usersRepository = {
    findByEmail: jest.fn(async () => options.existingByEmail ?? null),
    findByUsername: jest.fn(async () => options.existingByUsername ?? null),
    create: jest.fn(async (input) => fakeUser({ ...input, id: 'user-new' })),
    update: jest.fn(async (id, data) => fakeUser({ id, ...data })),
  } as unknown as UsersRepository;

  const passwordResetTokensRepository = {
    create: jest.fn(async () => undefined),
  } as unknown as PasswordResetTokensRepository;

  const passwordCredentialsRepository = {
    create: jest.fn(async () => undefined),
  } as unknown as PasswordCredentialsRepository;

  const passwordService = {
    hash: jest.fn(async (plain: string) => `hashed:${plain}`),
  } as unknown as PasswordService;

  const auditLog = { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
  const config = {} as unknown as AppConfigService;

  const emailAdapter = {
    send: jest.fn(async () => {
      if (options.emailSendFails) throw new Error('smtp unavailable');
    }),
  } as unknown as EmailAdapter;

  const service = new UsersService(
    usersRepository,
    passwordResetTokensRepository,
    passwordCredentialsRepository,
    passwordService,
    auditLog,
    config,
    emailAdapter,
  );

  return { service, usersRepository, passwordCredentialsRepository, passwordService, auditLog };
}

describe('UsersService.createWithPassword — admin-set-password creation', () => {
  const INPUT = {
    email: 'New.Person@Example.com',
    username: 'new_person',
    password: 'CorrectHorse123!',
    displayName: 'New Person',
  };

  it('rejects an email that already exists, rather than silently reusing the identity', async () => {
    const { service } = buildService({ existingByEmail: fakeUser() });

    await expect(service.createWithPassword(INPUT, 'admin-1')).rejects.toMatchObject({
      response: { code: 'EMAIL_ALREADY_EXISTS' },
    });
  });

  it('rejects a username that is already taken', async () => {
    const { service } = buildService({ existingByUsername: fakeUser({ username: 'new_person' }) });

    await expect(service.createWithPassword(INPUT, 'admin-1')).rejects.toMatchObject({
      response: { code: 'USERNAME_TAKEN' },
    });
  });

  it('hashes the password, creates the user active and email-verified, and records a credential', async () => {
    const { service, usersRepository, passwordCredentialsRepository, passwordService } =
      buildService({});

    const user = await service.createWithPassword(INPUT, 'admin-1');

    expect(passwordService.hash).toHaveBeenCalledWith(INPUT.password);
    expect(usersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        emailCanonical: 'new.person@example.com',
        username: 'new_person',
        status: 'active',
        emailVerifiedAt: expect.any(Date),
      }),
    );
    expect(passwordCredentialsRepository.create).toHaveBeenCalledWith(
      user.id,
      'hashed:CorrectHorse123!',
    );
  });

  it('records a user.created audit entry', async () => {
    const { service, auditLog } = buildService({});

    await service.createWithPassword(INPUT, 'admin-1');

    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.created', actorUserId: 'admin-1' }),
    );
  });

  it('still creates the account when the best-effort invitation email fails to send', async () => {
    const { service } = buildService({ emailSendFails: true });

    await expect(service.createWithPassword(INPUT, 'admin-1')).resolves.toMatchObject({
      id: 'user-new',
    });
  });
});

describe('UsersService.updateMe — self-service username', () => {
  it('rejects a username already taken by someone else', async () => {
    const { service } = buildService({
      existingByUsername: fakeUser({ id: 'someone-else', username: 'taken' }),
    });

    await expect(service.updateMe('user-1', { username: 'taken' })).rejects.toMatchObject({
      response: { code: 'USERNAME_TAKEN' },
    });
  });

  it('allows re-saving your own current username (no-op, not a conflict)', async () => {
    const { service, usersRepository } = buildService({
      existingByUsername: fakeUser({ id: 'user-1', username: 'mine' }),
    });

    await service.updateMe('user-1', { username: 'mine' });
    expect(usersRepository.update).toHaveBeenCalledWith('user-1', { username: 'mine' });
  });
});
