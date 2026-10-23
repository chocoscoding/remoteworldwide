"use client";

import { useState, type FC } from "react";
import { ArrowRight, Gift, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { GIFT_CATALOGUE, giftStatusLabel, heldOf, type GiftKind } from "@/app/lib/dashboard/gifts";
import { milestonesUpTo, nextMilestone, shortDateLabel } from "@/app/lib/dashboard/streak";
import { proUntilLabel } from "@/app/lib/settings/boost";
import RewriteGiftDialog from "./RewriteGiftDialog";

const KINDS = Object.keys(GIFT_CATALOGUE) as GiftKind[];

const GiftStore: FC = () => {
  const { giftsOpen, closeGifts, gifts, redeemGift, current, claimed, openLog, streakLoading } = useActivity();
  const onHold = gifts.filter((g) => !g.usedAt && g.pendingUntil);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const available = KINDS.map((kind) => ({ kind, count: heldOf(gifts, kind) })).filter((item) => item.count > 0);
  const count = available.reduce((sum, item) => sum + item.count, 0);
  const nextGift = milestonesUpTo(current).find((m) => m.giftTier && m.days > current && !claimed.includes(m.days))
    ?? nextMilestone(Math.max(current, ...claimed));

  const handleUseGift = (kind: GiftKind) => {
    if (kind === "rewrite") setRewriteOpen(true);
    else redeemGift(kind);
  };

  return (
    <Dialog open={giftsOpen} onOpenChange={(open) => !open && closeGifts()}>
      <DialogContent className="bg-[#f7f8f2] rounded-[16px] border border-black/15 p-0 max-w-lg gap-0 max-h-[90vh] overflow-y-auto scrollbar-neo">
        <div className="rounded-t-[15px] bg-[#202820] px-7 pb-6 pt-6 text-white">
          <DialogTitle className="text-[10px] font-bold uppercase tracking-[0.16em] text-secondary">Your gifts</DialogTitle>
          <div className="mt-4 flex items-center gap-5">
            <div aria-hidden className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[14px] border border-secondary/25 bg-secondary/10">
              <Gift className="h-10 w-10 text-secondary" strokeWidth={1.5} />
              <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-orange-200" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{count > 0 ? count + (count === 1 ? " gift. All yours." : " gifts. All yours.") : "Good things ahead."}</p>
              <DialogDescription className="mt-2 text-sm leading-relaxed text-white/65">{count > 0 ? "You've earned these. Use them when you're ready." : "Keep showing up. Turn your progress into perks."}</DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-7 py-5">
          {available.length > 0 ? (
            <div className="space-y-2">
              {available.map(({ kind, count: held }) => {
                const spec = GIFT_CATALOGUE[kind];
                const Icon = spec.icon;
                return (
                  <div key={kind} className="rounded-lg border border-black/10 bg-white p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#edf3d1] text-[#46551c]"><Icon className="h-5 w-5" /></span>
                      <p className="flex-1 text-sm font-bold text-primary">{spec.label}{held > 1 && <span className="ml-1.5 text-xs text-black/50">×{held}</span>}</p>
                      <StickerButton variant="primary" size="sm" onClick={() => handleUseGift(kind)}>Use gift</StickerButton>
                    </div>
                    <details className="ml-[52px] mt-1 text-xs text-black/60"><summary className="cursor-pointer">What it does</summary><p className="mt-2 leading-relaxed">{spec.detail}</p></details>
                  </div>
                );
              })}
            </div>
          ) : !streakLoading ? (
            <div className="rounded-xl border border-black/10 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[9px] font-bold uppercase tracking-wider text-black/55">Next streak gift</p><p className="mt-1 text-lg font-bold text-primary">{nextGift.label}<span className="ml-2 text-xs font-medium text-black/50">Day {nextGift.days}</span></p></div>
                <span className="rounded-full bg-[#edf3d1] px-3 py-1.5 text-xs font-bold text-[#46551c]">{nextGift.days - current} days away</span>
              </div>
              <div className="mt-3"><ProgressBar value={Math.min(100, current / nextGift.days * 100)} height="h-1.5" /></div>
              <p className="mt-2 text-xs text-black/55">A surprise gift, revealed when you reach it.</p>
            </div>
          ) : <p className="text-sm text-black/60">Gifts arrive with milestones and real wins.</p>}

          {onHold.length > 0 && <details className="mt-4 rounded-lg border border-black/10 bg-white p-3 text-xs">
            <summary className="cursor-pointer font-semibold text-primary">{onHold.length} {onHold.length === 1 ? "gift" : "gifts"} on the way</summary>
            <p className="mt-2 text-black/60">Interview and offer gifts land after 3 days if the card is still at that stage.</p>
            {onHold.map((g) => <p key={g.id} className="mt-2 text-black/65" suppressHydrationWarning>{GIFT_CATALOGUE[g.kind].label} · {proUntilLabel(g.pendingUntil!)}</p>)}
          </details>}

          {count === 0 && <StickerButton variant="primary" size="md" className="mt-4 w-full" onClick={() => { closeGifts(); openLog(); }}>Log your next action<ArrowRight className="h-4 w-4" /></StickerButton>}

          {gifts.length > 0 && <details className="mt-5 border-t border-black/10 pt-3">
            <summary className="cursor-pointer text-xs font-semibold text-black/60">Gift history · {gifts.length}</summary>
            <div className="mt-2 divide-y divide-black/10">
              {[...gifts].reverse().map((g) => <div key={g.id} className="py-3 text-xs">
                <p className="font-semibold text-primary">{GIFT_CATALOGUE[g.kind].label}</p>
                <p className="mt-1 leading-relaxed text-black/65">{g.reason}</p>
                <p className="mt-1 text-black/55" suppressHydrationWarning>{shortDateLabel(g.at.slice(0, 10))} · {giftStatusLabel(g, proUntilLabel)}</p>
              </div>)}
            </div>
          </details>}
        </div>
        <RewriteGiftDialog open={rewriteOpen} onOpenChange={setRewriteOpen} onDone={closeGifts} />
      </DialogContent>
    </Dialog>
  );
};
export default GiftStore;
