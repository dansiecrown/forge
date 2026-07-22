import { join } from 'node:path';
import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';
import { PrismaClient, type RoleScopeType } from '@prisma/client';

loadEnv({ path: join(__dirname, '../../../../.env') });

const prisma = new PrismaClient();

interface PermissionSeed {
  key: string;
  resource: string;
  action: string;
  scopeCapability: 'organization' | 'academy' | 'platform';
  description: string;
}

const PERMISSIONS: PermissionSeed[] = [
  {
    key: 'user.read',
    resource: 'user',
    action: 'read',
    scopeCapability: 'organization',
    description: 'View the people directory.',
  },
  {
    key: 'membership.invite',
    resource: 'membership',
    action: 'invite',
    scopeCapability: 'organization',
    description: 'Invite a person into the organization.',
  },
  {
    key: 'membership.manage',
    resource: 'membership',
    action: 'manage',
    scopeCapability: 'organization',
    description: 'Change membership status and role grants.',
  },
  {
    key: 'role.read',
    resource: 'role',
    action: 'read',
    scopeCapability: 'organization',
    description: 'View roles and their permissions.',
  },
  {
    key: 'role.create',
    resource: 'role',
    action: 'create',
    scopeCapability: 'organization',
    description: 'Create a custom role.',
  },
  {
    key: 'role.update',
    resource: 'role',
    action: 'update',
    scopeCapability: 'organization',
    description: 'Update a custom role’s permissions.',
  },
  {
    key: 'role.delete',
    resource: 'role',
    action: 'delete',
    scopeCapability: 'organization',
    description: 'Retire a custom role.',
  },
  {
    key: 'permission.read',
    resource: 'permission',
    action: 'read',
    scopeCapability: 'platform',
    description: 'View the permission catalogue.',
  },
];

interface RoleSeed {
  key: string;
  name: string;
  scopeType: RoleScopeType;
  permissionKeys: string[];
}

const ROLES: RoleSeed[] = [
  {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    scopeType: 'platform',
    permissionKeys: PERMISSIONS.map((permission) => permission.key),
  },
  {
    key: 'ORG_ADMIN',
    name: 'Organization Admin',
    scopeType: 'organization',
    permissionKeys: [
      'user.read',
      'membership.invite',
      'membership.manage',
      'role.read',
      'role.create',
      'role.update',
      'role.delete',
      'permission.read',
    ],
  },
  {
    key: 'ACADEMY_ADMIN',
    name: 'Academy Admin',
    scopeType: 'academy',
    permissionKeys: ['user.read', 'membership.manage', 'role.read', 'permission.read'],
  },
  { key: 'MENTOR', name: 'Mentor', scopeType: 'organization', permissionKeys: [] },
  { key: 'STUDENT', name: 'Student', scopeType: 'organization', permissionKeys: [] },
];

async function seedPermissions(): Promise<void> {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        resource: permission.resource,
        action: permission.action,
        scopeCapability: permission.scopeCapability,
        description: permission.description,
      },
      create: permission,
    });
  }
}

async function seedRoles(): Promise<void> {
  for (const role of ROLES) {
    const existing = await prisma.role.findFirst({ where: { key: role.key, isSystem: true } });
    const permissions = await prisma.permission.findMany({
      where: { key: { in: role.permissionKeys } },
    });

    const roleId = existing
      ? existing.id
      : (
          await prisma.role.create({
            data: {
              key: role.key,
              name: role.name,
              scopeType: role.scopeType,
              isSystem: true,
              organizationId: null,
            },
          })
        ).id;

    await prisma.rolePermission.deleteMany({ where: { roleId } });
    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
      });
    }
  }
}

async function seedBootstrapSuperAdmin(): Promise<void> {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const organizationName = process.env.SEED_ORGANIZATION_NAME ?? 'Platform';
  const organizationSlug = process.env.SEED_ORGANIZATION_SLUG ?? 'platform';

  if (!email || !password) {
    console.warn(
      'SEED_SUPER_ADMIN_EMAIL/SEED_SUPER_ADMIN_PASSWORD not set — skipping bootstrap super admin.',
    );
    return;
  }

  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: {},
    create: { name: organizationName, slug: organizationSlug, status: 'active' },
  });

  const emailCanonical = email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { emailCanonical } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        emailCanonical,
        displayName: 'Platform Super Admin',
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    });
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19_456),
    timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
    parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
  });
  await prisma.passwordCredential.upsert({
    where: { userId: user.id },
    update: { passwordHash, changedAt: new Date(), failedAttempts: 0, lockedUntil: null },
    create: { userId: user.id, passwordHash },
  });

  const membership = await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
    update: { status: 'active' },
    create: {
      organizationId: organization.id,
      userId: user.id,
      status: 'active',
      joinedAt: new Date(),
    },
  });

  const superAdminRole = await prisma.role.findFirstOrThrow({
    where: { key: 'SUPER_ADMIN', isSystem: true },
  });
  const existingGrant = await prisma.membershipRole.findFirst({
    where: { membershipId: membership.id, roleId: superAdminRole.id, revokedAt: null },
  });
  if (!existingGrant) {
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: superAdminRole.id },
    });
  }

  console.log(`Bootstrap super admin ready: ${emailCanonical} (organization: ${organizationSlug})`);
}

async function main(): Promise<void> {
  await seedPermissions();
  await seedRoles();
  await seedBootstrapSuperAdmin();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
