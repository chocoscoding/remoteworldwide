"use client";

// The bullet list under one Experience entry — one row per bullet, behaving
// like an outliner rather than a stack of unrelated boxes: Enter splits the
// bullet at the caret into a new row, Backspace in an empty row folds it back
// into the one above, and pasting several lines lands as several bullets
// (which is how a bullet list arrives from an old resume or a doc).
//
// `bullets` is a plain `string[]` with no ids, so rows are addressed by array
// index, same as `LinksEditor`. An empty row is a real empty string in the
// content while it is being typed into; the paper skips blank bullets
// (`EntryBullets`), so it never reaches the page.
//
// The owner's 2026-10-04 look: each bullet its own box, and hovering one (or
// typing in it) raises a small tab on its top edge with a grip to drag it into
// another place in the role and a red bin to delete it.

import { useEffect, useRef, type FC, type KeyboardEvent, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELD_CLASS, FIELD_TONE } from "./FormField";

export interface BulletsEditorProps {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  isActive?: boolean;
  /** At most this many rows: Enter stops splitting, a paste keeps the first lines that fit, and "Add" goes. Unlimited when absent. */
  max?: number;
  /** Characters a row may hold (the textarea's own `maxLength`). Unlimited when absent. */
  maxLength?: number;
}

/**
 * One bullet's box and its hover tab. Rows have no ids of their own, so the
 * sortable id is the row's index — stable for the length of a drag, which is
 * all dnd-kit needs. `transform`/`transition` are dnd-kit's runtime offset,
 * translate only: its scale would stretch a bullet to the height of the one
 * it passes over.
 */
const SortableBullet: FC<{ index: number; children: ReactNode; onDelete: () => void }> = ({ index, children, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(index) });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group/bullet relative flex flex-col", isDragging && "z-10 [&_textarea]:border-[#222325] [&_textarea]:bg-[#fbfbf7]")}>
      {children}
      <div
        className={cn(
          "absolute -top-[13px] right-2.5 z-[2] flex h-[26px] items-center overflow-hidden rounded-[7px] border border-[#222325] bg-white transition-opacity",
          isDragging ? "opacity-100" : "opacity-0 group-hover/bullet:opacity-100 group-focus-within/bullet:opacity-100",
        )}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder bullet ${index + 1}`}
          className="grid h-[26px] w-7 cursor-grab touch-none place-content-center text-[#5f6062] hover:text-primary active:cursor-grabbing">
          <GripVertical className="h-3 w-3" />
        </button>
        <span aria-hidden className="h-3.5 w-px bg-black/25" />
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete bullet ${index + 1}`}
          className="grid h-[26px] w-7 cursor-pointer place-content-center text-[#b23c26] hover:bg-[#fbeeea]">
          <Trash2 className="h-[13px] w-[13px]" />
        </button>
      </div>
    </div>
  );
};

// A pasted list brings its own markers ("• Shipped…", "- Led…"); the paper
// draws the glyph, so a marker kept in the text would print twice. The
// trailing whitespace is required so "-5% churn" keeps its minus sign.
const LEADING_MARKER = /^\s*[•●◦▪■*\-–—]\s+/;

const BulletsEditor: FC<BulletsEditorProps> = ({ bullets, onChange, isActive = false, max, maxLength }) => {
  const rowRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  // Where the caret should land once the rows for the NEXT render exist — a
  // row added by this keystroke has no element to focus until React commits it.
  const pendingFocus = useRef<{ index: number; caret: "start" | "end" } | null>(null);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    const el = rowRefs.current[pending.index];
    if (!el) return;
    el.focus();
    const at = pending.caret === "start" ? 0 : el.value.length;
    el.setSelectionRange(at, at);
  });

  const replace = (index: number, next: string[]) => onChange([...bullets.slice(0, index), ...next, ...bullets.slice(index + 1)]);
  const full = max !== undefined && bullets.length >= max;

  const handleChange = (index: number, value: string) => {
    if (!/[\r\n]/.test(value)) {
      replace(index, [value]);
      return;
    }
    // Only a paste gets a newline this far — Enter is taken in `handleKeyDown`.
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.replace(LEADING_MARKER, "").trim())
      .filter(Boolean)
      // This row plus whatever room is left.
      .slice(0, max === undefined ? undefined : Math.max(1, max - bullets.length + 1));
    if (lines.length === 0) return;
    replace(index, lines);
    pendingFocus.current = { index: index + lines.length - 1, caret: "end" };
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLTextAreaElement>) => {
    // An Enter that confirms an IME composition is the input method's, not ours.
    if (event.nativeEvent.isComposing) return;
    const el = event.currentTarget;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      // Nothing to split off an empty row — a second empty one helps nobody. Nor past the limit.
      if (!el.value.trim() || full) return;
      const before = el.value.slice(0, el.selectionStart).trimEnd();
      const after = el.value.slice(el.selectionEnd).trimStart();
      replace(index, [before, after]);
      pendingFocus.current = { index: index + 1, caret: "start" };
      return;
    }

    if (event.key === "Backspace" && el.value === "" && bullets.length > 1) {
      event.preventDefault();
      replace(index, []);
      pendingFocus.current = { index: Math.max(0, index - 1), caret: "end" };
    }
  };

  const add = () => {
    onChange([...bullets, ""]);
    pendingFocus.current = { index: bullets.length, caret: "end" };
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onChange(arrayMove(bullets, Number(active.id), Number(over.id)));
  };

  return (
    <div className="flex flex-col gap-2.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={bullets.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
          {bullets.map((bullet, i) => (
            <SortableBullet key={i} index={i} onDelete={() => replace(i, [])}>
              <textarea
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                value={bullet}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                placeholder="What you did, and what it changed"
                aria-label={`Bullet ${i + 1}`}
                // `field-sizing` grows the row with its text, so a one-line bullet
                // is one line tall. Where it is unsupported the row stays at
                // `rows` and scrolls, which is how the other textareas behave.
                rows={2}
                maxLength={maxLength}
                className={cn(
                  FIELD_CLASS,
                  "min-w-0 resize-none text-[13px] leading-[1.45] [field-sizing:content] [scrollbar-width:none] group-hover/bullet:border-[#222325] hover:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden hover:[&::-webkit-scrollbar]:block",
                  isActive ? FIELD_TONE.active : FIELD_TONE.idle,
                )}
              />
            </SortableBullet>
          ))}
        </SortableContext>
      </DndContext>

      {full ? (
        <p className="px-1 py-1 text-xs text-black/45">Up to {max} bullets.</p>
      ) : (
        <button
          type="button"
          onClick={add}
          className="inline-flex h-9 cursor-pointer items-center gap-1 self-start px-1 text-[13px] font-bold text-primary underline decoration-2 underline-offset-[3px] transition-colors hover:decoration-[#6c7a1e]">
          <Plus className="h-3.5 w-3.5" />
          Add a bullet
        </button>
      )}
    </div>
  );
};

export default BulletsEditor;
