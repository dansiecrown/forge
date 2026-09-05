import { Injectable } from '@nestjs/common';
import type { Prisma, UserProfile } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class UserProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<UserProfile | null> {
    return this.prisma.userProfile.findUnique({ where: { userId } });
  }

  /** Upsert keyed on `userId` — originally a profile had exactly one
   * possible writer (the owning user); an admin can now also write here
   * (Milestone 8, Admin Users profile editing), so this is no longer
   * strictly true, but it's still low-contention enough that no
   * `If-Match`/expected-version checking has been added (see
   * docs/adr/0007-student-experience.md for the original reasoning). */
  upsert(
    userId: string,
    data: {
      bio?: string;
      phone?: string;
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
