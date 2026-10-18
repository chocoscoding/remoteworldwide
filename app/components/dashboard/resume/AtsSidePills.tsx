"use client";

// Two small pills that ride with the ATS check, wherever it sits (floating dock, docked rail or
// the collapsed strip): the numbers the AI suggested, still to check, and readability.
//
// "AI numbers" (owner's design, 2026-10-18; RWW/ATS-QUALITY-PLAN.md, 13.8): an amber dot and a
// count. Hovering it, or a first click, opens a big callout ("AI suggested 3 numbers…") and
// highlights each number on the page for five seconds, then the highlight fades. A second click
// offers "Show them again" and "I've checked them"; checking turns the pill into a green check
// for three seconds, then it goes. A new number from Quantify brings it back.
//
// "Readability" (13.2): what in the design makes the resume harder for a parser to read, each with
// a one-click fix. Free, worked out from the design.

import { useEffect, useRef, useState, type FC } from "react";
import { Check, Eye, ScanText } from "lucide-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import type { ReadabilityFlag } from "@/app/lib/dashboard/resume/readability";
import { cn } from "@/lib/utils";

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

export const AiFiguresPill: FC<{ count: number; onShow: () => void; onClear: () => void; opens?: "up" | "down" }> = ({ count, onShow, onClear, opens = "up" }) => {
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const [cleared, setCleared] = useState(false);
  const timer = useRef<number | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  // A click outside closes the callout.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) {
        setOpen(false);
        setAsked(false);
      }
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  if (cleared) {
    return (
      <span className={cn(PILL, "cursor-default border-[#3d7a1f] text-[#3d7a1f]")} role="status">
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
  const click = () => {
    if (!open) show();
    else if (!asked) setAsked(true);
    else {
      setOpen(false);
      setAsked(false);
    }
  };
  const clear = () => {
    setOpen(false);
    setAsked(false);
    setCleared(true);
    onClear();
    timer.current = window.setTimeout(() => setCleared(false), CLEARED_MS);
  };

  return (
    <div ref={box} className="relative" onPointerEnter={() => !open && show()}>
      <button type="button" aria-expanded={open} onClick={click} className={PILL}>
        <span aria-hidden className="h-2 w-2 rounded-full bg-[#e8a317]" />
        {count} AI number{count === 1 ? "" : "s"}
      </button>
      {open && (
        <div role="dialog" aria-label="Numbers the AI suggested" className={callout(opens)}>
          <p className="text-[17px] font-extrabold leading-snug text-primary">
            AI suggested {count} number{count === 1 ? "" : "s"} on your resume.
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-black/70">Check each one is true before you send it. They&apos;re highlighted on the page now.</p>
          {asked ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <StickerButton variant="outline" size="sm" onClick={onShow}>
                <Eye className="h-3.5 w-3.5" />
                Show them again
              </StickerButton>
              <StickerButton variant="primary" size="sm" onClick={clear}>
                <Check className="h-3.5 w-3.5" />
                I&apos;ve checked them
              </StickerButton>
            </div>
          ) : (
            <p className="mt-3 text-xs font-semibold text-black/45">Click the pill again when you&apos;ve checked them.</p>
          )}
        </div>
      )}
    </div>
  );
};

export const ReadabilityPill: FC<{ flags: ReadabilityFlag[]; onFix: (flag: ReadabilityFlag) => void; opens?: "up" | "down" }> = ({ flags, onFix, opens = "up" }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  if (flags.length === 0) return null;
  const hard = flags.filter((flag) => !flag.soft).length;

  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((now) => !now)} className={PILL}>
        <ScanText className="h-3.5 w-3.5" aria-hidden />
        {hard > 0 ? `Readability: ${hard} to fix` : "Readability notes"}
      </button>
      {open && (
        <div role="dialog" aria-label="Readability" className={callout(opens)}>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-black/45">Pass the AI · Readability</p>
          <ul className="mt-2 flex flex-col divide-y divide-black/8">
            {flags.map((flag) => (
              <li key={flag.id} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
                <p className="text-sm font-bold text-primary">
                  {flag.title}
                  {flag.soft && <span className="ml-1.5 text-[11px] font-semibold text-black/45">note</span>}
                </p>
                <p className="text-[13px] leading-relaxed text-black/65">{flag.why}</p>
                <StickerButton variant="outline" size="sm" className="self-start" onClick={() => onFix(flag)}>
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
