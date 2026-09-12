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
  // --- Milestone 4: Curriculum & Learning Engine -------------------------
  // One shared namespace covers Learning Track/Course/WeeklyModule/Lesson/
  // LearningResource/PracticalTask — all six are authored by the same roles
  // with no differing permission profile, unlike Academy/Fellowship/Cohort.
  // See docs/adr/0006-curriculum-learning-engine.md.
  {
    key: 'curriculum.read',
    resource: 'curriculum',
    action: 'read',
    scopeCapability: 'organization',
    description: 'View learning tracks, courses, weekly modules, lessons, resources and tasks.',
  },
  {
    key: 'curriculum.create',
    resource: 'curriculum',
    action: 'create',
    scopeCapability: 'organization',
    description: 'Create curriculum entities.',
  },
  {
    key: 'curriculum.update',
    resource: 'curriculum',
    action: 'update',
    scopeCapability: 'organization',
    description: 'Edit curriculum entities, including reordering.',
  },
  {
    key: 'curriculum.publish',
    resource: 'curriculum',
    action: 'publish',
    scopeCapability: 'organization',
    description: 'Publish a curriculum entity.',
  },
  {
    key: 'curriculum.archive',
    resource: 'curriculum',
    action: 'archive',
    scopeCapability: 'organization',
    description: 'Archive (soft-delete) a curriculum entity.',
  },
  {
    key: 'curriculum.restore',
    resource: 'curriculum',
    action: 'restore',
    scopeCapability: 'organization',
    description: 'Restore an archived curriculum entity.',
  },
  {
    key: 'cohort.curriculum.sync',
    resource: 'cohort',
    action: 'curriculum.sync',
    scopeCapability: 'organization',
    description: "Refresh a cohort's curriculum snapshot from current live curriculum state.",
  },
  {
    key: 'enrollment.progress.read',
    resource: 'enrollment',
    action: 'progress.read',
    scopeCapability: 'organization',
    description: "View a learner's progression summary.",
  },
  {
    key: 'learning.progress.record',
    resource: 'learning',
    action: 'progress.record',
    scopeCapability: 'organization',
    description:
      'Record lesson completion, resource acknowledgment or practical task submission for your own enrollment.',
  },
  {
    key: 'learning.bookmark.manage',
    resource: 'learning',
    action: 'bookmark.manage',
    scopeCapability: 'organization',
    description: 'Bookmark or un-bookmark a learning resource for your own enrollment.',
  },
  {
    key: 'learning.portfolio.manage',
    resource: 'learning',
    action: 'portfolio.manage',
    scopeCapability: 'organization',
    description: 'Create, edit, publish, or delete your own portfolio projects.',
  },
  // --- Milestone 6: Mentor Experience -------------------------------------
  // The coarse controller-level gate for every mentor-portal read; the
  // fine-grained "which cohorts" check is a resource-policy concern
  // enforced by assertMentorAssignedToCohort in each service, not by this
  // permission — see docs/adr/0008-mentor-experience.md Decision 3.
  {
    key: 'mentor.workspace.read',
    resource: 'mentor',
    action: 'workspace.read',
    scopeCapability: 'organization',
    description: "View the Mentor Portal's dashboard, cohort roster, and student workspace.",
  },
  {
    key: 'learning.review.manage',
    resource: 'learning',
    action: 'review.manage',
    scopeCapability: 'organization',
    description: 'Approve a practical task submission or request a revision.',
  },
  {
    key: 'learning.huddle.manage',
    resource: 'learning',
    action: 'huddle.manage',
    scopeCapability: 'organization',
    description: 'Record a weekly huddle session and its attendance.',
  },
  {
    key: 'learning.note.manage',
    resource: 'learning',
    action: 'note.manage',
    scopeCapability: 'organization',
    description: 'Create, edit, or delete a mentor note about a student.',
  },
  // --- Milestone 7: Administration Platform -------------------------------
  {
    key: 'reports.read',
    resource: 'reports',
    action: 'read',
    scopeCapability: 'organization',
    description: 'View the admin dashboard and reports/analytics.',
  },
  {
    key: 'audit.read',
    resource: 'audit',
    action: 'read',
    scopeCapability: 'organization',
    description: 'Search and view audit log entries.',
  },
  {
    key: 'user.update',
    resource: 'user',
    action: 'update',
    scopeCapability: 'organization',
    description: "Edit a Student's or Mentor's name and profile fields.",
  },
  {
    key: 'user.suspend',
    resource: 'user',
    action: 'suspend',
    scopeCapability: 'organization',
    description: 'Suspend a user account.',
  },
  {
    key: 'user.reactivate',
    resource: 'user',
    action: 'reactivate',
    scopeCapability: 'organization',
    description: 'Reactivate a suspended user account.',
  },
  {
    key: 'user.mfa.reset',
    resource: 'user',
    action: 'mfa.reset',
    scopeCapability: 'organization',
    description: "Force-disable a user's MFA without proof of possession.",
  },
  {
    key: 'user.password.force_reset',
    resource: 'user',
    action: 'password.force_reset',
    scopeCapability: 'organization',
    description: "Force a user's password to be reset via a new reset link.",
  },
  {
    key: 'user.sessions.manage',
    resource: 'user',
    action: 'sessions.manage',
    scopeCapability: 'organization',
    description: "View and revoke a user's active sessions.",
  },
  {
    key: 'fellowship.duplicate',
    resource: 'fellowship',
    action: 'duplicate',
    scopeCapability: 'organization',
    description: "Duplicate a fellowship's curriculum into a new draft fellowship.",
  },
  {
    key: 'cohort.archive',
    resource: 'cohort',
    action: 'archive',
    scopeCapability: 'organization',
    description: 'Archive a completed cohort.',
  },
  {
    key: 'announcement.manage',
    resource: 'announcement',
    action: 'manage',
    scopeCapability: 'organization',
    description: 'Create, publish, or archive an announcement.',
  },
  {
    key: 'announcement.read',
    resource: 'announcement',
    action: 'read',
    scopeCapability: 'organization',
    description: 'View announcements and notifications addressed to you.',
  },
  {
    key: 'certificate.manage',
    resource: 'certificate',
    action: 'manage',
    scopeCapability: 'organization',
    description: 'Issue, revoke, and manage certificate templates.',
  },
  {
    key: 'certificate.read',
    resource: 'certificate',
    action: 'read',
    scopeCapability: 'organization',
    description: 'View certificates and eligibility.',
  },
  {
    key: 'platform.settings.manage',
    resource: 'platform',
    action: 'settings.manage',
    scopeCapability: 'platform',
    description: 'View and edit platform-wide system settings.',
  },
  // --- Cohort Applications (self-service registration) -------------------
  // See docs/adr/0010-cohort-applications.md.
  {
    key: 'cohort.application.submit',
    resource: 'cohort',
    action: 'application.submit',
    scopeCapability: 'organization',
    description: 'Apply to join a public cohort, and view/withdraw your own applications.',
  },
  {
    key: 'cohort.application.read',
    resource: 'cohort',
    action: 'application.read',
    scopeCapability: 'organization',
    description: 'View the cohort application approval queue.',
  },
  {
    key: 'cohort.application.manage',
    resource: 'cohort',
    action: 'application.manage',
    scopeCapability: 'organization',
    description: 'Approve or reject a cohort application.',
  },

  // --- Fellowship Chat (pre-Milestone-8 additional scope) -----------------
  // See docs/adr/0014-fellowship-chat.md. `chat.channel.manage` is also the
  // signal `ChatAccessService` uses to distinguish an administrator from a
  // participant — deliberately not granted to Mentor/Student. Own-message
  // edit/delete needs no separate permission: authorship alone is enough,
  // checked in ChatMessagesService, not the permission system.
  {
    key: 'chat.channel.read',
    resource: 'chat',
    action: 'channel.read',
    scopeCapability: 'organization',
    description: 'View a fellowship’s chat channels and message history.',
  },
  {
    key: 'chat.channel.manage',
    resource: 'chat',
    action: 'channel.manage',
    scopeCapability: 'organization',
    description: 'Create, rename, archive, or restore a fellowship’s chat channels.',
  },
  {
    key: 'chat.message.create',
    resource: 'chat',
    action: 'message.create',
    scopeCapability: 'organization',
    description: 'Post, edit, and delete your own chat messages.',
  },
  {
    key: 'chat.message.moderate',
    resource: 'chat',
    action: 'message.moderate',
    scopeCapability: 'organization',
    description: 'Edit or delete any chat message in an authorized fellowship.',
  },
  {
    key: 'chat.reaction.manage',
    resource: 'chat',
    action: 'reaction.manage',
    scopeCapability: 'organization',
    description: 'Add or remove your own reactions to chat messages.',
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
      'curriculum.read',
      'curriculum.create',
      'curriculum.update',
      'curriculum.publish',
      'curriculum.archive',
      'curriculum.restore',
      'cohort.curriculum.sync',
      'enrollment.progress.read',
      'mentor.workspace.read',
      'learning.review.manage',
      'learning.huddle.manage',
      'learning.note.manage',
      'reports.read',
      'audit.read',
      'user.update',
      'user.suspend',
      'user.reactivate',
      'user.mfa.reset',
      'user.password.force_reset',
      'user.sessions.manage',
      'fellowship.duplicate',
      'cohort.archive',
      'announcement.manage',
      'announcement.read',
      'certificate.manage',
      'certificate.read',
      'cohort.application.read',
      'cohort.application.manage',
      'chat.channel.read',
      'chat.channel.manage',
      'chat.message.create',
      'chat.message.moderate',
      'chat.reaction.manage',
    ],
  },
  {
    key: 'ACADEMY_ADMIN',
    name: 'Academy Admin',
    scopeType: 'academy',
    permissionKeys: [
      'user.read',
      'user.update',
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
      'curriculum.read',
      'curriculum.create',
      'curriculum.update',
      'curriculum.publish',
      'curriculum.archive',
      'curriculum.restore',
      'cohort.curriculum.sync',
      'enrollment.progress.read',
      'mentor.workspace.read',
      'learning.review.manage',
      'learning.huddle.manage',
      'learning.note.manage',
      'reports.read',
      'fellowship.duplicate',
      'cohort.archive',
      'announcement.manage',
      'announcement.read',
      'certificate.manage',
      'certificate.read',
      'cohort.application.read',
      'cohort.application.manage',
      'chat.channel.read',
      'chat.channel.manage',
      'chat.message.create',
      'chat.message.moderate',
      'chat.reaction.manage',
    ],
  },
  {
    key: 'MENTOR',
    name: 'Mentor',
    scopeType: 'organization',
    permissionKeys: [
      'academy.read',
      'fellowship.read',
      'cohort.read',
      'enrollment.read',
      'curriculum.read',
      'enrollment.progress.read',
      'mentor.workspace.read',
      'learning.review.manage',
      'learning.huddle.manage',
      'learning.note.manage',
      'announcement.read',
      'certificate.read',
      'chat.channel.read',
      'chat.message.create',
      'chat.reaction.manage',
    ],
  },
  {
    key: 'STUDENT',
    name: 'Student',
    scopeType: 'organization',
    permissionKeys: [
      'academy.read',
      'fellowship.read',
      'cohort.read',
      'curriculum.read',
      'enrollment.progress.read',
      'learning.progress.record',
      'learning.bookmark.manage',
      'learning.portfolio.manage',
      'announcement.read',
      'certificate.read',
      'cohort.application.submit',
      'chat.channel.read',
      'chat.message.create',
      'chat.reaction.manage',
    ],
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
