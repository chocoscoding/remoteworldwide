"use client";

import { FC, useRef, useState, type ReactNode } from "react";
import { Copy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * "How you could have said it": the report's stronger version of one answer
 * (`Rewrite.better`), behind a lime chip. Opens on hover for a pointer and on
 * click or Enter for everyone else, and copies the text. Since 2026-10-04 it is
 * a real answer built from the candidate's resume, profile and the posting, with
 * a grey caution icon saying so, beside the chip or, in Question by question, once
 * in the card's header (`caution={false}` on each chip) (owner: "this is what AI thinks
 * is good ... that does not mean you are entirely wrong"). A blank an older
 * report left for the candidate's own figure ("$[number]") is still boxed, so it
 * reads as theirs to fill in rather than as a claim.
 */
export interface RewritePopoverProps {
  /** The stronger version, as the report wrote it. */
  text: string;
  /** The chip's label; the mockup's wording by default. */
  label?: string;
  /** False when the list shows one AiCaution for all its chips (Question by question's header). */
  caution?: boolean;
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

/** What the caution icon says: the AI's view, not the only right answer. */
export const AI_ANSWER_DISCLAIMER =
  "This is what the AI thinks a strong answer looks like, built from your resume, your profile and what this job asks for. It doesn't mean your answer was wrong. Yours doesn't need to match it word for word, as long as it means the same thing.";

/** A grey caution icon that explains, on hover or focus, where the stronger version comes from. */
export const AiCaution: FC<{ align?: "start" | "end" }> = ({ align = "start" }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="About this suggestion"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="grid h-6 w-6 flex-none cursor-help place-content-center rounded-full text-black/35 transition-colors hover:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222325]">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align={align}
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[min(300px,calc(100vw-32px))] rounded-lg border-0 bg-[#222325] px-3 py-2 text-xs leading-relaxed text-white">
        {AI_ANSWER_DISCLAIMER}
      </PopoverContent>
    </Popover>
  );
};

const RewritePopover: FC<RewritePopoverProps> = ({ text, label = "How you could have said it", caution = true, className }) => {
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
    <span className="inline-flex items-center gap-0.5">
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
      {caution && <AiCaution />}
    </span>
  );
};

export default RewritePopover;
