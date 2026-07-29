import type { UserProfile } from '@prisma/client';

export interface UserProfileEntity {
  bio: string | null;
  /** Labeled "Skills" for students, "Areas of Expertise" for mentors — same
   * underlying field, relabeled per-role in the UI only. */
  skills: string[];
  interests: string[];
  githubUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  /** Mentor-only field in the UI ("Availability"); unused for students. */
  availability: string | null;
  learningPreferencesMetadata: unknown;
  version: number;
  updatedAt: Date;
}

/** Empty, default-state profile for a User with no `UserProfile` row yet —
 * a profile is optional-by-default state, not a 404. `version: 0` signals
 * "not yet created" to the client (a real row always starts at 1). */
export const EMPTY_USER_PROFILE: UserProfileEntity = {
  bio: null,
  skills: [],
  interests: [],
  githubUrl: null,
  linkedinUrl: null,
  websiteUrl: null,
  availability: null,
  learningPreferencesMetadata: null,
  version: 0,
  updatedAt: new Date(0),
};

export function toUserProfileEntity(row: UserProfile): UserProfileEntity {
  return {
    bio: row.bio,
    skills: row.skills,
    interests: row.interests,
    githubUrl: row.githubUrl,
    linkedinUrl: row.linkedinUrl,
    websiteUrl: row.websiteUrl,
    availability: row.availability,
    learningPreferencesMetadata: row.learningPreferencesMetadata,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}
