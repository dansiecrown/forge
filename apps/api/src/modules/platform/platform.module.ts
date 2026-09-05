import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { NotificationsController } from './controllers/notifications.controller';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { NotificationsRepository } from './repositories/notifications.repository';
import { SystemSettingsRepository } from './repositories/system-settings.repository';
import { NotificationsService } from './services/notifications.service';
import { SystemSettingsService } from './services/system-settings.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    AuditLogRepository,
    NotificationsRepository,
    SystemSettingsRepository,
    AuditLogService,
    NotificationsService,
    SystemSettingsService,
  ],
  exports: [AuditLogService, NotificationsService, SystemSettingsService],
})
export class PlatformModule {}
