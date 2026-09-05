import { Injectable } from '@nestjs/common';
import type { Prisma, SystemSettings } from '@prisma/client';
import { SystemSettingsRepository } from '../repositories/system-settings.repository';

export interface UpdateSystemSettingsInput {
  platformName?: string;
  logoAssetId?: string;
  primaryColor?: string;
  defaultTheme?: string;
  maintenanceMode?: boolean;
  registrationOpen?: boolean;
  passwordPolicy?: Record<string, unknown>;
  sessionPolicy?: Record<string, unknown>;
  mfaPolicy?: Record<string, unknown>;
  featureFlags?: Record<string, boolean>;
}

/** A bare read/write primitive, no authorization inside it — same shape as
 * `AuditLogService`/`NotificationsService`. Lives in `PlatformModule` (the
 * root) so `identity`'s auth flows can eventually read live policy without
 * an upstream-of-downstream violation, even though nothing reads it yet —
 * see docs/adr/0009-administration-platform.md Decision 5. The SUPER_ADMIN
 * gate lives in `AdminModule`'s `AdminSettingsService`, not here. */
@Injectable()
export class SystemSettingsService {
  constructor(private readonly systemSettingsRepository: SystemSettingsRepository) {}

  get(): Promise<SystemSettings> {
    return this.systemSettingsRepository.get();
  }

  update(patch: UpdateSystemSettingsInput, expectedVersion: number): Promise<SystemSettings> {
    return this.systemSettingsRepository.update(
      patch as Prisma.SystemSettingsUpdateInput,
      expectedVersion,
    );
  }
}
