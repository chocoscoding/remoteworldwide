"use client";

// Editable label/url list for the header contact links — replaces the old
// screen's single dead `content.portfolio` field. `ResumeLink` has no `id`,
// so entries are addressed by array index; fine for a short, order-stable
// list edited only through these buttons.

import type { FC } from "react";
import { Plus, X } from "lucide-react";
import type { ResumeLink } from "@/app/lib/dashboard/types";
import { TextField } from "./FormField";

export interface LinksEditorProps {
  links: ResumeLink[];
  onChange: (links: ResumeLink[]) => void;
}

const LinksEditor: FC<LinksEditorProps> = ({ links, onChange }) => {
  const update = (index: number, patch: Partial<ResumeLink>) => {
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  };
  const remove = (index: number) => onChange(links.filter((_, i) => i !== index));
  const add = () => onChange([...links, { label: "New link", url: "" }]);

  return (
    <div className="flex flex-col gap-2">
      {links.length === 0 && <p className="text-xs text-black/50 italic">No links added yet.</p>}
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2">
          <TextField value={link.label} onChange={(v) => update(i, { label: v })} placeholder="Label" className="w-28 flex-none" />
          <TextField value={link.url} onChange={(v) => update(i, { url: v })} placeholder="URL" className="flex-1" />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove link"
            className="grid h-8 w-8 flex-none place-content-center rounded-none border border-black/30 bg-white text-black/50 transition-all hover:border-[#222325] hover:bg-[#222325] hover:text-white hover:shadow-[2px_2px_0_0_#e1f073] cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-black/55 hover:text-primary border border-dashed border-black/30 hover:border-[#222325] rounded-lg px-3 py-2 transition-colors cursor-pointer">
        <Plus className="h-3.5 w-3.5" />
        Add a link
      </button>
    </div>
  );
};

export default LinksEditor;
