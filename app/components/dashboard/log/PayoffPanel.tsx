"use client";

// The payoff for logging.
//
// The point of the brief's §3: logging is not a tax to keep a number alive,
// it's how the user gets the ATS score, the tailoring route and the follow-up
// reminder. So this panel appears immediately on save with no extra navigation.
//
// The streak animation runs once and does not gate anything — the score and the
// actions are readable the instant the panel mounts.

import { type FC } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Bell, Sparkles, Trophy, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import StreakFlame from "@/app/components/dashboard/streak/StreakFlame";
import { useActivity, type LogApplicationResult } from "@/app/components/dashboard/activity/ActivityProvider";
import { scoreTier } from "@/app/lib/dashboard/ats-stub";
import { shortDateLabel, tierFor } from "@/app/lib/dashboard/streak";

export interface PayoffPanelProps {
  result: LogApplicationResult;
  onClose: () => void;
}

const PayoffPanel: FC<PayoffPanelProps> = ({ result, onClose }) => {
  const { current, logPulse, pendingMilestone } = useActivity();
  const reduceMotion = useReducedMotion();
  const { application, score, followUpOn } = result;
  const tier = tierFor(current);
  const band = scoreTier(score.score);

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
            {pendingMilestone.label} unlocked — +{pendingMilestone.credits} credits
            {pendingMilestone.perk ? ` · ${pendingMilestone.perk}` : ""}
          </p>
        </div>
      )}

      <div className="px-7 py-6">
        {/* ATS score against this posting */}
        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">Match against your resume</span>
            <Pill variant={band.tone === "positive" ? "positive" : band.tone === "urgent" ? "urgent" : "neutral"}>{band.label}</Pill>
          </div>
          <div className="flex items-end gap-2.5">
            <span className="text-[40px] font-extrabold leading-none text-primary tabular-nums">{score.score}</span>
            <span className="mb-1.5 text-sm text-black/45">out of 100</span>
          </div>
          <ProgressBar value={score.score} className="mt-2.5" />
        </div>

        {/* The 3 highest-impact gaps */}
        {score.gaps.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">
              Biggest gaps ({score.gaps.length})
            </p>
            <div className="flex flex-col gap-1.5">
              {score.gaps.map((g) => (
                <div key={g.id} className="flex items-center gap-2 rounded-md border border-black/12 bg-[#fbfbf7] px-3 py-2">
                  <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-[#222325]" />
                  <span className="text-sm text-primary">{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
