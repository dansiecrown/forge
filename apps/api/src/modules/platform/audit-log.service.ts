import { Injectable, Logger } from '@nestjs/common';
import type { AuditOutcome } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface RecordAuditEventInput {
  action: string;
  entityType: string;
  entityId?: string;
  outcome: AuditOutcome;
  organizationId?: string;
  actorUserId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/** Synchronous, in-transaction audit writes. Milestone 2 has no async side
 * effects (email is stubbed), so the full outbox/worker pattern from
 * docs/system-architecture.md §10 is deliberately deferred — this is the
 * scoped-down kernel agreed for this milestone. */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          outcome: input.outcome,
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          requestId: input.requestId,
          metadata: input.metadata as never,
        },
      });
    } catch (error) {
      // Audit failure must never break the calling transaction/request.
      this.logger.error(
        `Failed to record audit event "${input.action}"`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
