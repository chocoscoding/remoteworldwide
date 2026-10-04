"use client";

// Generic add/edit/remove list of entries — the resume editor's Experience,
// Education, Projects and Certifications, its skill groups, and onboarding's
// education. Each caller supplies how to build a fresh item and how to render
// its fields; this owns the list mechanics and the shell around them.
//
// Two ways to show the list:
//
//   rows   (with `summarize`) the owner's 2026-10-04 design: every entry is a
//          one-line row (its title, its dates and how much is in it) and one
//          at a time opens as a card for editing. The card's header says
//          "Editing" over the entry's title, with its hide (when `hideable`)
//          and delete as one bordered pair beside a lime Done. Its fields
//          open and shut with an animation (`Collapse`). Hovering a row
//          shows its grip, to drag it into another place. A hidden entry stays
//          in the list, struck through, "Hidden from this resume".
//   cards  (without) every entry open at once, each card's delete on hover:
//          for short entries with nothing to summarise (a skill group). With
//          `removeInFields` the card shows no delete of its own and the fields
//          place it, from `renderFields`' `remove`.
//
// Removing an entry is one undo step in the editor, so it asks nothing first.

import { useState, type FocusEvent, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Eye, EyeOff, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Collapse from "../controls/Collapse";

export interface EntrySummary {
  /** "Fullstack Developer · Rawura" */
  title: string;
  /** "Dec 2025 – Apr 2026 · 3 bullets" */
  meta?: string;
}

export interface EntryListEditorProps<T extends { id: string }> {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderFields: (item: T, update: (patch: Partial<T>) => void, isActive: boolean, remove: () => void) => ReactNode;
  addLabel: string;
  emptyLabel: string;
  /** Cards: the fields place the entry's delete themselves (`renderFields`' `remove`), so the card shows none. */
  removeInFields?: boolean;
  /** Turns on rows: what an entry's row says while it is closed. */
  summarize?: (item: T) => EntrySummary;
  /** Rows: what an entry is called on its buttons ("Delete this role"). Defaults to "entry". */
  noun?: string;
  /** Rows: the eye toggle. `hidden` is the item's own flag; absent reads as shown. */
  hideable?: boolean;
  /** Rows: open this entry for editing (a section that was just added with one empty entry). */
  autoEditId?: string | null;
}

const ICON_BUTTON =
  "grid h-7 w-7 flex-none cursor-pointer place-content-center rounded-lg text-primary transition-colors hover:bg-[#f0f0ea] disabled:cursor-default disabled:opacity-40";

/** One half of the editing card's hide/delete pair. */
const PAIR_BUTTON = "grid w-10 cursor-pointer place-content-center transition-colors";

const ADD_BUTTON =
  "inline-flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-black/50 text-[13px] font-bold text-primary transition-colors hover:border-[#222325] hover:bg-white";

interface SortableShellProps {
  id: string;
  /** Renders the entry, given the grip's props to spread on its handle. */
  children: (grip: Record<string, unknown>, dragging: boolean) => ReactNode;
}

/**
 * One draggable entry. `transform`/`transition` are dnd-kit's per-pixel drag
 * offset, a runtime value with no static class — the same inline-style
 * exception as the Customize section list (`SectionOrderList`). Translate
 * only: dnd-kit also scales an item to the size of the one it passes over,
 * which squashes an open card into a closed row's height.
 */
function SortableShell({ id, children }: SortableShellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10")}>
      {children({ ...attributes, ...listeners }, isDragging)}
    </div>
  );
}

export function EntryListEditor<T extends { id: string; hidden?: boolean }>({
  items,
  onChange,
  createItem,
  renderFields,
  addLabel,
  emptyLabel,
  removeInFields = false,
  summarize,
  noun = "entry",
  hideable = false,
  autoEditId = null,
}: EntryListEditorProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // A section added from its chip opens with its first entry ready to fill in.
  const [autoEdited, setAutoEdited] = useState<string | null>(null);
  if (autoEditId && autoEditId !== autoEdited && items.some((item) => item.id === autoEditId)) {
    setAutoEdited(autoEditId);
    setEditingId(autoEditId);
  }

  // An entry removed some other way (Undo) can't stay open.
  const editing = editingId && items.some((item) => item.id === editingId) ? editingId : null;

  const updateItem = (id: string, patch: Partial<T>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };
  const removeItem = (id: string) => {
    if (editingId === id) setEditingId(null);
    setActiveId((prev) => (prev === id ? null : prev));
    onChange(items.filter((item) => item.id !== id));
  };
  const addItem = () => {
    const item = createItem();
    onChange([...items, item]);
    if (summarize) setEditingId(item.id);
  };
  const toggleHidden = (item: T) => updateItem(item.id, { hidden: item.hidden ? undefined : true } as Partial<T>);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from !== -1 && to !== -1) onChange(arrayMove(items, from, to));
  };

  // Cards: hover and keyboard focus both mark the card being worked on.
  const pointerProps = (id: string) => ({
    onMouseEnter: () => setActiveId(id),
    onMouseLeave: () => setActiveId((prev) => (prev === id ? null : prev)),
    onFocusCapture: () => setActiveId(id),
    onBlurCapture: (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveId((prev) => (prev === id ? null : prev));
    },
  });

  if (!summarize) {
    return (
      <div className="flex flex-col gap-2.5">
        {items.length === 0 ? (
          <p className="text-xs italic text-black/50">{emptyLabel}</p>
        ) : (
          items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <div
                key={item.id}
                {...pointerProps(item.id)}
                className={cn(
                  "group relative flex flex-col gap-2.5 rounded-[10px] bg-white p-2.5 transition-[border-color,box-shadow] duration-200",
                  isActive ? "br-shadow br-lime" : "border border-black/[0.22]",
                )}>
                {!removeInFields && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove entry"
                    className={cn(
                      "absolute right-2 top-2 z-[1] grid h-7 w-7 cursor-pointer place-content-center rounded-md text-[#b23c26] transition-opacity hover:bg-[#f0f0ea]",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                    )}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {renderFields(
                  item,
                  (patch) => updateItem(item.id, patch),
                  isActive,
                  () => removeItem(item.id),
                )}
              </div>
            );
          })
        )}
        <button type="button" onClick={addItem} className={ADD_BUTTON}>
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && <p className="px-1 text-xs italic text-black/50">{emptyLabel}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => {
            const summary = summarize(item);
            const hidden = hideable && Boolean(item.hidden);
            const name = summary.title || `This ${noun}`;
            const eye = (
              <button
                type="button"
                onClick={() => toggleHidden(item)}
                aria-pressed={hidden}
                aria-label={hidden ? `Show ${name} on the resume` : `Hide ${name} from the resume`}
                title={hidden ? "Show on the resume" : "Hide from the resume"}
                className={cn(ICON_BUTTON, hidden && "border border-[#222325] bg-[#222325] text-[#e1f073] hover:bg-black")}>
                {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            );

            const isEditing = editing === item.id;

            // The editing card's header (owner, 2026-10-04): "Editing" over the
            // entry's title, hide and delete as one bordered pair, a lime Done.
            const cardHeader = (
              <div className="mx-3 flex items-center gap-2.5 border-b border-black/10 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5f6062]">
                    {hidden ? "Editing · hidden" : "Editing"}
                  </p>
                  <p
                    className={cn(
                      "truncate text-[15px] font-extrabold leading-snug",
                      hidden ? "text-[#5f6062] line-through" : "text-primary",
                    )}>
                    {summary.title || `New ${noun}`}
                  </p>
                </div>
                <div className="flex h-9 flex-none overflow-hidden rounded-lg border border-[#222325] bg-white">
                  {hideable && (
                    <button
                      type="button"
                      onClick={() => toggleHidden(item)}
                      aria-pressed={hidden}
                      aria-label={hidden ? `Show ${name} on the resume` : `Hide ${name} from the resume`}
                      title={hidden ? "Show on the resume" : "Hide from the resume"}
                      className={cn(
                        PAIR_BUTTON,
                        hidden ? "bg-[#222325] text-[#e1f073] hover:bg-black" : "text-primary hover:bg-[#f0f0ea]",
                      )}>
                      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Delete this ${noun}`}
                    title={`Delete this ${noun}`}
                    className={cn(PAIR_BUTTON, "text-[#b23c26] hover:bg-[#fbeeea]", hideable && "border-l border-[#222325]")}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  aria-label="Done editing"
                  className="inline-flex h-9 flex-none items-center gap-1.5 rounded-lg bg-[#e1f073] px-3.5 text-[13px] font-extrabold text-primary br-shadow-press">
                  <Check className="h-4 w-4" strokeWidth={3} />
                  Done
                </button>
              </div>
            );

            const rowHeader = (grip: Record<string, unknown>) => (
              <div className="flex min-h-12 items-center gap-1 py-1 pl-0.5 pr-1">
                <button
                  type="button"
                  {...grip}
                  aria-label={`Drag to reorder ${name}`}
                  className="grid h-9 w-5 flex-none cursor-grab touch-none place-content-center rounded text-black/40 opacity-0 transition-opacity hover:text-primary focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100">
                  <GripVertical className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(item.id)}
                  className="flex min-w-0 flex-1 cursor-pointer flex-col py-0.5 text-left">
                  <span className={cn("truncate text-[13px] font-bold", hidden ? "text-[#5f6062]" : "text-primary")}>{name}</span>
                  {hidden ? null : summary.meta && <span className="truncate text-xs text-[#5f6062]">{summary.meta}</span>}
                </button>
                {hideable && eye}
                <button
                  type="button"
                  onClick={() => setEditingId(item.id)}
                  aria-label={`Edit ${name}`}
                  title="Edit"
                  className={ICON_BUTTON}>
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            );

            // One shell for both states: the header swaps, and the fields
            // under it open and shut (`Collapse`), so a row grows into its
            // card and shrinks back into a row.
            return (
              <SortableShell key={item.id} id={item.id}>
                {(grip, dragging) => (
                  <div
                    className={cn(
                      "rounded-[10px] transition-colors",
                      isEditing
                        ? "bg-white br-shadow br-lime"
                        : hidden
                          ? "group border border-dashed border-black/40 bg-[#f0f0ea]"
                          : "group border border-black/[0.22] bg-white hover:border-black/45",
                      !isEditing && dragging && "br-shadow br-lime",
                    )}>
                    {isEditing ? cardHeader : rowHeader(grip)}
                    <Collapse open={isEditing}>
                      <div className="flex flex-col gap-2.5 p-3">
                        {renderFields(
                          item,
                          (patch) => updateItem(item.id, patch),
                          false,
                          () => removeItem(item.id),
                        )}
                      </div>
                    </Collapse>
                  </div>
                )}
              </SortableShell>
            );
          })}
        </SortableContext>
      </DndContext>
      <button type="button" onClick={addItem} className={ADD_BUTTON}>
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  );
}

export default EntryListEditor;
