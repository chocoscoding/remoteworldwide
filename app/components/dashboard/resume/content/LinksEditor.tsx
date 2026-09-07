"use client";

// Editable label/url list for the header contact links — replaces the old
// screen's single dead `content.portfolio` field. `ResumeLink` has no `id`,
// so entries are addressed by array index; fine for a short, order-stable
// list edited only through these buttons.
//
// Every row wears the brand mark of whatever its URL (or, until one is typed,
// its label) resolves to, from the same registry the paper's header reads.
// "Add a link" opens a tray of platforms; picking one seeds the row's label
// and its URL placeholder so the user only types the handle.

import { useState, type FC } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResumeLink } from "@/app/lib/dashboard/types";
import { LINK_PLATFORMS, detectPlatform, type LinkPlatform } from "@/app/lib/dashboard/resume/link-platforms";
import { TextField } from "./FormField";

export interface LinksEditorProps {
  links: ResumeLink[];
  onChange: (links: ResumeLink[]) => void;
}

const LinksEditor: FC<LinksEditorProps> = ({ links, onChange }) => {
  const [picking, setPicking] = useState(false);

  const update = (index: number, patch: Partial<ResumeLink>) => {
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  };
  const remove = (index: number) => onChange(links.filter((_, i) => i !== index));
  const add = (platform: LinkPlatform) => {
    onChange([...links, { label: platform.label, url: "" }]);
    setPicking(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {links.length === 0 && !picking && <p className="text-xs text-black/50 italic">No links added yet.</p>}
      {links.map((link, i) => {
        const platform = detectPlatform(link.url, link.label);
        return (
          <div key={i} className="flex items-center gap-2">
            <span
              title={platform.label}
              data-platform={platform.id}
              className="grid h-8 w-8 flex-none place-content-center rounded-sm border border-black/40 bg-white text-primary">
              <platform.Icon aria-hidden className="h-4 w-4" />
            </span>
            <TextField value={link.label} onChange={(v) => update(i, { label: v })} placeholder="Label" className="w-24 flex-none" />
            <TextField value={link.url} onChange={(v) => update(i, { url: v })} placeholder={platform.placeholder} className="flex-1" />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove link"
              className="grid h-8 w-8 flex-none place-content-center rounded-none border border-black/30 bg-white text-black/50 transition-all hover:border-[#222325] hover:bg-[#222325] hover:text-white hover:shadow-[2px_2px_0_0_#e1f073] cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setPicking((v) => !v)}
        aria-expanded={picking}
        className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-black/55 hover:text-primary border border-dashed border-black/30 hover:border-[#222325] rounded-lg px-3 py-2 transition-colors cursor-pointer">
        <Plus className={cn("h-3.5 w-3.5 transition-transform duration-150", picking && "rotate-45")} />
        {picking ? "Pick a platform" : "Add a link"}
      </button>

      {picking && (
        <div aria-label="Link platforms" className="flex flex-wrap gap-1.5 rounded-lg border border-black/15 bg-[#fbfbf7] p-2">
          {LINK_PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              type="button"
              title={platform.label}
              aria-label={`Add ${platform.label}`}
              onClick={() => add(platform)}
              className="grid h-8 w-8 place-content-center rounded-full border border-black/15 bg-white text-black/60 transition-colors hover:border-[#222325] hover:bg-[#222325] hover:text-[#e1f073] cursor-pointer">
              <platform.Icon aria-hidden className="h-4 w-4" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LinksEditor;
