"use client";

import { FC, useRef, useState, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * "How you could have said it": the report's stronger version of one answer
 * (`Rewrite.better`), behind a lime chip. Opens on hover for a pointer and on
 * click or Enter for everyone else, and copies the text. A blank the model
 * left for the candidate's own figure ("$[number]") is boxed, so it reads as
 * theirs to fill in rather than as a claim.
 */
export interface RewritePopoverProps {
  /** The stronger version, as the report wrote it. */
  text: string;
  /** The chip's label; the mockup's wording by default. */
  label?: string;
  className?: string;
}

/** A blank for the candidate to fill: "[number]", "$[amount]", "€[x]". */
const BLANK = /([$£€]?\[[^\]\n]{1,40}\])/g;

/** The text with each blank boxed. */
export const withBlanks = (text: string): ReactNode[] =>
  text.split(BLANK).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="mx-0.5 rounded-md border border-dashed border-[#222325] bg-[#e1f073]/40 px-1 font-bold">
        {part}
      </span>
    ) : (
      part
    )
  );

/** How long the pointer may cross the gap between the chip and the card before it closes. */
const HOVER_CLOSE_MS = 150;

const RewritePopover: FC<RewritePopoverProps> = ({ text, label = "How you could have said it", className }) => {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setOpen(true);
  };
  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  };

  const copy = () => {
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Couldn't copy. Select the text instead."));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={keepOpen}
          onMouseLeave={closeSoon}
          className={cn(
            "inline-flex items-center rounded-full bg-[#e1f073] px-2.5 py-1 text-xs font-bold text-[#222325] cursor-pointer hover:bg-[#d4e35f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222325]",
            className
          )}>
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        onMouseEnter={keepOpen}
        onMouseLeave={closeSoon}
        className="br-bold w-[min(560px,calc(100vw-32px))] rounded-xl bg-white p-3 text-[#222325]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="rounded-full bg-[#222325] px-2 py-0.5 text-[11px] font-bold text-[#e1f073]">{label}</span>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy this version"
            className="rounded-md p-1 text-[#222325]/70 hover:bg-[#222325]/5 hover:text-[#222325] cursor-pointer">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[13px] leading-relaxed">{withBlanks(text)}</p>
      </PopoverContent>
    </Popover>
  );
};

export default RewritePopover;
