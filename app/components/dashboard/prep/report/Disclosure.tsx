"use client";

import { useId, useState, type FC, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A row that opens: a title, a one-line summary of what's inside, and a
 * chevron. The report's details ("Grammar and word choice", "Answer by
 * answer", "Word habits", "What your answers are read against") are these,
 * so the tabs stay short and every number is still one click away.
 *
 * Stacked rows share one card (`ruled` draws the hairline between them);
 * `standalone` makes the row its own card.
 */
export interface DisclosureProps {
  title: string;
  /** Grey, after the title, cut to one line. */
  summary?: ReactNode;
  /** Beside the chevron, e.g. a count. */
  badge?: ReactNode;
  defaultOpen?: boolean;
  /** A hairline above the row, for every row but a card's first. */
  ruled?: boolean;
  /** Its own rounded card rather than a row inside one. */
  standalone?: boolean;
  /** Tints the row and its body while open. */
  tintOpen?: boolean;
  bodyClassName?: string;
  children: ReactNode;
}

const Disclosure: FC<DisclosureProps> = ({ title, summary, badge, defaultOpen = false, ruled = false, standalone = false, tintOpen = false, bodyClassName, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const tinted = tintOpen && open;
  return (
    <div className={cn(standalone && "overflow-hidden rounded-[14px] border border-black/[0.16] bg-white", tinted && "bg-[#fbfbf7]")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn(
          "flex min-h-[46px] w-full cursor-pointer items-center gap-2.5 px-4 py-1.5 text-left text-[#222325] transition-colors hover:bg-[#f6f6f1] focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#222325]",
          ruled && "border-t border-black/[0.12]",
          standalone && "min-h-12"
        )}>
        <span className={cn("flex-none text-sm", open ? "font-extrabold" : "font-bold")}>{title}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-[#5f6062]">{summary}</span>
        {badge}
        <ChevronDown aria-hidden className={cn("h-4 w-4 flex-none transition-transform motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      <div id={bodyId} hidden={!open} className={cn("px-4 pb-3.5 pt-1", bodyClassName)}>
        {children}
      </div>
    </div>
  );
};

export default Disclosure;

/** The lime count pill a disclosure carries ("1 line"). */
export const CountPill: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="flex-none rounded-full border border-[#222325] bg-[#e1f073] px-2 py-px text-[11px] font-extrabold tabular-nums text-[#222325]">{children}</span>
);
