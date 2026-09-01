"use client";

// Generic add/edit/remove card list — shared by Education, Projects and
// Certifications in the Content tab, which are all structurally the same
// shape (a list of small credential/entry cards). Each caller supplies how
// to build a fresh item and how to render its fields; this owns only the
// list mechanics and the shared visual shell (rounded card, hover-reveal
// remove button, dashed "Add …" button) — the same minimal pattern the old
// screen used for its (previously disconnected) Projects/Education cards.

import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EntryListEditorProps<T extends { id: string }> {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderFields: (item: T, update: (patch: Partial<T>) => void, isActive: boolean) => ReactNode;
  addLabel: string;
  emptyLabel: string;
}

export function EntryListEditor<T extends { id: string }>({
  items,
  onChange,
  createItem,
  renderFields,
  addLabel,
  emptyLabel,
}: EntryListEditorProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const updateItem = (id: string, patch: Partial<T>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };
  const removeItem = (id: string) => onChange(items.filter((item) => item.id !== id));
  const addItem = () => onChange([...items, createItem()]);

  return (
    <div className="flex flex-col gap-2.5">
      {items.length === 0 ? (
        <p className="text-xs text-black/50 italic">{emptyLabel}</p>
      ) : (
        items.map((item) => {
          const isActive = activeId === item.id;

          return (
            <div
              key={item.id}
              onMouseEnter={() => setActiveId(item.id)}
              onMouseLeave={() => setActiveId((prev) => (prev === item.id ? null : prev))}
              onFocusCapture={() => setActiveId(item.id)}
              onBlurCapture={(event) => {
                const nextFocusTarget = event.relatedTarget as Node | null;
                if (!event.currentTarget.contains(nextFocusTarget)) {
                  setActiveId((prev) => (prev === item.id ? null : prev));
                }
              }}
              className={cn(
                "group relative flex flex-col gap-2.5 rounded-xl border bg-white p-2 transition-all duration-200 mb-2",
                isActive
                  ? "border-[#1f1f1f] shadow-[0_0_0_1px_rgba(31,31,31,0.25),3px_3px_0_0_#e1f073]"
                  : "border-black/15 hover:border-black/45 hover:bg-[#f8f8f6]",
              )}>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label="Remove entry"
                className={cn(
                  "absolute right-2 top-2 grid h-6 w-6 place-content-center rounded-md border transition-all duration-200 cursor-pointer",
                  isActive
                    ? "border-[#1f1f1f] bg-[#1f1f1f] text-white hover:border-[#2a2a2a] hover:bg-[#2a2a2a]"
                    : "border-black/30 bg-white text-black/50 opacity-0 group-hover:opacity-100 hover:border-[#222325] hover:bg-[#222325] hover:text-white hover:shadow-[2px_2px_0_0_#e1f073]",
                )}>
                <X className="h-3.5 w-3.5" />
              </button>
              {renderFields(item, (patch) => updateItem(item.id, patch), isActive)}
            </div>
          );
        })
      )}
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-black/55 hover:text-primary border border-dashed border-black/30 hover:border-[#222325] rounded-lg px-3 py-2 transition-colors cursor-pointer">
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  );
}

export default EntryListEditor;
