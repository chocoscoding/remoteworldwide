"use client";

import type { FC } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import type { ColumnSlot, SectionConfig } from "@/app/lib/dashboard/resume/design-types";

const COLUMN_OPTIONS: { id: ColumnSlot; label: string }[] = [
  { id: "main", label: "Main" },
  { id: "side", label: "Side" },
];

interface SortableSectionRowProps {
  section: SectionConfig;
  showColumnToggle: boolean;
  onSetColumn: (id: string, column: ColumnSlot) => void;
}

/**
 * One draggable row. `transform`/`transition` are dnd-kit's per-pixel drag
 * offset, computed at runtime with no static-Tailwind-class equivalent —
 * the same justified inline-style exception the Tracker board's
 * `SortableTrackerCard` uses (`tracker/Client.tsx`). Every other style on
 * this row is a Tailwind class.
 *
 * Only the grip handle carries the sortable `listeners`/`attributes` (the
 * "drag handle" pattern dnd-kit documents) — `setNodeRef` stays on the row —
 * so the Main/Side segmented control underneath stays a normal, clickable
 * control instead of fighting the drag gesture.
 */
const SortableSectionRow: FC<SortableSectionRowProps> = ({ section, showColumnToggle, onSetColumn }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-black/10 bg-white px-2.5 py-2",
        isDragging && "opacity-50"
      )}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${section.label}`}
        className="grid h-7 w-7 flex-none touch-none place-content-center rounded-lg text-black/35 transition-colors cursor-grab hover:bg-[#f6f6f6] hover:text-black/60 active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-primary">{section.label}</span>

      {showColumnToggle && (
        <SegmentedControl
          size="sm"
          ariaLabel={`${section.label} column`}
          options={COLUMN_OPTIONS}
          value={section.column}
          onChange={(column) => onSetColumn(section.id, column)}
          className="w-[104px] flex-none"
        />
      )}
    </div>
  );
};

/**
 * Drag-reorderable list of every section EXCEPT the locked "Personal
 * Details" entry, which is pinned and rendered OUTSIDE both `DndContext` and
 * `SortableContext` entirely — it is never part of the sortable item set, so
 * it can never be dragged, dropped onto, or reordered.
 *
 * Sensor setup and the `DndContext` `id` are copied from the Tracker board
 * (`tracker/Client.tsx`): `PointerSensor` needs a small `activationConstraint`
 * so a plain click doesn't register as a drag, and a STABLE `id` on
 * `DndContext` is required — omitting it caused a real SSR `aria-describedby`
 * hydration mismatch on the Tracker build.
 *
 * Column assignment (Main/Side) is independent of order, so each row also
 * exposes its own Main/Side control when `layout.columns !== "one"`.
 */
const SectionOrderList: FC = () => {
  const { design, sections, dispatch } = useResumeDesign();
  const orderable = sections.filter((s) => !s.locked);
  const personal = sections.find((s) => s.locked);
  const showColumnToggle = design.layout.columns !== "one";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    dispatch({ type: "sections/reorder", from, to });
  };

  const handleSetColumn = (id: string, column: ColumnSlot) => {
    dispatch({ type: "sections/setColumn", id, column });
  };

  return (
    <div className="flex flex-col gap-2">
      {personal && (
        <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#f6f6f6] px-2.5 py-2">
          <span aria-hidden className="grid h-7 w-7 flex-none place-content-center text-black/25">
            <GripVertical className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-black/50">{personal.label}</span>
          <span className="flex-none text-[10px] font-bold uppercase tracking-wide text-black/35">Pinned</span>
        </div>
      )}

      <DndContext id="resume-section-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderable.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {orderable.map((section) => (
              <SortableSectionRow
                key={section.id}
                section={section}
                showColumnToggle={showColumnToggle}
                onSetColumn={handleSetColumn}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default SectionOrderList;
