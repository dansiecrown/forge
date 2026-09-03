import { Injectable } from '@nestjs/common';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import {
  SystemSettingsService,
  type UpdateSystemSettingsInput,
} from '../../platform/services/system-settings.service';
import { assertPlatformSuperAdmin } from '../support/assert-platform-super-admin';

/** Thin `assertSuperAdmin` wrapper over `PlatformModule`'s bare
 * `SystemSettingsService` — the defense-in-depth double-gate is necessary
 * because a custom org-scoped role could otherwise be granted
 * `platform.settings.manage`, same reasoning already documented on
 * `OrganizationsService.assertPlatformSuperAdmin`. See
 * docs/adr/0009-administration-platform.md Decision 5. */
@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async get(callerId: string) {
    await assertPlatformSuperAdmin(this.permissionResolver, callerId);
    return this.systemSettingsService.get();
  }

  async update(callerId: string, patch: UpdateSystemSettingsInput, expectedVersion: number) {
    await assertPlatformSuperAdmin(this.permissionResolver, callerId);
    return this.systemSettingsService.update(patch, expectedVersion);
  }

  /** Public, unauthenticated subset for pre-login/marketing UI. */
  async getPublicBranding() {
    const settings = await this.systemSettingsService.get();
    return {
      platformName: settings.platformName,
      logoAssetId: settings.logoAssetId,
      primaryColor: settings.primaryColor,
      defaultTheme: settings.defaultTheme,
      maintenanceMode: settings.maintenanceMode,
    };
  }
}
