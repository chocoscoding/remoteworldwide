"use client";

import { type FC } from "react";
import { ArrowRight, Gift, Flame, Share2, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import { milestoneProgress, nextMilestone, tierFor } from "@/app/lib/dashboard/streak";
import { hasWeekToShare } from "@/app/lib/dashboard/week-card";
import { streakStatus } from "@/app/lib/dashboard/streak-status";
import { useStreak } from "./StreakContext";
import StreakEmblem from "./StreakEmblem";
import StreakCalendar from "./StreakCalendar";
import StreakRewards from "./StreakRewards";

export interface StreakPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StreakPanel: FC<StreakPanelProps> = ({ open, onOpenChange }) => {
  const streak = useStreak();
  const { current, longest, freezes, freeFreezes, giftsWaiting, loggedToday, openLog, openGifts, weeks, openWeekCard, repair, openRepair, streakLoading, claimed } = streak;
  const status = streakStatus(streak);
  const tier = tierFor(current);
  const upcoming = nextMilestone(current);
  const alreadyEarned = claimed.includes(upcoming.days);
  const shareWeek = hasWeekToShare(weeks?.current) ? "current" : hasWeekToShare(weeks?.previous) ? "previous" : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#f7f8f2] rounded-[16px] border border-[#222325] p-0 max-w-3xl gap-0 max-h-[92vh] overflow-y-auto scrollbar-neo">
        <div className="relative overflow-hidden rounded-t-[15px] bg-[#202820] px-6 pb-6 pt-6 text-white sm:px-8">
          <DialogTitle className="pr-6 text-[10px] font-bold tracking-[0.18em] uppercase text-secondary">Your streak · built one day at a time</DialogTitle>
          <div className="mt-4 grid grid-cols-[110px_1fr] items-center gap-4 sm:grid-cols-[170px_1fr] sm:gap-6">
            <StreakEmblem days={current} className="h-[110px] w-[110px] sm:h-[170px] sm:w-[170px]" />
            <div>
              <p className="mb-2 text-xs font-semibold text-orange-200">{current === 0 ? "Your fire starts here" : tier.label + " · " + status.label}</p>
              <div className="flex items-baseline gap-2.5"><span className="text-[60px] font-extrabold leading-none tracking-tight tabular-nums sm:text-[76px]">{streakLoading ? "—" : current}</span><span className="text-lg text-white/60">{current === 1 ? "day" : "days"}</span></div>
              <DialogDescription className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">{streakLoading ? "Every run begins with one action." : status.detail}</DialogDescription>
            </div>
          </div>
          {!streakLoading && <div className="mt-4 rounded-xl border border-secondary/30 bg-secondary/[0.08] p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-secondary">{alreadyEarned ? "Reach again" : "Your next milestone"}</p><h3 className="mt-1 text-2xl font-bold">{upcoming.label}</h3></div>
              <div className="text-right"><p className="text-2xl font-bold text-secondary tabular-nums">{upcoming.days - current}<span className="ml-1 text-xs font-medium">{upcoming.days - current === 1 ? "day" : "days"} away</span></p><p className="mt-1 text-[11px] text-white/55">Day {upcoming.days}</p></div>
            </div>
            <p className="mb-3 mt-2 text-xs text-white/70">{alreadyEarned ? "You've earned this milestone before. Rebuild your run toward it." : upcoming.giftTier ? "Reach this milestone to reveal your surprise gift." : "Earn your Spark milestone. Your first surprise gift follows at day 7."}</p>
            <ProgressBar value={milestoneProgress(current)} dark height="h-2" />
          </div>}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <StickerButton variant="secondary" size="md" onClick={() => { onOpenChange(false); openLog(); }}><Flame className="h-4 w-4" />{loggedToday ? "Log another action" : current === 0 ? "Earn day one" : "Keep it going"}<ArrowRight className="h-4 w-4" /></StickerButton>
            <button type="button" className="flex items-center gap-2 rounded-md px-2 py-2 text-xs font-semibold text-white/80 hover:text-secondary" onClick={() => { onOpenChange(false); openGifts(); }}><Gift className="h-4 w-4" />Your gifts{giftsWaiting > 0 && <span className="rounded-full bg-secondary px-1.5 py-0.5 text-primary">{giftsWaiting}</span>}</button>
            {longest > 0 && <span className="ml-auto flex items-center gap-1.5 text-xs text-white/50"><Trophy className="h-3.5 w-3.5" />Best {longest} days</span>}
          </div>
          {repair && <p className="mt-4 text-xs text-white/65">Your previous {repair.brokenStreak}-day run has recovery options. <button type="button" className="font-semibold text-secondary underline underline-offset-2" onClick={() => { onOpenChange(false); openRepair(); }}>View options</button></p>}
        </div>
        <div className="px-6 py-6 sm:px-8">
          <div className="mb-4 flex items-baseline justify-between gap-3"><div><h3 className="text-lg font-bold text-primary">Grow your flame.</h3><p className="mt-1 text-xs text-black/55">New milestones. Bigger gifts. A run worth keeping.</p></div><span className="text-[10px] text-black/45">Rewards earned once</span></div>
          <StreakRewards />
          <details className="mt-5 border-t border-black/10 pt-4">
            <summary className="cursor-pointer text-xs font-semibold text-black/60">Your activity & streak details</summary>
            <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_220px]">
              <StreakCalendar />
              <div className="space-y-4 text-xs leading-relaxed text-black/60">
                <p><strong className="block text-primary">Backup freezes: {freezes}</strong>{freeFreezes} free this week. A freeze is a last resort for one missed day; it does not earn a streak day.</p>
                <p>Milestone gifts are revealed when earned. Returning to a milestone does not award the same gift twice.</p>
                {shareWeek && <button type="button" className="flex items-center gap-2 font-semibold text-primary" onClick={() => { onOpenChange(false); openWeekCard(shareWeek); }}><Share2 className="h-4 w-4" />Share your week</button>}
              </div>
            </div>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default StreakPanel;
