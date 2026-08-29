"use client";

import { FC, useState } from "react";
import { Check, Copy, Gift } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import type { PillProps } from "@/app/components/dashboard/ui/Pill";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import ShareChannelDialog, { type ShareChannel } from "@/app/components/dashboard/invites/ShareChannelDialog";
import { INVITES } from "@/app/lib/dashboard/mock-data";
import type { InviteRow } from "@/app/lib/dashboard/types";

// ---------------------------------------------------------------------------
// One rule, applied everywhere on this screen: a credit exists because
// someone you invited subscribed. There is no second level and no other
// source, so the totals below are *derived* from the invite list rather than
// written down beside it — the two can't drift apart.
// ---------------------------------------------------------------------------

const CREDITS_PER_SUBSCRIBER = 5;

const SUBSCRIBED = INVITES.filter((i) => i.status === "subscribed");
const CREDITS_EARNED = SUBSCRIBED.length * CREDITS_PER_SUBSCRIBER;

const STATUS_META: Record<InviteRow["status"], { label: string; variant: NonNullable<PillProps["variant"]> }> = {
  subscribed: { label: `+${CREDITS_PER_SUBSCRIBER} credits`, variant: "positive" },
  joined: { label: "Joined", variant: "neutral" },
  invited: { label: "Not yet", variant: "outline-dashed" },
};

const INVITE_LINK = "remoteworldwide.net/j/amara";

const InvitesClient: FC = () => {
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState<ShareChannel | null>(null);

  const handleCopy = () => {
    setCopied(true);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`https://${INVITE_LINK}`).catch(() => {});
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="whitespace-nowrap text-[17px] font-bold text-primary">Invite friends</h1>
          <Pill variant="neutral" className="hidden flex-none gap-1.5 sm:inline-flex">
            <Gift className="h-3 w-3" />
            {CREDITS_PER_SUBSCRIBER} credits when someone you invited subscribes
          </Pill>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-8 py-7 pb-14">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_340px]">
          {/* Main column */}
          <div className="flex min-w-0 flex-col gap-5">
            {/* Lime hero — personal invite link */}
            <div className="relative overflow-hidden rounded-[18px] bg-secondary p-7 text-primary">
              <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/40 blur-3xl" />

              <div className="relative">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-primary/60">Your invite link</p>
                <h2 className="mb-1.5 max-w-[520px] text-2xl font-bold">
                  Share your link — {CREDITS_PER_SUBSCRIBER} credits when they subscribe.
                </h2>
                <p className="mb-6 max-w-[520px] text-sm leading-relaxed text-primary/70">
                  That is the whole thing: someone joins on your link, they subscribe, you earn. Nothing else on Remote Worldwide earns
                  credits.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[240px] flex-1 rounded-lg border border-black/10 bg-white/70 px-4 py-3">
                    <span className="block truncate text-sm font-semibold text-primary">{INVITE_LINK}</span>
                  </div>
                  <StickerButton variant="primary" size="md" shadowColor="#ffffff" onClick={handleCopy}>
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied ✓
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy link
                      </>
                    )}
                  </StickerButton>
                </div>
              </div>
            </div>

            {/* People you invited */}
            <DashCard className="p-6">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[15px] font-bold text-primary">People you invited</p>
                <span className="text-xs text-black/60">{INVITES.length} people</span>
              </div>
              <p className="mb-5 text-xs text-black/60">
                {SUBSCRIBED.length} of {INVITES.length} have subscribed.
              </p>

              <div className="flex flex-col divide-y divide-black/8">
                {INVITES.map((row) => {
                  const meta = STATUS_META[row.status];
                  return (
                    <div key={row.name} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                      <Avatar name={row.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-primary">{row.name}</p>
                        <p className="truncate text-xs text-black/60">{row.meta}</p>
                      </div>
                      <Pill variant={meta.variant} className="flex-none">
                        {meta.label}
                      </Pill>
                    </div>
                  );
                })}
              </div>
            </DashCard>
          </div>

          {/* Right rail */}
          <div className="flex min-w-0 flex-col gap-5">
            {/* Credits earned */}
            <DashCard className="p-6">
              <div className="mb-1 flex items-baseline justify-between">
                <p className="text-[15px] font-bold text-primary">Credits earned</p>
                <span className="text-2xl font-bold tabular-nums text-primary">{CREDITS_EARNED}</span>
              </div>
            </DashCard>
          </div>
        </div>
      </main>

      <ShareChannelDialog channel={channel} onOpenChange={(open) => !open && setChannel(null)} inviteLink={INVITE_LINK} />
    </div>
  );
};

export default InvitesClient;
