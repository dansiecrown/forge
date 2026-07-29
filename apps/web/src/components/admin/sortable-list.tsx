import type { ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';

export interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onReorder: (items: { id: string; displayOrder: number }[]) => void;
  disabled?: boolean;
}

/** Drag-to-reorder list with a mandatory keyboard-accessible alternative
 * (docs/product-design-specification.md: "drag has keyboard alternative") —
 * every row's drag handle is itself keyboard-operable via @dnd-kit's
 * keyboard sensor (Tab to focus, Space to pick up, arrow keys to move,
 * Space to drop), and explicit Up/Down buttons provide a second, more
 * discoverable path that needs no drag gesture at all. Used for
 * Track-within-Fellowship, Course-within-Track and Lesson/Resource/Task-
 * within-WeeklyModule — not WeeklyModule itself, which orders by week
 * number (docs/adr/0006-curriculum-learning-engine.md). */
export function SortableList<T>({
  items,
  getId,
  renderItem,
  onReorder,
  disabled,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function commitOrder(nextItems: T[]) {
    onReorder(nextItems.map((item, index) => ({ id: getId(item), displayOrder: index })));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => getId(item) === active.id);
    const newIndex = items.findIndex((item) => getId(item) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = [...items];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    commitOrder(next);
  }

  function moveItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    commitOrder(next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <SortableRow key={getId(item)} id={getId(item)} disabled={disabled}>
              {renderItem(item)}
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-8 px-2"
                  disabled={disabled || index === 0}
                  onClick={() => moveItem(index, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-8 px-2"
                  disabled={disabled || index === items.length - 1}
                  onClick={() => moveItem(index, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-control border border-border bg-surface-2 px-3 py-2',
        isDragging && 'opacity-60',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      {children}
    </li>
  );
}
