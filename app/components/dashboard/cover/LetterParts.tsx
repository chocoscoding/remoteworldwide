"use client";

// Pieces of the cover letter creator's editor that the apply wizard's letter
// step uses too (owner, 2026-10-03: "the utilities that cover letter creator
// has, import it into here"): the style selects in the editor's toolbar, and
// the skeleton that stands in for a letter on its way.

import type { FC } from "react";
import { cn } from "@/lib/utils";

/** Compact labelled select for the editor toolbar: every style control in one bar directly above the letter, not a separate card. */
export const ToolbarSelect: FC<{
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-black/40">
    {label}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer rounded-md border border-black/12 bg-white px-1.5 py-1 text-[11px] font-bold normal-case tracking-normal text-primary outline-none focus:border-black/30">
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

/** Line widths for one skeleton paragraph; the last line runs short, the way a paragraph ends. */
const SKELETON_LINES = ["w-full", "w-[97%]", "w-[99%]", "w-[62%]"];

/**
 * Stands in for the letter while a new one is written, so the page says a
 * letter is on its way instead of swapping the text out from under the user
 * when it lands. Shaped like what is coming: a greeting, the tone's paragraph
 * count, a sign-off. Shapes only, no spinner or "Writing…" line (owner,
 * 2026-10-03); the label is read to screen readers.
 */
export const LetterSkeleton: FC<{ paragraphs: number; label: string }> = ({ paragraphs, label }) => (
  <div className="flex min-h-[320px] flex-col gap-5 px-8 py-7" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    <div className="flex flex-col gap-5 motion-safe:animate-pulse" aria-hidden>
      <div className="h-3 w-32 rounded-full bg-black/[0.08]" />
      {Array.from({ length: paragraphs }, (_, p) => (
        <div key={p} className="flex flex-col gap-2.5">
          {SKELETON_LINES.map((width, l) => (
            <div key={l} className={cn("h-3 rounded-full bg-black/[0.08]", width)} />
          ))}
        </div>
      ))}
      <div className="flex flex-col gap-2.5">
        <div className="h-3 w-20 rounded-full bg-black/[0.08]" />
        <div className="h-3 w-40 rounded-full bg-black/[0.08]" />
      </div>
    </div>
  </div>
);
