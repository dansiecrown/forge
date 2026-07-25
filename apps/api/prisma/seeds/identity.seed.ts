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
  // --- Milestone 3: Multi-Tenant Foundation ------------------------------
  {
    key: 'organization.read',
    resource: 'organization',
    action: 'read',
    scopeCapability: 'organization',
    description: "View this organization's profile and settings.",
  },
  {
    key: 'organization.list',
    resource: 'organization',
    action: 'list',
    scopeCapability: 'platform',
    description: 'List every organization on the platform.',
  },
  {
    key: 'organization.create',
    resource: 'organization',
    action: 'create',
    scopeCapability: 'platform',
    description: 'Provision a new organization.',
  },
  {
    key: 'organization.update',
    resource: 'organization',
    action: 'update',
    scopeCapability: 'organization',
    description: "Edit this organization's profile and settings.",
  },
  {
    key: 'organization.suspend',
    resource: 'organization',
    action: 'suspend',
    scopeCapability: 'platform',
    description: 'Suspend an organization.',
  },
  {
    key: 'organization.archive',
    resource: 'organization',
    action: 'archive',
    scopeCapability: 'platform',
    description: 'Archive (soft-delete) an organization.',
  },
  {
    key: 'organization.restore',
    resource: 'organization',
    action: 'restore',
    scopeCapability: 'platform',
    description: 'Restore an archived organization.',
  },
  {
    key: 'academy.read',
    resource: 'academy',
    action: 'read',
    scopeCapability: 'organization',
    description: 'View academies in this organization.',
  },
  {
    key: 'academy.create',
    resource: 'academy',
    action: 'create',
    scopeCapability: 'organization',
    description: 'Create a new academy.',
  },
  {
    key: 'academy.update',
    resource: 'academy',
    action: 'update',
    scopeCapability: 'organization',
    description: "Edit an academy's profile.",
  },
  {
    key: 'academy.archive',
    resource: 'academy',
    action: 'archive',
    scopeCapability: 'organization',
    description: 'Archive (soft-delete) an academy.',
  },
  {
    key: 'academy.restore',
    resource: 'academy',
    action: 'restore',
    scopeCapability: 'organization',
    description: 'Restore an archived academy.',
  },
  {
    key: 'fellowship.read',
    resource: 'fellowship',
    action: 'read',
    scopeCapability: 'organization',
    description: 'View fellowship programmes.',
  },
  {
    key: 'fellowship.create',
    resource: 'fellowship',
    action: 'create',
    scopeCapability: 'organization',
    description: 'Create a new fellowship programme.',
  },
  {
    key: 'fellowship.update',
    resource: 'fellowship',
    action: 'update',
    scopeCapability: 'organization',
    description: "Edit a draft fellowship programme's details.",
  },
  {
    key: 'fellowship.publish',
    resource: 'fellowship',
    action: 'publish',
    scopeCapability: 'organization',
    description: 'Publish a fellowship programme.',
  },
  {
    key: 'fellowship.retire',
    resource: 'fellowship',
    action: 'retire',
    scopeCapability: 'organization',
    description: 'Retire a fellowship programme.',
  },
  {
    key: 'cohort.read',
    resource: 'cohort',
    action: 'read',
    scopeCapability: 'organization',
    description: 'View cohorts.',
  },
  {
    key: 'cohort.create',
    resource: 'cohort',
    action: 'create',
    scopeCapability: 'organization',
    description: 'Create a new cohort.',
  },
  {
    key: 'cohort.update',
    resource: 'cohort',
    action: 'update',
    scopeCapability: 'organization',
    description: "Edit a cohort's details.",
  },
  {
    key: 'cohort.activate',
    resource: 'cohort',
    action: 'activate',
    scopeCapability: 'organization',
    description: 'Activate a cohort.',
  },
  {
    key: 'cohort.pause',
    resource: 'cohort',
    action: 'pause',
    scopeCapability: 'organization',
    description: 'Pause an active cohort.',
  },
  {
    key: 'cohort.complete',
    resource: 'cohort',
    action: 'complete',
    scopeCapability: 'organization',
    description: 'Mark a cohort complete.',
  },
  {
    key: 'cohort.mentor.manage',
    resource: 'cohort',
    action: 'mentor.manage',
    scopeCapability: 'organization',
    description: 'Assign or unassign mentors on a cohort.',
  },
  {
    key: 'enrollment.read',
    resource: 'enrollment',
    action: 'read',
    scopeCapability: 'organization',
    description: 'View enrollments.',
  },
  {
    key: 'enrollment.manage',
    resource: 'enrollment',
    action: 'manage',
    scopeCapability: 'organization',
    description: 'Enroll a learner or change an enrollment state.',
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
      'organization.read',
      'organization.update',
      'academy.read',
      'academy.create',
      'academy.update',
      'academy.archive',
      'academy.restore',
      'fellowship.read',
      'fellowship.create',
      'fellowship.update',
      'fellowship.publish',
      'fellowship.retire',
      'cohort.read',
      'cohort.create',
      'cohort.update',
      'cohort.activate',
      'cohort.pause',
      'cohort.complete',
      'cohort.mentor.manage',
      'enrollment.read',
      'enrollment.manage',
    ],
  },
  {
    key: 'ACADEMY_ADMIN',
    name: 'Academy Admin',
    scopeType: 'academy',
    permissionKeys: [
      'user.read',
      'membership.manage',
      'role.read',
      'permission.read',
      'academy.read',
      'academy.update',
      'fellowship.read',
      'fellowship.create',
      'fellowship.update',
      'fellowship.publish',
      'fellowship.retire',
      'cohort.read',
      'cohort.create',
      'cohort.update',
      'cohort.activate',
      'cohort.pause',
      'cohort.complete',
      'cohort.mentor.manage',
      'enrollment.read',
      'enrollment.manage',
    ],
  },
  {
    key: 'MENTOR',
    name: 'Mentor',
    scopeType: 'organization',
    permissionKeys: ['academy.read', 'fellowship.read', 'cohort.read', 'enrollment.read'],
  },
  {
    key: 'STUDENT',
    name: 'Student',
    scopeType: 'organization',
    permissionKeys: ['academy.read', 'fellowship.read', 'cohort.read'],
  },
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
