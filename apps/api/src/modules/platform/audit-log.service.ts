import { Injectable, Logger } from '@nestjs/common';
import type { AuditLog, AuditOutcome } from '@prisma/client';
import { CollectionResult, type PageMeta } from '../../shared/pagination/collection-result';
import {
  AuditLogRepository,
  type SearchAuditLogFilters,
} from './repositories/audit-log.repository';

export interface RecordAuditEventInput {
  action: string;
  entityType: string;
  entityId?: string;
  outcome: AuditOutcome;
  organizationId?: string;
  actorUserId?: string;
  requestId?: string;
  /** Hashed, never a raw IP — docs/database-design.md §7 "source IP hash/prefix policy". */
  sourceIpHash?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchAuditLogOptions extends SearchAuditLogFilters {
  cursor?: string;
  limit: number;
}

/** Synchronous, in-transaction audit writes. Milestone 2 has no async side
 * effects (email is stubbed), so the full outbox/worker pattern from
 * docs/system-architecture.md §10 is deliberately deferred — this is the
 * scoped-down kernel agreed for this milestone.
 *
 * Milestone 7 adds the read-side (`search`/`getById`) for the Audit Center —
 * `record()`'s signature and error-swallowing behavior are unchanged. */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    try {
      await this.auditLogRepository.create(input);
    } catch (error) {
      // Audit failure must never break the calling transaction/request.
      this.logger.error(
        `Failed to record audit event "${input.action}"`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  getById(id: string): Promise<AuditLog | null> {
    return this.auditLogRepository.findById(id);
  }

  async search(options: SearchAuditLogOptions): Promise<CollectionResult<AuditLog>> {
    const { rows, hasMore } = await this.auditLogRepository.list(options);
    const page: PageMeta = {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit: options.limit,
      hasMore,
    };
    return new CollectionResult(rows, page);
  }
}
