"use client";

// Your gifts — the reward system's inventory. No shop, no prices: milestones
// and strong moments GRANT these (freezes, backfills, rewrites, Pro days,
// priority intros, restores), and the owner redeems them whenever they
// choose. Referral credits are the invites page's story and never appear
// here.
//
// Also the only surface that shows the gift history — every row has the
// reason it was earned, so "where did this come from" is always answerable.

import { type FC } from "react";
import { Gift } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { GIFT_CATALOGUE, heldOf, type GiftKind } from "@/app/lib/dashboard/gifts";
import { shortDateLabel } from "@/app/lib/dashboard/streak";

const KINDS = Object.keys(GIFT_CATALOGUE) as GiftKind[];

const GiftStore: FC = () => {
  const { giftsOpen, closeGifts, gifts, giftsWaiting, redeemGift } = useActivity();

  return (
    <Dialog open={giftsOpen} onOpenChange={(o) => !o && closeGifts()}>
      <DialogContent className="bg-white rounded-[20px] border-2 border-[#222325] p-0 max-w-2xl overflow-hidden gap-0 max-h-[90vh] overflow-y-auto scrollbar-neo">
        {/* Header */}
        <div className="relative overflow-hidden bg-primary px-7 pt-7 pb-6 text-white">
          <div aria-hidden className="pointer-events-none absolute -bottom-10 right-6 h-28 w-28 rotate-12 rounded-2xl bg-secondary/10" />
          <div className="relative">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.12em] text-secondary mb-3">Your gifts</DialogTitle>
            <div className="flex items-baseline gap-2">
              <span className="text-[52px] font-extrabold leading-none tabular-nums">{giftsWaiting}</span>
              <span className="text-base text-white/55">waiting</span>
            </div>
            <DialogDescription className="mt-2 text-sm text-white/55">
              Earned by showing up and by real wins. Use them whenever you choose — they don&apos;t expire.
            </DialogDescription>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-7 px-7 py-6">
          {/* Inventory */}
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-primary mb-3">Waiting for you</p>
            {giftsWaiting === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-black/20 px-4 py-8 text-center">
                <Gift className="h-5 w-5 text-black/30" />
                <p className="text-xs leading-relaxed text-black/55">
                  Nothing waiting right now. Milestones, full weeks and real wins — interviews, offers, answered
                  questions — all land here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {KINDS.map((kind) => {
                  const count = heldOf(gifts, kind);
                  if (count === 0) return null;
                  const spec = GIFT_CATALOGUE[kind];
                  const Icon = spec.icon;
                  return (
                    <div key={kind} className="flex items-center gap-3 rounded-lg border border-black/12 bg-white px-3.5 py-3">
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-black/15 bg-[#f6faea] text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-primary">
                          {spec.label}
                          {count > 1 && <span className="ml-1.5 text-xs font-bold text-black/45">×{count}</span>}
                        </p>
                        <p className="truncate text-[11px] text-black/45">{spec.detail}</p>
                      </div>
                      <StickerButton variant="primary" size="sm" onClick={() => redeemGift(kind)}>
                        Use
                      </StickerButton>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* History */}
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-primary mb-1">History</p>
            <p className="text-xs text-black/45 mb-3">Every gift has a reason.</p>
            <div className="flex flex-col divide-y divide-black/[0.06]">
              {[...gifts].reverse().map((g) => (
                <div key={g.id} className="flex items-start gap-2 py-2">
                  <span className="flex-none text-sm" aria-hidden>
                    🎁
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-black/60">
                      {GIFT_CATALOGUE[g.kind].label} — {g.reason}
                    </span>
                    <span className="block text-[10px] text-black/35">
                      {shortDateLabel(g.at.slice(0, 10))}
                      {g.usedAt ? " · used" : " · waiting"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GiftStore;
