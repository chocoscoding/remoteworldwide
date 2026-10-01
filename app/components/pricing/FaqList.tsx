"use client";

import { useId, useState, type FC, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The pricing FAQ as an accordion that keeps one answer open at a time:
 * opening a question closes whichever was open, and clicking the open one
 * closes it. Answers may carry links, so they arrive as rendered nodes.
 */
const FaqList: FC<{ items: { q: string; a: ReactNode }[] }> = ({ items }) => {
  const [open, setOpen] = useState<number | null>(null);
  const baseId = useId();

  return (
    <div className="mt-10 flex flex-col gap-2.5">
      {items.map((item, i) => {
        const expanded = open === i;
        const buttonId = `${baseId}-q${i}`;
        const panelId = `${baseId}-a${i}`;
        // Flat rows on a hairline, as the lighter pricing page has them (owner, 2026-10-01); the open
        // one only darkens its outline and fills its toggle lime.
        return (
          <div
            key={item.q}
            className={cn("rounded-2xl border bg-white transition-colors duration-150", expanded ? "border-primary/30" : "border-primary/10")}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen((prev) => (prev === i ? null : i))}
                className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary">
                {item.q}
                <span
                  className={cn(
                    "grid h-7 w-7 flex-none place-content-center rounded-full border transition-[transform,background-color,border-color] duration-200 motion-reduce:transition-none",
                    expanded ? "rotate-45 border-primary bg-secondary" : "border-primary/20",
                  )}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}>
              <div className="overflow-hidden" inert={!expanded}>
                <p className="max-w-[640px] px-5 pb-5 text-sm leading-relaxed text-primary/75">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FaqList;
