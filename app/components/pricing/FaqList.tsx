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
    <div className="mt-10 flex flex-col gap-3">
      {items.map((item, i) => {
        const expanded = open === i;
        const buttonId = `${baseId}-q${i}`;
        const panelId = `${baseId}-a${i}`;
        return (
          <div
            key={item.q}
            className={cn("rounded-[18px] border-[1.5px] border-primary bg-white transition-shadow", expanded && "shadow-[4px_4px_0_0_#e1f073]")}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen((prev) => (prev === i ? null : i))}
                className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-[16px] px-5 py-4 text-left text-base font-bold outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                {item.q}
                <span
                  className={cn(
                    "grid h-7 w-7 flex-none place-content-center rounded-full border-[1.5px] border-primary transition-transform duration-200 motion-reduce:transition-none",
                    expanded && "rotate-45 bg-secondary",
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
                <p className="px-5 pb-5 text-sm leading-relaxed text-primary/75">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FaqList;
