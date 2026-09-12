import type { User } from '@prisma/client';
import type { AcademyEntity } from '../../organizations/entities/academy.entity';
import type { AcademiesService } from '../../organizations/services/academies.service';
import type { MembershipsService } from '../../organizations/services/memberships.service';
import type { UsersService } from '../../identity/services/users.service';
import type { CreateAdminUserDto } from '../dtos/create-admin-user.dto';
import { AdminUsersService } from './admin-users.service';

const SCOPE = { organizationId: 'org-1' };

function fakeAcademy(overrides: Partial<AcademyEntity> = {}): AcademyEntity {
  return {
    id: 'academy-1',
    organizationId: 'org-1',
    name: 'School of Software Engineering',
    slug: 'sse',
    status: 'active',
    description: null,
    timezone: 'Africa/Lagos',
    branding: null,
    contactEmail: null,
    isPublic: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-new',
    emailCanonical: 'new.person@example.com',
    username: 'new_person',
    displayName: 'New Person',
    givenName: null,
    familyName: null,
    status: 'active',
    emailVerifiedAt: new Date(),
    locale: 'en-NG',
    timezone: 'Africa/Lagos',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildService(options: { academy?: AcademyEntity | null } = {}) {
  const usersService = {
    createWithPassword: jest.fn(async () => fakeUser()),
  } as unknown as UsersService;

  const membershipsService = {
    inviteIntoOrganization: jest.fn(async () => undefined),
  } as unknown as MembershipsService;

  const academiesService = {
    get: jest.fn(async () => {
      if (!options.academy) throw new Error('Academy not found.');
      return options.academy;
    }),
  } as unknown as AcademiesService;

  const service = new AdminUsersService(
    usersService,
    membershipsService,
    {} as never, // MfaService — unused by create()
    {} as never, // RefreshSessionService — unused by create()
    {} as never, // UserProfilesService — unused by create()
    {} as never, // AdminAuditService — unused by create()
    {} as never, // AdminUsersRepository — unused by create()
    {} as never, // AuditLogService — recorded inside UsersService, not here
    academiesService,
  );

  return { service, usersService, membershipsService, academiesService };
}

const BASE_DTO: CreateAdminUserDto = {
  email: 'new.person@example.com',
  username: 'new_person',
  password: 'CorrectHorse123!',
  displayName: 'New Person',
  roleKeys: ['MENTOR'],
};

describe('AdminUsersService.create — jurisdiction validation', () => {
  it('rejects ACADEMY_ADMIN without an academyId', async () => {
    const { service } = buildService();

    await expect(
      service.create(SCOPE, 'admin-1', { ...BASE_DTO, roleKeys: ['ACADEMY_ADMIN'] }),
    ).rejects.toMatchObject({
      response: { code: 'VALIDATION_ERROR' },
    });
  });

  it('rejects an academyId that does not resolve in this scope', async () => {
    const { service } = buildService({ academy: null });

    await expect(
      service.create(SCOPE, 'admin-1', {
        ...BASE_DTO,
        roleKeys: ['ACADEMY_ADMIN'],
        academyId: 'academy-x',
      }),
    ).rejects.toThrow('Academy not found.');
  });

  it('creates the user and membership with the resolved academy for ACADEMY_ADMIN', async () => {
    const { service, usersService, membershipsService, academiesService } = buildService({
      academy: fakeAcademy(),
    });

    await service.create(SCOPE, 'admin-1', {
      ...BASE_DTO,
      roleKeys: ['ACADEMY_ADMIN'],
      academyId: 'academy-1',
    });

    expect(academiesService.get).toHaveBeenCalledWith(SCOPE, 'academy-1', 'admin-1');
    expect(usersService.createWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: BASE_DTO.email, username: BASE_DTO.username }),
      'admin-1',
    );
    expect(membershipsService.inviteIntoOrganization).toHaveBeenCalledWith(
      SCOPE,
      'user-new',
      ['ACADEMY_ADMIN'],
      'admin-1',
      { status: 'active', academyId: 'academy-1' },
    );
  });

  it('never resolves an academy for a role that does not need one', async () => {
    const { service, membershipsService, academiesService } = buildService();

    await service.create(SCOPE, 'admin-1', BASE_DTO);

    expect(academiesService.get).not.toHaveBeenCalled();
    expect(membershipsService.inviteIntoOrganization).toHaveBeenCalledWith(
      SCOPE,
      'user-new',
      ['MENTOR'],
      'admin-1',
      { status: 'active', academyId: undefined },
    );
  });
});
