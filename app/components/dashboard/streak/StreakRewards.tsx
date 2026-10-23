"use client";

import { useState, type FC } from "react";
import { Check, Gift, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { milestonesUpTo, nextMilestone } from "@/app/lib/dashboard/streak";
import { GIFT_CATALOGUE, GIFT_POOLS } from "@/app/lib/dashboard/gifts";
import { milestoneGiftRef } from "@/app/lib/streak/types";
import { useStreak } from "./StreakContext";
import StreakEmblem from "./StreakEmblem";

export interface StreakRewardsProps {
  dark?: boolean;
  className?: string;
}

const StreakRewards: FC<StreakRewardsProps> = ({ dark = false, className }) => {
  const { current, claimed, gifts } = useStreak();
  const [hovered, setHovered] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const upcoming = nextMilestone(current);
  const milestones = milestonesUpTo(current);
  const ladder = milestones.some((m) => m.days === upcoming.days) ? milestones : [...milestones, upcoming];
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}>
      {ladder.map((m) => {
        const earned = claimed.includes(m.days) || current >= m.days;
        const isNext = upcoming.days === m.days && !earned;
        const drawn = gifts.find((g) => g.refId === milestoneGiftRef(m.days));
        return (
          <div key={m.days} onMouseEnter={() => setHovered(m.days)} onMouseLeave={() => setHovered(null)} className={cn(
            "relative rounded-lg border px-3 py-2",
            earned ? "border-[#b1c44a] bg-[#edf4c8]" : isNext ? "border-[#b3c446] bg-white ring-2 ring-[#e1f073]/65" : dark ? "border-white/15 bg-white/[0.06]" : "border-black/10 bg-white",
          )}>
            <div className="flex items-center justify-between gap-1">
              <span className={cn("text-[9px] font-bold uppercase tracking-wider", dark && !earned ? "text-white/60" : "text-black/50")}>Day {m.days}</span>
              {earned ? <Check aria-label="Earned" className="h-3.5 w-3.5 text-[#526512]" /> : isNext ? <span className="text-[9px] font-bold text-[#5b6b13]">UP NEXT</span> : <Lock aria-label="Locked" className={cn("h-3 w-3", dark ? "text-white/40" : "text-black/30")} />}
            </div>
            <StreakEmblem days={m.days} active={hovered === m.days || expanded.has(m.days)} className={cn("mx-auto h-11 w-11", !earned && !isNext && "opacity-80")} />
            <p className={cn("text-center text-sm font-bold", dark && !earned ? "text-white" : "text-primary")}>{m.label}</p>
            <p className={cn("mt-1 flex items-center justify-center gap-1 text-center text-[10px]", dark && !earned ? "text-white/65" : "text-black/60")}>
              {m.giftTier && <Gift className="h-3 w-3 shrink-0" />}
              {drawn ? GIFT_CATALOGUE[drawn.kind].label : m.giftTier ? m.giftTier === "big" ? "Premium surprise gift" : "Surprise gift" : "Your first milestone"}
            </p>
            {isNext && <p className="mt-1 text-center text-[10px] font-bold text-[#5b6b13]">{m.days - current} {m.days - current === 1 ? "day" : "days"} to go</p>}
            {(m.giftTier || m.perk) && <details onToggle={(event) => { const open = event.currentTarget.open; setExpanded((previous) => { const next = new Set(previous); if (open) next.add(m.days); else next.delete(m.days); return next; }); }} className={cn("mt-1 text-[10px]", dark && !earned ? "text-white/60" : "text-black/50")}>
              <summary className="cursor-pointer text-center underline decoration-dotted underline-offset-2">Reward details</summary>
              <p className="mt-2 leading-relaxed">{m.giftTier && <>One gift from: {GIFT_POOLS[m.giftTier].map((kind) => GIFT_CATALOGUE[kind].label).join(", ")}.</>} {m.perk && <>Also includes {m.perk.toLowerCase()}.</>} Earned once.</p>
            </details>}
          </div>
        );
      })}
    </div>
  );
};
export default StreakRewards;
