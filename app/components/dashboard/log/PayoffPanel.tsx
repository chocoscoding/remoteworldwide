"use client";

// The payoff for logging.
//
// The point of the brief's §3: logging is not a tax to keep a number alive,
// it's how the user gets the ATS score, the tailoring route and the follow-up
// reminder. So this panel appears immediately on save with no extra navigation.
//
// The streak animation runs once and does not gate anything — the actions are
// readable the instant the panel mounts.
//
// ── The match score is a real scan, or it is not shown ─────────────────────
// This panel used to band a keyword-overlap estimate (`ats-stub.ts`, against
// mock keywords) and present it as "Match against your resume". It now reads
// the latest scan the user already ran against this posting — free, stored by
// the AI service — and names the resume and the date it came from. With no
// such scan it says so and links to the scorer, where a scan costs what it
// costs; logging an application never spends a credit on the user's behalf.

import { type FC } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Bell, Loader2, ScanSearch, Sparkles, TriangleAlert, Trophy, Wand2 } from "lucide-react";
import TimeAgo from "timeago-react";
import { cn } from "@/lib/utils";
import { DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import StreakFlame from "@/app/components/dashboard/streak/StreakFlame";
import { useActivity, type LogApplicationResult } from "@/app/components/dashboard/activity/ActivityProvider";
import { SCAN_CREDITS, scanTier } from "@/app/lib/ats/api";
import type { StoredScan } from "@/app/lib/ats/types";
import { shortDateLabel, tierFor } from "@/app/lib/dashboard/streak";
import { useStoredScanQuery } from "@/hooks/queries/useAtsQueries";

/** Where "scan it" goes: the ATS scorer, which prices a scan before running one. */
const ATS_HREF = "/dashboard/ats";

/** The panel shows the top few; the scorer has the whole list. */
const MAX_GAPS = 3;

export interface PayoffPanelProps {
  result: LogApplicationResult;
  onClose: () => void;
}

const LABEL = "text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45";

/** The one link out when there is no score to show — to the scorer, with the price on it. */
const ScanLink: FC<{ onClose: () => void; children: string }> = ({ onClose, children }) => (
  <Link
    href={ATS_HREF}
    onClick={onClose}
    className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
    <ScanSearch className="h-3.5 w-3.5" />
    {children} · {SCAN_CREDITS} credit
  </Link>
);

/** The match block: a stored scan's number with where it came from, or an honest account of why there is none. */
const MatchBlock: FC<{ hasPosting: boolean; loading: boolean; failed: boolean; scan: StoredScan | null | undefined; onClose: () => void }> = ({
  hasPosting,
  loading,
  failed,
  scan,
  onClose,
}) => {
  if (!hasPosting) {
    return (
      <div className="mb-5">
        <span className={LABEL}>Match against your resume</span>
        <p className="mt-2 text-sm leading-relaxed text-black/60">
          No job description came with this one, so there&apos;s nothing to score against. Scan a resume against the posting to see how it matches.
        </p>
        <ScanLink onClose={onClose}>Open the ATS scorer</ScanLink>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mb-5">
        <span className={LABEL}>Match against your resume</span>
        <p className="mt-2 flex items-center gap-2 text-sm text-black/55">
          <Loader2 className="h-4 w-4 animate-spin" />
          Looking for a scan of this posting…
        </p>
      </div>
    );
  }

  if (failed || !scan) {
    return (
      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className={LABEL}>Match against your resume</span>
          {!failed && <Pill variant="outline-dashed">Not scanned yet</Pill>}
        </div>
        <p className="text-sm leading-relaxed text-black/60">
          {failed
            ? "We couldn't check for an earlier scan of this posting just now."
            : "You haven't scanned a resume against this posting. A scan shows how well it matches and which requirements it misses."}
        </p>
        <ScanLink onClose={onClose}>Scan it in the ATS scorer</ScanLink>
      </div>
    );
  }

  const band = scanTier(scan.score);
  const gaps = scan.gaps.filter((gap) => !gap.present).slice(0, MAX_GAPS);
  return (
    <>
      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className={LABEL}>Match against your resume</span>
          <Pill variant={band.tone === "positive" ? "positive" : band.tone === "urgent" ? "urgent" : "neutral"}>{band.label}</Pill>
        </div>
        <div className="flex items-end gap-2.5">
          <span className="text-[40px] font-extrabold leading-none text-primary tabular-nums">{scan.score}</span>
          <span className="mb-1.5 text-sm text-black/45">out of 100</span>
        </div>
        <ProgressBar value={scan.score} className="mt-2.5" />
        {/* Never a number without the document that earned it and when. */}
        <p className="mt-2 text-xs text-black/50">
          {scan.fileName ? <span className="font-semibold text-black/65">{scan.fileName}</span> : "A resume you've since removed"} · scanned{" "}
          <TimeAgo datetime={scan.scannedAt} opts={{ minInterval: 10 }} />
        </p>
        {scan.degraded && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-black/50">
            <TriangleAlert className="mt-px h-3 w-3 flex-none" />
            {scan.degradedReason ?? "Scored on a reduced path — treat the match as approximate."}
          </p>
        )}
      </div>

      {/* The heaviest requirements that scan found missing. */}
      {gaps.length > 0 && (
        <div className="mb-5">
          <p className={cn(LABEL, "mb-2")}>Biggest gaps ({gaps.length})</p>
          <div className="flex flex-col gap-1.5">
            {gaps.map((g) => (
              <div key={g.id} className="flex items-center gap-2 rounded-md border border-black/12 bg-[#fbfbf7] px-3 py-2">
                <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-[#222325]" />
                <span className="text-sm text-primary">{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

const PayoffPanel: FC<PayoffPanelProps> = ({ result, onClose }) => {
  const { current, logPulse, pendingMilestone } = useActivity();
  const reduceMotion = useReducedMotion();
  const { application, followUpOn } = result;
  const tier = tierFor(current);
  // The same cached lookup the log dialog started while the fields were being
  // checked, so this is usually already answered on mount.
  const hasPosting = Boolean(application.jdText?.trim());
  const stored = useStoredScanQuery(application.jdText);

  return (
    <div>
      {/* Streak confirmation — animated once, and never in front of the content */}
      <div className="relative overflow-hidden bg-primary px-7 py-5 text-white">
        <div aria-hidden className="pointer-events-none absolute -bottom-10 right-4 h-24 w-24 rotate-12 rounded-2xl bg-secondary/10" />
        <div className="relative flex items-center gap-3">
          <StreakFlame tier={tier} size={30} pulse={logPulse} dimmed={current === 0} />
          <div className="min-w-0">
            {/* Radix needs an accessible name on every dialog; this doubles as
                the panel's heading. */}
            <DialogTitle className="sr-only">Application logged</DialogTitle>
            <motion.p
              initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="text-[22px] font-extrabold leading-none tabular-nums">
              {current} <span className="text-sm font-bold text-white/55">{current === 1 ? "day" : "days"}</span>
            </motion.p>
            <p className="mt-1 truncate text-xs text-white/50">
              Logged {application.role} at {application.company}
            </p>
          </div>
        </div>
      </div>

      {/* A milestone earned by this log shows here rather than as a second
          modal stacked on the payoff — the full celebration plays on close. */}
      {pendingMilestone && (
        <div className="flex items-center gap-2.5 border-b-2 border-[#222325] bg-[#e1f073] px-7 py-3">
          <Trophy className="h-4 w-4 flex-none text-primary" />
          <p className="text-sm font-bold text-primary">
            {pendingMilestone.label} unlocked — a gift is waiting
            {pendingMilestone.perk ? ` · ${pendingMilestone.perk}` : ""}
          </p>
        </div>
      )}

      <div className="px-7 py-6">
        {/* ATS score against this posting — a stored scan, or why there is none */}
        <MatchBlock hasPosting={hasPosting} loading={stored.isPending && hasPosting} failed={stored.isError} scan={stored.data} onClose={onClose} />

        {/* Follow-up confirmation */}
        <div className={cn("mb-6 flex items-center gap-2.5 rounded-md border border-black/12 bg-white px-3 py-2.5")}>
          <Bell className="h-3.5 w-3.5 flex-none text-black/45" />
          <p className="text-xs text-black/60">
            Follow-up reminder set for <span className="font-bold text-primary">{shortDateLabel(followUpOn)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/dashboard/resume">
            <StickerButton variant="primary" size="md">
              <Wand2 className="h-4 w-4" />
              Tailor my resume for this
            </StickerButton>
          </Link>
          <Link href="/dashboard/tracker">
            <StickerButton variant="outline" size="md">
              <Sparkles className="h-4 w-4" />
              Open tracker
            </StickerButton>
          </Link>
          <button type="button" onClick={onClose} className="ml-auto text-xs font-semibold text-black/45 hover:text-primary cursor-pointer">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayoffPanel;
