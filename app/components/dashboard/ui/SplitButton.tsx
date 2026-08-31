"use client";

import { FC, ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One primary action with its variants tucked behind a chevron, rather than
 * a row of equally-weighted buttons. Copying is what people do most often, so
 * it gets the click; exporting lives one press away.
 */
export interface SplitButtonItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}

/**
 * Closed union + a literal-class lookup, the same shape StickerButton uses —
 * Tailwind scans classes at build time, so an interpolated colour would not
 * survive. Lime is the default; `#ffffff` is for the lime surfaces, where a
 * lime shadow is invisible.
 */
export type SplitShadowColor = "#e1f073" | "#ffffff";

const SPLIT_SHADOW: Record<SplitShadowColor, string> = {
  "#e1f073": "shadow-[2px_2px_0_0_#e1f073] hover:shadow-[2.5px_2.5px_0_0_#e1f073]",
  "#ffffff": "shadow-[2px_2px_0_0_#ffffff] hover:shadow-[2.5px_2.5px_0_0_#ffffff]",
};

export interface SplitButtonProps {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  items: SplitButtonItem[];
  shadowColor?: SplitShadowColor;
  className?: string;
}

const SplitButton: FC<SplitButtonProps> = ({ label, icon, onClick, items, shadowColor = "#e1f073", className }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on an outside click or Escape — a menu that only closes by
  // re-clicking its own trigger feels stuck.
  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={cn("relative inline-flex", className)}>
      <div
        className={cn(
          "inline-flex items-stretch rounded-lg border-[1.5px] border-[#222325] bg-[#222325] text-white transition-[transform,box-shadow] duration-100 ease-out active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
          SPLIT_SHADOW[shadowColor]
        )}>
        <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold cursor-pointer">
          {icon}
          {label}
        </button>
        <span aria-hidden className="my-1.5 w-px bg-white/25" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`More ${label.toLowerCase()} options`}
          className="inline-flex items-center px-2 cursor-pointer">
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[190px] overflow-hidden rounded-xl border-[1.5px] border-[#222325] bg-white shadow-[4px_4px_0_0_#222325]">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full items-center gap-2.5 border-b border-black/8 px-3.5 py-2.5 text-left text-xs font-semibold text-primary last:border-b-0 cursor-pointer transition-colors hover:bg-[#fbfbf7]">
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SplitButton;
