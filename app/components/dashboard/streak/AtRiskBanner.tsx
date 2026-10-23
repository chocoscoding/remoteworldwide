"use client";

// The one in-app nudge.
//
// §8 asks for a notification at the user's hunt hour plus an at-risk banner in
// the evening. Both reminders are emails now, sent by the events service
// (`pushStreakReminder`): the hunt-hour one, and the "streak at risk" one at
// 6pm, six hours before midnight. This is the in-app half, from the same hour.
// "Local" is the user's own clock as the server reads it (their settings
// timezone); the 4am grace hour is a kindness, never promised.
//
// Only an unprotected run gets this extra nudge. The streak display still
// asks for today's action when a backup freeze is held.
//
// Three things it will not do: appear on a rest day, appear while the search
// is paused, or say anything about a streak you have already lost. There is no
// after-the-fact guilt copy anywhere in this system.

import { type FC } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { streakStatus } from "@/app/lib/dashboard/streak-status";
import { AT_RISK_HOUR } from "@/app/lib/dashboard/credits";

const AtRiskBanner: FC = () => {
  const streak = useActivity();
  const { current, openLog, atRiskDismissed, dismissAtRisk, nowHour, streakLoading } = streak;

  if (atRiskDismissed) return null;
  if (streakLoading || !streakStatus(streak).urgent) return null;
  if (nowHour < AT_RISK_HOUR) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[14px] border-2 border-[#222325] bg-[#e1f073] px-4 py-3">
      <AlertTriangle className="h-4 w-4 flex-none text-primary" />
      <p className="min-w-0 flex-1 text-sm font-bold text-primary">
        {`Keep your ${current}-day streak. Log an action today; no freeze can cover this day.`}
      </p>
      <StickerButton variant="primary" size="sm" onClick={openLog}>
        Log one
      </StickerButton>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissAtRisk}
        className="h-6 w-6 flex-none rounded-md text-primary/50 flex items-center justify-center transition-colors hover:bg-black/10 hover:text-primary cursor-pointer">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default AtRiskBanner;
