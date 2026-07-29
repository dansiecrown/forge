import type { UserProfile } from '@prisma/client';
import type { AuditLogService } from '../../platform/audit-log.service';
import { UserProfilesRepository } from '../repositories/user-profiles.repository';
import { UserProfilesService } from './user-profiles.service';

function fakeRow(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'profile-1',
    userId: 'user-1',
    bio: null,
    skills: [],
    interests: [],
    githubUrl: null,
    linkedinUrl: null,
    websiteUrl: null,
    availability: null,
    learningPreferencesMetadata: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UserProfilesService', () => {
  it('returns an empty default-state profile (not a 404) when no row exists yet', async () => {
    const repository = {
      findByUserId: jest.fn(async () => null),
    } as unknown as UserProfilesRepository;
    const auditLog = { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
    const service = new UserProfilesService(repository, auditLog);

    const profile = await service.get('user-1');
    expect(profile.version).toBe(0);
    expect(profile.skills).toEqual([]);
  });

  it('returns the stored profile once one exists', async () => {
    const repository = {
      findByUserId: jest.fn(async () => fakeRow({ bio: 'Hello', skills: ['TypeScript'] })),
    } as unknown as UserProfilesRepository;
    const auditLog = { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
    const service = new UserProfilesService(repository, auditLog);

    const profile = await service.get('user-1');
    expect(profile.bio).toBe('Hello');
    expect(profile.skills).toEqual(['TypeScript']);
  });

  it('update upserts and returns the resulting profile', async () => {
    const repository = {
      upsert: jest.fn(async (_userId, data) => fakeRow({ ...data, version: 1 })),
    } as unknown as UserProfilesRepository;
    const auditLog = { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
    const service = new UserProfilesService(repository, auditLog);

    const profile = await service.update('user-1', { bio: 'Updated bio' });
    expect(profile.bio).toBe('Updated bio');
    expect(auditLog.record).toHaveBeenCalled();
  });

  it('round-trips the mentor-only availability field', async () => {
    const repository = {
      upsert: jest.fn(async (_userId, data) => fakeRow({ ...data, version: 1 })),
    } as unknown as UserProfilesRepository;
    const auditLog = { record: jest.fn(async () => undefined) } as unknown as AuditLogService;
    const service = new UserProfilesService(repository, auditLog);

    const profile = await service.update('user-1', { availability: 'Weekday evenings' });
    expect(profile.availability).toBe('Weekday evenings');
  });
});
