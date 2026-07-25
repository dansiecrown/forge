import { PrismaService } from '../../../database/prisma.service';
import { AcademiesRepository } from './academies.repository';

jest.setTimeout(30_000);

/** Hits the real dev Postgres (docker-compose.dev.yml). Confirms a resource
 * created in one organization is invisible when queried with a different
 * organization's scope — the "treat cross-tenant as not-found" pattern every
 * new service in this milestone relies on (see AcademiesService.get,
 * FellowshipsService.get, CohortsService.get, EnrollmentsService.get).
 * Requires `pnpm docker:up` first. */
describe('Cross-organization isolation (integration)', () => {
  const prisma = new PrismaService();
  const academiesRepository = new AcademiesRepository(prisma);

  let organizationAId: string;
  let organizationBId: string;
  let academyInOrgAId: string;

  beforeAll(async () => {
    await prisma.$connect();

    const suffix = Date.now();
    const orgA = await prisma.organization.create({
      data: { name: 'Isolation Org A', slug: `isolation-org-a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: 'Isolation Org B', slug: `isolation-org-b-${suffix}` },
    });
    organizationAId = orgA.id;
    organizationBId = orgB.id;

    const academy = await prisma.academy.create({
      data: { organizationId: organizationAId, name: 'Org A Academy', slug: 'org-a-academy' },
    });
    academyInOrgAId = academy.id;
  });

  afterAll(async () => {
    await prisma.academy.deleteMany({ where: { id: academyInOrgAId } });
    await prisma.organization.deleteMany({
      where: { id: { in: [organizationAId, organizationBId] } },
    });
    await prisma.$disconnect();
  });

  it("returns the academy when queried with its own organization's scope", async () => {
    const academy = await academiesRepository.findById(
      { organizationId: organizationAId },
      academyInOrgAId,
    );
    expect(academy?.id).toBe(academyInOrgAId);
  });

  it("returns null (not the row) when queried with a different organization's scope", async () => {
    const academy = await academiesRepository.findById(
      { organizationId: organizationBId },
      academyInOrgAId,
    );
    expect(academy).toBeNull();
  });

  it("excludes another organization's academy from a scoped list, even matching by slug", async () => {
    const { rows } = await academiesRepository.list(
      { organizationId: organizationBId },
      { limit: 25 },
    );
    expect(rows.find((row) => row.id === academyInOrgAId)).toBeUndefined();
  });
});
