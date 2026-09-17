"use client";

import type { FC } from "react";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PREP_BILLING_HREF } from "@/app/lib/voice/api";
import { BUTTON_OUTLINE, BUTTON_SOLID } from "../prep-styles";

/**
 * The report exists, but charging for it was refused (402), so the graded
 * sections are withheld until an unlock succeeds.
 *
 * Rendered where the report would be; the recording and transcript above it
 * stay available, which the copy says, so nobody thinks their session was
 * lost. Unlocking charges once, under the same reference the first attempt
 * used, however many times it is pressed.
 */
export interface LockedReportProps {
  /** What the session costs; null when not known. */
  credits: number | null;
  /** The balance, when the page has read it. */
  balance?: number | null;
  onUnlock: () => void;
  /** An unlock request is in flight. */
  unlocking?: boolean;
  /** Why the last unlock didn't go through. */
  error?: string | null;
  topUpHref?: string;
  className?: string;
}

const credit = (n: number) => `${n} ${n === 1 ? "credit" : "credits"}`;

const LockedReport: FC<LockedReportProps> = ({ credits, balance = null, onUnlock, unlocking = false, error = null, topUpHref = PREP_BILLING_HREF, className }) => {
  const shortBy = credits !== null && balance !== null && balance < credits ? credits - balance : null;
  const cost = credits === null ? "this session" : credit(credits);

  return (
    <section aria-label="Report locked" className={cn("relative overflow-hidden rounded-2xl border-2 border-dashed border-black/20 bg-white", className)}>
      {/* A glimpse of what's waiting: shapes only, no data. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden select-none flex-col gap-3 px-7 pt-7 opacity-60 blur-[3px] sm:flex">
        {[78, 54, 66].map((w) => (
          <div key={w} className="flex items-center gap-3">
            <div className="h-2.5 w-24 rounded-full bg-[#e6e6de]" />
            <div className="h-1.5 flex-1 rounded-full bg-[#f0f0ea]">
              <div className="h-full rounded-full bg-[#e1f073]" style={{ width: `${w}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="relative bg-gradient-to-b from-white/70 via-white to-white px-6 pb-6 pt-7 sm:pt-24">
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl border-[1.5px] border-[#222325] bg-[#e1f073] shadow-[2px_2px_0_0_#222325]">
            <Lock className="h-4 w-4 text-[#222325]" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-primary">Your report is ready, and locked for now</h3>
            <p className="mt-1.5 max-w-[520px] text-sm leading-relaxed text-black/60">
              We tried to charge {cost} for this session and your balance didn&apos;t cover it
              {balance !== null && <> (you have {credit(balance)})</>}. Your recording and transcript stay above. Top up, then unlock: you&apos;re
              charged once{credits !== null && <>, {credit(credits)}</>}, and the scores, findings and rewrites appear here.
            </p>
            {shortBy !== null && <p className="mt-1.5 text-xs font-semibold text-black/50">You need {credit(shortBy)} more.</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:pl-[54px]">
          <Link href={topUpHref} className={BUTTON_SOLID}>
            Top up credits
          </Link>
          <button type="button" onClick={onUnlock} disabled={unlocking} aria-busy={unlocking || undefined} className={cn(BUTTON_OUTLINE, "disabled:cursor-default disabled:opacity-60")}>
            {unlocking && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
            {unlocking ? "Unlocking…" : "Unlock report"}
          </button>
        </div>
        {/* Mounted before there is anything to say, so a failure is announced. */}
        <p role="status" className={cn("text-xs text-[#b23c26] sm:pl-[54px]", error && "mt-2.5")}>
          {error}
        </p>
      </div>
    </section>
  );
};

export default LockedReport;
