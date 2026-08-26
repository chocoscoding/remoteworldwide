"use client";

import { FC, ReactNode, useId } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small explainer bubble for a label that needs a definition rather than a
 * whole help panel.
 *
 * Deliberately dependency-free: `@radix-ui/react-tooltip` isn't installed and
 * a term explainer doesn't justify adding it. Hover and keyboard-focus are
 * both handled in CSS (`group-hover` / `group-focus-within`), so there's no
 * open/close state to manage and nothing for the React Compiler to object to.
 * The bubble stays mounted and `aria-describedby`-linked, which is what screen
 * readers want anyway.
 */
export interface DashTooltipProps {
  /** Accessible name for the trigger — e.g. "What these categories mean". */
  label: string;
  children: ReactNode;
  /** Which edge the bubble is anchored to. Defaults to the trigger's left. */
  align?: "left" | "right";
  className?: string;
}

const DashTooltip: FC<DashTooltipProps> = ({ label, children, align = "left", className }) => {
  const id = useId();

  return (
    <span className={cn("group relative inline-flex", className)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-black/30 transition-colors hover:text-[#6c7a1e] focus-visible:text-[#6c7a1e] focus-visible:outline-none">
        <Info className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>

      {/* Opens upward so it can't be clipped by a dialog's overflow-hidden. */}
      <span
        role="tooltip"
        id={id}
        className={cn(
          "pointer-events-none absolute bottom-full z-50 mb-2 w-[268px] translate-y-1 rounded-xl border-[1.5px] border-[#222325] bg-white p-3.5 text-left opacity-0 shadow-[3px_3px_0_0_#222325] transition-[opacity,transform] duration-150 ease-out group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100",
          align === "left" ? "left-0" : "right-0"
        )}>
        {children}
      </span>
    </span>
  );
};

export default DashTooltip;
