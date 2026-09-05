import { Injectable } from '@nestjs/common';
import type { AuditLog, AuditOutcome, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { RecordAuditEventInput } from '../audit-log.service';

export interface SearchAuditLogFilters {
  organizationId?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  outcome?: AuditOutcome;
  occurredFrom?: Date;
  occurredTo?: Date;
}

export interface ListAuditLogOptions extends SearchAuditLogFilters {
  cursor?: string;
  limit: number;
}

/** Module-private — `AuditLogService` is the only export, per
 * docs/project-structure.md §6. Extracted from `AuditLogService`'s previous
 * inline `prisma.auditLog.create` call so the read-side (`search`/`getById`)
 * can share the same Prisma access without duplicating it. */
@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: RecordAuditEventInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        outcome: input.outcome,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        requestId: input.requestId,
        sourceIpHash: input.sourceIpHash,
        metadata: input.metadata as never,
      },
    });
  }

  findById(id: string): Promise<AuditLog | null> {
    return this.prisma.auditLog.findUnique({ where: { id } });
  }

  /** Built entirely off the existing indexes — `(organizationId,
   * occurredAt desc)`, `(actorUserId, occurredAt desc)`, `(entityType,
   * entityId, occurredAt desc)` — no new index needed for the Audit Center. */
  async list(options: ListAuditLogOptions): Promise<{ rows: AuditLog[]; hasMore: boolean }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
      ...(options.actorUserId ? { actorUserId: options.actorUserId } : {}),
      ...(options.entityType ? { entityType: options.entityType } : {}),
      ...(options.entityId ? { entityId: options.entityId } : {}),
      ...(options.action ? { action: options.action } : {}),
      ...(options.outcome ? { outcome: options.outcome } : {}),
      ...(options.occurredFrom || options.occurredTo
        ? {
            occurredAt: {
              ...(options.occurredFrom ? { gte: options.occurredFrom } : {}),
              ...(options.occurredTo ? { lte: options.occurredTo } : {}),
            },
          }
        : {}),
    };

    const rows = await this.prisma.auditLog.findMany({
      where,
      take: options.limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { occurredAt: 'desc' },
    });

    const hasMore = rows.length > options.limit;
    return { rows: hasMore ? rows.slice(0, options.limit) : rows, hasMore };
  }
}
