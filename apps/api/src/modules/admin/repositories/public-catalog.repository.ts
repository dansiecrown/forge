import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface PublicCatalogTrack {
  id: string;
  name: string;
  slug: string;
  difficulty: string;
}

export interface PublicCatalogCohort {
  id: string;
  name: string;
  slug: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
}

export interface PublicCatalogFellowship {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  durationWeeks: number;
  academyId: string;
  academyName: string;
  cohorts: PublicCatalogCohort[];
  tracks: PublicCatalogTrack[];
}

/** Direct-Prisma, unauthenticated, genuinely cross-tenant reads for the
 * `/apply` and `/portal/register` browse UIs — deliberately not built on
 * `FellowshipsService`/`CohortsService`, which now require a real
 * authenticated caller for their academy-scope check. Same "inject
 * PrismaService directly" precedent as `AdminStatsRepository`. Only
 * fellowships/academies an admin has explicitly marked public, and only
 * cohorts currently `enrolling`, are ever returned — see
 * `CohortApplicationsRepository.findApplyableCohort()` for the single
 * source of truth this list intentionally mirrors. */
@Injectable()
export class PublicCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicFellowships(options: {
    cursor?: string;
    limit: number;
  }): Promise<{ rows: PublicCatalogFellowship[]; hasMore: boolean }> {
    const fellowships = await this.prisma.fellowship.findMany({
      where: {
        isPublic: true,
        status: 'published',
        deletedAt: null,
        academy: { isPublic: true, status: 'active', deletedAt: null },
        organization: { status: 'active' },
      },
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        academy: { select: { id: true, name: true } },
        cohorts: {
          where: { status: 'enrolling', deletedAt: null },
          select: {
            id: true,
            name: true,
            slug: true,
            startsAt: true,
            endsAt: true,
            capacity: true,
          },
          orderBy: { startsAt: 'asc' },
        },
        learningTracks: {
          where: { status: 'published', deletedAt: null },
          select: { id: true, name: true, slug: true, difficulty: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    const hasMore = fellowships.length > options.limit;
    const rows = (hasMore ? fellowships.slice(0, options.limit) : fellowships).map((f) => ({
      id: f.id,
      title: f.title,
      slug: f.slug,
      summary: f.summary,
      durationWeeks: f.durationWeeks,
      academyId: f.academy.id,
      academyName: f.academy.name,
      cohorts: f.cohorts,
      tracks: f.learningTracks,
    }));

    return { rows, hasMore };
  }
}
