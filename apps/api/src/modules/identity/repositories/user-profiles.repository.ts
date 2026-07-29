import { Injectable } from '@nestjs/common';
import type { Prisma, UserProfile } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class UserProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<UserProfile | null> {
    return this.prisma.userProfile.findUnique({ where: { userId } });
  }

  /** Upsert keyed on `userId` — a profile has exactly one possible writer
   * (the owning user), so there is no lost-update race to protect against
   * with `If-Match`/expected-version checking (see
   * docs/adr/0007-student-experience.md). */
  upsert(
    userId: string,
    data: {
      bio?: string;
      skills?: string[];
      interests?: string[];
      githubUrl?: string;
      linkedinUrl?: string;
      websiteUrl?: string;
      availability?: string;
      learningPreferencesMetadata?: Prisma.InputJsonValue;
    },
  ): Promise<UserProfile> {
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: { ...data, version: { increment: 1 } },
      create: { userId, ...data },
    });
  }
}
