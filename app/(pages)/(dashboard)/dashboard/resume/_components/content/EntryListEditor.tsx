"use client";

// Generic add/edit/remove card list — shared by Education, Projects and
// Certifications in the Content tab, which are all structurally the same
// shape (a list of small credential/entry cards). Each caller supplies how
// to build a fresh item and how to render its fields; this owns only the
// list mechanics and the shared visual shell (rounded card, hover-reveal
// remove button, dashed "Add …" button) — the same minimal pattern the old
// screen used for its (previously disconnected) Projects/Education cards.

import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";

export interface EntryListEditorProps<T extends { id: string }> {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderFields: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
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
        items.map((item) => (
          <div key={item.id} className="group relative rounded-none border border-black/40 px-3 py-2.5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              aria-label="Remove entry"
              className="absolute top-2 right-2 grid h-6 w-6 place-content-center rounded-none border border-black/30 bg-white text-black/50 opacity-0 transition-all group-hover:opacity-100 hover:border-[#222325] hover:bg-[#222325] hover:text-white hover:shadow-[2px_2px_0_0_#e1f073] cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
            {renderFields(item, (patch) => updateItem(item.id, patch))}
          </div>
        ))
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
