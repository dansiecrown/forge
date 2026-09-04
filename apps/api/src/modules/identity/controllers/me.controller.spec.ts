import { MeController } from './me.controller';

function buildController(overrides: {
  memberships?: unknown[];
  usersService?: Partial<{ getById: jest.Mock }>;
  mfaService?: Partial<{ isEnabled: jest.Mock }>;
}) {
  const usersService = {
    getById: jest.fn(async () => ({
      id: 'user-1',
      displayName: 'Test User',
      emailCanonical: 'test@example.com',
      status: 'active',
      timezone: 'Africa/Lagos',
      locale: 'en-NG',
      emailVerifiedAt: new Date(),
    })),
    ...overrides.usersService,
  };
  const membershipsService = {
    listForUser: jest.fn(async () => overrides.memberships ?? []),
  };
  const mfaService = {
    isEnabled: jest.fn(async () => false),
    ...overrides.mfaService,
  };

  const controller = new MeController(
    usersService as never,
    membershipsService as never,
    mfaService as never,
    undefined as never,
  );
  return controller;
}

describe('MeController.getMe', () => {
  it('surfaces academyId on each membership — null for an org-wide role, set for an academy-scoped one', async () => {
    const controller = buildController({
      memberships: [
        {
          organizationId: 'org-1',
          status: 'active',
          academyId: null,
          membershipRoles: [{ role: { key: 'ORG_ADMIN' } }],
        },
        {
          organizationId: 'org-2',
          status: 'active',
          academyId: 'academy-1',
          membershipRoles: [{ role: { key: 'ACADEMY_ADMIN' } }],
        },
      ],
    });

    const result = await controller.getMe({ id: 'user-1' });

    expect(result.memberships).toEqual([
      { organizationId: 'org-1', status: 'active', roles: ['ORG_ADMIN'], academyId: null },
      {
        organizationId: 'org-2',
        status: 'active',
        roles: ['ACADEMY_ADMIN'],
        academyId: 'academy-1',
      },
    ]);
  });
});
