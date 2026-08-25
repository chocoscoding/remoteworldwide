"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Titled collapsible section for the customize panel's "Advanced settings"
 * disclosures (Entries, Header, Colors…).
 *
 * The open/close animation is a `grid-template-rows: 0fr → 1fr` transition on
 * a one-row grid whose child clips its overflow. That animates to the
 * content's *natural* height with no measurement, no magic `max-h-[1400px]`
 * guess, and no animation library.
 *
 * Uncontrolled by default; pass `open` to drive it from the parent. Both
 * modes call `onOpenChange`.
 *
 * Presentational and fully prop-driven: no design types, no context.
 */

export interface CollapsibleGroupProps {
  title: string;
  children: ReactNode;
  /** Muted helper line under the title. */
  description?: string;
  /** Initial state when uncontrolled. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Provide to control the component; omit to let it manage its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
  /** Applied to the padded content wrapper inside the animated region. */
  contentClassName?: string;
}

export default function CollapsibleGroup({
  title,
  children,
  description,
  defaultOpen = false,
  open,
  onOpenChange,
  disabled = false,
  className,
  contentClassName,
}: CollapsibleGroupProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const toggle = () => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={cn("rounded-xl border border-black/10 bg-white", className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left transition-colors cursor-pointer hover:bg-[#fbfbf7] disabled:cursor-not-allowed disabled:opacity-40">
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold text-primary">{title}</span>
          {description && <span className="mt-0.5 block truncate text-[11px] font-medium text-black/45">{description}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 flex-none text-black/40 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}>
        <div className="overflow-hidden">
          <div className={cn("px-3.5 pb-3.5 pt-0.5", contentClassName)}>{children}</div>
        </div>
      </div>
    </div>
  );
}
