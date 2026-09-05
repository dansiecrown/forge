import type { PracticalTask } from '@prisma/client';

export interface PracticalTaskEntity {
  id: string;
  organizationId: string;
  weeklyModuleId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  deliverables: string[];
  submissionTypeMetadata: unknown;
  dueOffsetDays: number | null;
  rubricMetadata: unknown;
  maxScore: number | null;
  displayOrder: number;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toPracticalTaskEntity(row: PracticalTask): PracticalTaskEntity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    weeklyModuleId: row.weeklyModuleId,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    deliverables: row.deliverables,
    submissionTypeMetadata: row.submissionTypeMetadata,
    dueOffsetDays: row.dueOffsetDays,
    rubricMetadata: row.rubricMetadata,
    maxScore: row.maxScore,
    displayOrder: row.displayOrder,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
