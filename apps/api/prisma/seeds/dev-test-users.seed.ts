// Local-dev-only fixture: one login per role level, for manual browser
// testing of role-scoped UI/permissions. NOT run in prisma:seed or any CI/
// deploy path — invoke directly with:
//   pnpm --filter @forge/api exec ts-node --transpile-only prisma/seeds/dev-test-users.seed.ts
// Idempotent (upserts), safe to re-run. Mirrors the direct-write pattern
// already used by seedBootstrapSuperAdmin in identity.seed.ts.
import { join } from 'node:path';
import * as argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: join(__dirname, '../../../../.env') });

const prisma = new PrismaClient();

const TEST_PASSWORD = 'TestPass123!';

interface TestUserSeed {
  email: string;
  displayName: string;
  roleKey: string;
  /// Whether this membership should be scoped to the test academy
  /// (academy-scoped roles, plus a mentor/student's home academy).
  scopedToAcademy: boolean;
}

const TEST_USERS: TestUserSeed[] = [
  {
    email: 'org.admin@test.local',
    displayName: 'Test Org Admin',
    roleKey: 'ORG_ADMIN',
    scopedToAcademy: false,
  },
  {
    email: 'academy.admin@test.local',
    displayName: 'Test Academy Admin',
    roleKey: 'ACADEMY_ADMIN',
    scopedToAcademy: true,
  },
  {
    email: 'mentor@test.local',
    displayName: 'Test Mentor',
    roleKey: 'MENTOR',
    scopedToAcademy: true,
  },
  {
    email: 'student@test.local',
    displayName: 'Test Student',
    roleKey: 'STUDENT',
    scopedToAcademy: true,
  },
];

async function main(): Promise<void> {
  const organizationSlug = process.env.SEED_ORGANIZATION_SLUG ?? 'platform';
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { slug: organizationSlug },
  });

  // No compound unique constraint on (organizationId, slug) in the Prisma
  // schema — it's a hand-written partial index (WHERE deleted_at IS NULL,
  // see the Academy model's header comment) — so upsert isn't available here.
  let academy = await prisma.academy.findFirst({
    where: { organizationId: organization.id, slug: 'test-academy', deletedAt: null },
  });
  if (!academy) {
    academy = await prisma.academy.create({
      data: {
        organizationId: organization.id,
        name: 'Test Academy',
        slug: 'test-academy',
        status: 'active',
      },
    });
  }

  const passwordHash = await argon2.hash(TEST_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19_456),
    timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
    parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
  });

  for (const seed of TEST_USERS) {
    const emailCanonical = seed.email.toLowerCase();

    let user = await prisma.user.findUnique({ where: { emailCanonical } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          emailCanonical,
          displayName: seed.displayName,
          status: 'active',
          emailVerifiedAt: new Date(),
        },
      });
    }

    await prisma.passwordCredential.upsert({
      where: { userId: user.id },
      update: { passwordHash, changedAt: new Date(), failedAttempts: 0, lockedUntil: null },
      create: { userId: user.id, passwordHash },
    });

    const membership = await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: { status: 'active', academyId: seed.scopedToAcademy ? academy.id : null },
      create: {
        organizationId: organization.id,
        userId: user.id,
        academyId: seed.scopedToAcademy ? academy.id : null,
        status: 'active',
        joinedAt: new Date(),
      },
    });

    const role = await prisma.role.findFirstOrThrow({
      where: { key: seed.roleKey, isSystem: true },
    });
    const existingGrant = await prisma.membershipRole.findFirst({
      where: { membershipId: membership.id, roleId: role.id, revokedAt: null },
    });
    if (!existingGrant) {
      await prisma.membershipRole.create({
        data: { membershipId: membership.id, roleId: role.id },
      });
    }

    console.log(`${seed.roleKey.padEnd(14)} ${emailCanonical}`);
  }

  console.log(`\nPassword for all test accounts: ${TEST_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
