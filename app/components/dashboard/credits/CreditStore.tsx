"use client";

// What credits are actually for.
//
// This ships in the same phase as the earning, deliberately. A balance that
// only ever goes up, with nothing to spend it on, is a currency users read as
// fake — and once they've read it that way, the milestone payouts stop landing
// as rewards.
//
// Also the only surface that shows the ledger. Every row of the balance has a
// reason attached, so "where did my credits go" is answerable.

import { type FC } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { SPEND_CATALOGUE, priceOf } from "@/app/lib/dashboard/credits";
import { shortDateLabel } from "@/app/lib/dashboard/streak";

const CreditStore: FC = () => {
  const { creditsOpen, closeCredits, credits, ledger, spend, current } = useActivity();

  return (
    <Dialog open={creditsOpen} onOpenChange={(o) => !o && closeCredits()}>
      <DialogContent className="bg-white rounded-[20px] border-2 border-[#222325] p-0 max-w-2xl overflow-hidden gap-0 max-h-[90vh] overflow-y-auto scrollbar-neo">
        {/* Balance */}
        <div className="relative overflow-hidden bg-primary px-7 pt-7 pb-6 text-white">
          <div aria-hidden className="pointer-events-none absolute -bottom-10 right-6 h-28 w-28 rotate-12 rounded-2xl bg-secondary/10" />
          <div className="relative">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.12em] text-secondary mb-3">Your credits</DialogTitle>
            <div className="flex items-baseline gap-2">
              <span className="text-[52px] font-extrabold leading-none tabular-nums">{credits}</span>
              <span className="text-base text-white/55">available</span>
            </div>
            <DialogDescription className="mt-2 text-sm text-white/55">
              Earned by keeping your streak. Spend them on the things below.
            </DialogDescription>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-7 px-7 py-6">
          {/* Catalogue */}
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-primary mb-3">Spend</p>
            <div className="flex flex-col gap-2">
              {SPEND_CATALOGUE.map((item) => {
                const cost = priceOf(item, current);
                const affordable = credits >= cost;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3.5 py-3",
                      affordable ? "border-black/12 bg-white" : "border-black/8 bg-[#fbfbf7]"
                    )}>
                    <span
                      className={cn(
                        "h-9 w-9 flex-none rounded-md border flex items-center justify-center",
                        affordable ? "border-black/15 bg-[#f6faea] text-primary" : "border-black/10 text-black/25"
                      )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-bold", affordable ? "text-primary" : "text-black/45")}>{item.label}</p>
                      <p className="text-[11px] text-black/45 truncate">{item.detail}</p>
                    </div>
                    <StickerButton
                      variant={affordable ? "primary" : "outline"}
                      size="sm"
                      disabled={!affordable}
                      onClick={() => spend(item)}>
                      {cost}
                    </StickerButton>
                  </div>
                );
              })}
            </div>
            {credits < Math.min(...SPEND_CATALOGUE.map((i) => priceOf(i, current))) && (
              <p className="mt-3 text-xs text-black/45">Keep your streak going — every reward rung pays into this balance.</p>
            )}
          </div>

          {/* Ledger */}
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-primary mb-1">History</p>
            <p className="text-xs text-black/45 mb-3">Every credit has a reason.</p>
            <div className="flex flex-col divide-y divide-black/[0.06]">
              {[...ledger].reverse().map((e) => (
                <div key={e.id} className="flex items-start gap-2 py-2">
                  <span
                    className={cn(
                      "flex-none text-xs font-bold tabular-nums",
                      e.delta >= 0 ? "text-primary" : "text-black/40"
                    )}>
                    {e.delta >= 0 ? "+" : ""}
                    {e.delta}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-black/60 truncate">{e.reason}</span>
                    <span className="block text-[10px] text-black/35">{shortDateLabel(e.at.slice(0, 10))}</span>
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

export default CreditStore;
