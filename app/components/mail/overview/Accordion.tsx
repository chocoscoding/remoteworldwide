"use client";

import { useId, useState, type FC, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Folded sections, one open at a time: a closed one shows its title and a one-line summary, the
// open one its content. Only the open section's content is mounted. Used by the Outreach overview
// (offers, feedback, sources, triggers) and the Outreach settings. Controlled when `open` is
// passed (the settings open the section a save problem is in), else it keeps its own state.

export type FoldItem = {
  key: string;
  title: string;
  /** One line shown while the section is closed. */
  summary?: ReactNode;
  /** A small mark beside the title, shown open or closed (say "Edited"). */
  flag?: ReactNode;
  content: ReactNode;
};

const Accordion: FC<{
  items: FoldItem[];
  label: string;
  defaultOpen?: string | null;
  open?: string | null;
  onOpenChange?: (key: string | null) => void;
  className?: string;
}> = ({ items, label, defaultOpen = null, open, onOpenChange, className }) => {
  const [own, setOwn] = useState<string | null>(defaultOpen);
  const current = open !== undefined ? open : own;
  const base = useId();
  const toggle = (key: string) => {
    const next = current === key ? null : key;
    if (open === undefined) setOwn(next);
    onOpenChange?.(next);
  };

  return (
    <div role="group" aria-label={label} className={cn("overflow-hidden rounded-md border border-gray-300 bg-white", className)}>
      {items.map((item) => {
        const on = current === item.key;
        const buttonId = `${base}-${item.key}-button`;
        const panelId = `${base}-${item.key}-panel`;
        return (
          <section key={item.key} className="border-t border-gray-200 first:border-t-0">
            <h2>
              <button
                type="button"
                id={buttonId}
                aria-expanded={on}
                aria-controls={on ? panelId : undefined}
                onClick={() => toggle(item.key)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none">
                <ChevronRight className={cn("h-4 w-4 flex-none text-gray-500 transition-transform", on && "rotate-90 text-black")} aria-hidden />
                <span className="flex-none text-sm font-bold">{item.title}</span>
                {item.flag ? <span className="flex-none">{item.flag}</span> : null}
                <span className={cn("min-w-0 flex-1 truncate text-right text-sm text-gray-500 sm:text-left", on && "invisible")}>{item.summary}</span>
              </button>
            </h2>
            {on ? (
              <div id={panelId} role="region" aria-labelledby={buttonId} className="px-4 pb-5 pt-1">
                {item.content}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
};

export default Accordion;
