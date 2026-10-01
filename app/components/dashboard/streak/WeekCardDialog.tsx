"use client";

import { useEffect, useRef, useState, type FC } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Confetti from "react-confetti";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_DIMENSIONS, trackedLink, type WinCardFormat } from "@/app/lib/dashboard/win";
import { weekCaption, weekRangeLabel } from "@/app/lib/dashboard/week-card";
import type { StreakWeekReport } from "@/app/lib/streak/types";
import { useInviteLink } from "@/hooks/queries/useInviteSummary";
import ShareRow from "@/app/components/dashboard/share/ShareRow";
import { paintWeekCard } from "./week-card-render";

/**
 * The week card: confetti, the card, and "Share on". The preview IS the
 * artifact — one canvas, drawn client-side; Download and every share hand out
 * that canvas's pixels, and the size picker just redraws it.
 *
 * The confetti is react-confetti as it ships — its own colours and shapes, one
 * full-screen fall per opening — and stays off for anyone who asked for less
 * motion.
 *
 * The link on the card and in every caption is the user's real invite link,
 * so a signup from a shared week is credited to them.
 */
export interface WeekCardDialogProps {
  report: StreakWeekReport;
  onClose: () => void;
}

const WeekCardDialog: FC<WeekCardDialogProps> = ({ report, onClose }) => {
  // The confetti covers the window, and follows it if it changes size mid-fall.
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const reduceMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [format, setFormat] = useState<WinCardFormat>("square");
  const inviteLink = useInviteLink();
  const referralLink = inviteLink.display;

  // First paint happens in the canvas's ref callback (Radix mounts the portal
  // after this component's effects); this effect only handles redraws.
  useEffect(() => {
    const el = canvasRef.current;
    if (el) paintWeekCard(el, () => canvasRef.current, { report, format, referralLink });
  }, [report, format, referralLink]);

  const range = weekRangeLabel(report);
  const caption = weekCaption(report, inviteLink.url);

  const getBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob((b) => resolve(b), "image/png");
    });

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        {/* Beside the content, not inside it: the content is transformed, which would pin a fixed
            canvas to the card instead of the screen. Wrapped, because the portal hands each direct
            child a callback ref, which react-confetti takes for its canvas ref and never starts.
            Held until the window has a size: a fall started on a zero-size canvas ends at once. */}
        {!reduceMotion && viewport.width > 0 && viewport.height > 0 && (
          <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
            <Confetti width={viewport.width} height={viewport.height} recycle={false} />
          </div>
        )}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border-black/15 bg-white br-bold duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex flex-none items-start justify-between gap-4 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">
                {report.partial ? "Your week so far" : "That was your week"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-black/60">
                {range}, in one card. Share it — the people rooting for you will want to see it.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border border-black/15 bg-white text-primary transition-colors hover:border-primary">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-neo px-5 sm:px-6">
            {/* The card itself — this canvas is the PNG. */}
            <motion.div
              initial={reduceMotion ? undefined : { scale: 0.92, opacity: 0, y: 12 }}
              animate={reduceMotion ? undefined : { scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
              className={cn("mx-auto", format === "landscape" ? "w-full" : format === "square" ? "max-w-[320px]" : "max-w-[200px]")}>
              <canvas
                ref={(el) => {
                  canvasRef.current = el;
                  if (el) paintWeekCard(el, () => canvasRef.current, { report, format, referralLink });
                }}
                aria-label={caption}
                className="h-auto w-full rounded-lg border border-black/10"
              />
            </motion.div>

            {/* Size picker */}
            <div className="mt-4 flex justify-center">
              <div className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-[#f6f6f1] p-1">
                {(Object.keys(CARD_DIMENSIONS) as WinCardFormat[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    aria-pressed={format === f}
                    className={cn(
                      "cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      format === f ? "bg-primary text-white" : "text-black/60 hover:text-primary",
                    )}>
                    {CARD_DIMENSIONS[f].label}
                    <span className={cn("ml-1.5 hidden text-[10px] font-medium xs:inline", format === f ? "text-white/60" : "text-black/40")}>
                      {CARD_DIMENSIONS[f].hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Caption preview — what gets copied or prefilled. */}
            <div className="mt-4 rounded-xl border border-black/10 bg-primary2 px-4 py-3">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-black/50">Your caption</p>
              <p className="text-xs leading-relaxed text-black/70">{caption}</p>
            </div>
          </div>

          <ShareRow
            className="flex-none border-t border-black/10 px-5 pb-5 pt-4 sm:px-6"
            getBlob={getBlob}
            fileName={`week-${report.weekStart}-${format}.png`}
            caption={(target) => weekCaption(report, inviteLink.url, target)}
            link={(target) => trackedLink(inviteLink.url, target, "weekcard")}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default WeekCardDialog;
