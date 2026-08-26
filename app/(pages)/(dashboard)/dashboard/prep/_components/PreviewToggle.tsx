"use client";

import { cn } from "@/lib/utils";
import { SEGMENT_OFF, SEGMENT_ON, SEGMENT_SHELL } from "./prep-styles";

/**
 * Manual state-preview switcher — lets a screen be flipped between its named
 * states (Default / Empty / Blocked / etc.) on demand, since the seed data
 * doesn't organically produce every state on every track. Purely a display
 * override in whichever `_components/Prep*.tsx` renders it; it never mutates
 * the underlying track/session data.
 */
export interface PreviewToggleProps<T extends string> {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export default function PreviewToggle<T extends string>({ value, options, onChange, className }: PreviewToggleProps<T>) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-black/35">Preview</span>
      <div className={SEGMENT_SHELL}>
        {options.map((o) => (
          <button key={o.id} type="button" onClick={() => onChange(o.id)} className={value === o.id ? SEGMENT_ON : SEGMENT_OFF}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
