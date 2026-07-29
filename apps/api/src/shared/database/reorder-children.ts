import { AppException } from '../errors/app.exception';

interface ReorderableDelegate {
  count(args: { where: Record<string, unknown> }): Promise<number>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

/** Bulk-updates `displayOrder` for a set of child rows scoped to one parent,
 * validating every id actually belongs to that parent (and the caller's
 * org) first. One implementation shared by every reorderable curriculum
 * level (Track-within-Fellowship, Course-within-Track, Lesson/Resource/
 * Task-within-WeeklyModule) — see docs/adr/0006-curriculum-learning-engine.md. */
export async function reorderChildren(
  delegate: ReorderableDelegate,
  parentWhere: Record<string, unknown>,
  items: { id: string; displayOrder: number }[],
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const ids = items.map((item) => item.id);
  const matching = await delegate.count({ where: { ...parentWhere, id: { in: ids } } });
  if (matching !== ids.length) {
    throw AppException.validation([
      {
        field: 'items',
        code: 'INVALID_REORDER_SET',
        message: 'One or more items do not belong to this parent.',
      },
    ]);
  }

  await Promise.all(
    items.map((item) =>
      delegate.updateMany({
        where: { id: item.id, ...parentWhere },
        data: { displayOrder: item.displayOrder },
      }),
    ),
  );
}
