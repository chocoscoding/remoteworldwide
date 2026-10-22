"use client";

// Two small pills that ride with the ATS check, wherever it sits (floating dock, docked rail or
// the collapsed strip): the numbers the AI suggested, still to check, and readability.
//
// "AI numbers" (owner's design, 2026-10-18; RWW/ATS-QUALITY-PLAN.md, 13.8): an amber dot and a
// count ("Check 3 AI numbers"). Hovering or clicking it grows the pill itself into a small card (Show,
// Checked) and
// highlights each number on the page for five seconds, then the highlight fades. "Checked"
// turns the pill into a green check
// for three seconds, then it goes. A new number from Quantify brings it back.
//
// "Readability" (13.2): what in the design makes the resume harder for a parser to read, each with
// a one-click fix. Free, worked out from the design.

import { useEffect, useRef, useState, type FC } from "react";
import { Check, Eye, ScanText } from "lucide-react";
import { motion } from "motion/react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import type { ReadabilityFlag } from "@/app/lib/dashboard/resume/readability";
import { cn } from "@/lib/utils";
import { strictnessCopy } from "@/app/lib/ats/strictness";

const PILL =
  "pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#222325] bg-white px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-[#fbfbf7]";

/** The callout opens above the pill (floating dock, at the foot of the window) or below it (docked rail, at the top). */
const callout = (opens: "up" | "down") =>
  cn(
    "pointer-events-auto absolute left-0 z-30 w-[min(340px,calc(100vw-32px))] rounded-xl border-2 border-[#222325] bg-white p-4 text-left br-shadow",
    opens === "up" ? "bottom-full mb-2" : "top-full mt-2",
  );

/** How long a cleared pill shows its green check before it goes. */
const CLEARED_MS = 3_000;

export const AiFiguresPill: FC<{
  count: number;
  onShow: () => void;
  /** The card closed, however it closed: the page lets the numbers fade (owner, 2026-10-18). */
  onHide?: () => void;
  onClear: () => void;
  opens?: "up" | "down";
}> = ({ count, onShow, onHide, onClear, opens = "up" }) => {
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(false);
  const timer = useRef<number | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  // The numbers stay lit while the card is open; any close, the pill going away included, tells the page.
  const hide = useRef(onHide);
  hide.current = onHide;
  useEffect(() => {
    if (!open) return;
    return () => hide.current?.();
  }, [open]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  // A click outside closes the callout.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  if (cleared) {
    return (
      <span
        className={cn(PILL, "cursor-default border-[#3d7a1f] text-[#3d7a1f]")}
        role="status"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
        Numbers checked
      </span>
    );
  }
  if (count === 0) return null;

  const show = () => {
    setOpen(true);
    onShow();
  };
  const clear = () => {
    setOpen(false);
    setCleared(true);
    onClear();
    timer.current = window.setTimeout(() => setCleared(false), CLEARED_MS);
  };

  const label = `Check ${count} AI number${count === 1 ? "" : "s"}`;

  // The pill itself grows into the card (owner, 2026-10-18: "put the popover in the pill, let it
  // grow"): one box, its size animated with motion's layout (FLIP) from pill to card and back.
  // The slot keeps the pill's own size in the layout and the card grows out of it, up from the
  // foot of the window (or down from the docked rail's top), over the page rather than in it.
  return (
    <span className="relative inline-flex">
      <span
        aria-hidden
        className="invisible flex items-center gap-1.5 whitespace-nowrap border-[1.5px] px-3 py-1 text-xs font-bold"
      >
        <span className="h-2 w-2" />
        {label}
      </span>
      <motion.div
        ref={box}
        layout
        transition={GROW}
        // Open while the pointer is on it, a pill again once it leaves (owner, 2026-10-18).
        onPointerEnter={() => !open && show()}
        onPointerLeave={() => setOpen(false)}
        style={{ borderRadius: open ? 14 : 999 }}
        className={cn(
          "pointer-events-auto absolute left-0 z-30 overflow-hidden border-[1.5px] border-[#222325] bg-white text-primary",
          opens === "up" ? "bottom-0" : "top-0",
          open ? "br-shadow br-lime" : "hover:bg-[#fbfbf7]",
        )}
      >
        {open ? (
          <motion.div
            layout="position"
            role="dialog"
            aria-label="Numbers the AI suggested"
            className="flex flex-col gap-2 p-2.5"
          >
            <button
              type="button"
              aria-expanded
              onClick={() => setOpen(false)}
              className="flex cursor-pointer items-center gap-2 text-left"
            >
              <span
                aria-hidden
                className="h-2 w-2 flex-none rounded-full bg-[#e8a317]"
              />
              <span className="whitespace-nowrap text-xs font-extrabold">
                {label}
              </span>
            </button>
            {/* The nudge, never a block (owner, 2026-10-21): the numbers stay unless the person changes them. */}
            <p className="max-w-[15rem] text-[11px] leading-snug text-[#5b5b5b]">{strictnessCopy().numberNudge}</p>
            <div className="flex gap-2">
              <StickerButton variant="outline" size="sm" onClick={onShow}>
                <Eye className="h-3.5 w-3.5" />
                Show
              </StickerButton>
              <StickerButton variant="primary" size="sm" onClick={clear}>
                <Check className="h-3.5 w-3.5" />
                Checked
              </StickerButton>
            </div>
          </motion.div>
        ) : (
          <motion.button
            layout="position"
            type="button"
            aria-expanded={false}
            onClick={show}
            className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap px-3 py-1 text-xs font-bold"
          >
            <span
              aria-hidden
              className="h-2 w-2 flex-none rounded-full bg-[#e8a317]"
            />
            {label}
          </motion.button>
        )}
      </motion.div>
    </span>
  );
};

/** The pill's grow into the card and back: ease in and out, no bounce (owner, 2026-10-18). */
const GROW = { type: "tween", ease: "easeInOut", duration: 0.28 } as const;

export const ReadabilityPill: FC<{
  flags: ReadabilityFlag[];
  onFix: (flag: ReadabilityFlag) => void;
  opens?: "up" | "down";
}> = ({ flags, onFix, opens = "up" }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  if (flags.length === 0) return null;
  const hard = flags.filter((flag) => !flag.soft).length;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((now) => !now)}
        className={PILL}
      >
        <ScanText className="h-3.5 w-3.5" aria-hidden />
        {hard > 0 ? `Readability: ${hard} to fix` : "Readability notes"}
      </button>
      {open && (
        <div role="dialog" aria-label="Readability" className={callout(opens)}>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-black/45">
            Pass the AI · Readability
          </p>
          <ul className="mt-2 flex flex-col divide-y divide-black/8">
            {flags.map((flag) => (
              <li
                key={flag.id}
                className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0"
              >
                <p className="text-sm font-bold text-primary">
                  {flag.title}
                  {flag.soft && (
                    <span className="ml-1.5 text-[11px] font-semibold text-black/45">
                      note
                    </span>
                  )}
                </p>
                <p className="text-[13px] leading-relaxed text-black/65">
                  {flag.why}
                </p>
                <StickerButton
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => onFix(flag)}
                >
                  {flag.fixLabel}
                </StickerButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
