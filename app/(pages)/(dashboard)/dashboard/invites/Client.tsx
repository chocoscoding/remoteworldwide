"use client";

import { FC, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Copy, CornerDownRight, Gift, Instagram, Linkedin, MessageCircle, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import type { PillProps } from "@/app/components/dashboard/ui/Pill";
import ShareWinModal from "@/app/components/dashboard/modals/ShareWinModal";
import RewardModal from "@/app/components/dashboard/modals/RewardModal";
import { CHAIN } from "@/app/lib/dashboard/mock-data";

// ---------------------------------------------------------------------------
// Local content — this screen's mock data isn't shared with any other
// screen, so it's kept here rather than in mock-data.ts.
// ---------------------------------------------------------------------------

interface CreditEntry {
  id: string;
  label: string;
  amount: string;
}

const CREDIT_BREAKDOWN: CreditEntry[] = [
  { id: "credit-invites", label: "4 invites subscribed", amount: "+20" },
  { id: "credit-second-degree", label: "2 second-degree subscriptions", amount: "+4" },
  { id: "credit-pod-goal", label: "Pod goal hit × 2", amount: "+10" },
  { id: "credit-top-3", label: "Ranked top 3", amount: "+4" },
];

const CREDITS_THIS_MONTH = CREDIT_BREAKDOWN.reduce((sum, entry) => sum + Number(entry.amount), 0);

type ChannelId = "whatsapp" | "instagram" | "linkedin" | "copy";

interface Channel {
  id: ChannelId;
  label: string;
  icon: LucideIcon;
}

const CHANNELS: Channel[] = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "copy", label: "Copy link", icon: Copy },
];

const INVITE_LINK = "remoteworldwide.net/j/amara";

/** Maps a chain row's tag copy to a Pill tone. */
const tagVariant = (tag: string): NonNullable<PillProps["variant"]> => {
  if (tag.startsWith("+")) return "positive";
  if (tag === "Pending") return "neutral";
  return "outline-dashed"; // "Not yet"
};

const initialsFor = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const InvitesClient: FC = () => {
  const [copied, setCopied] = useState(false);
  const [shareWinOpen, setShareWinOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`https://${INVITE_LINK}`).catch(() => {});
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleShareConfirm = () => {
    setShareWinOpen(false);
    setRewardOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Invite friends</h1>
          <Pill variant="neutral" className="gap-1.5 flex-none hidden sm:inline-flex">
            <Gift className="h-3 w-3" />
            5 credits when someone you invited subscribes
          </Pill>
        </div>
        <StickerButton variant="primary" size="md" onClick={() => setShareWinOpen(true)}>
          <Share2 className="h-4 w-4" />
          Share a win
        </StickerButton>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1180px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
          {/* Main column */}
          <div className="flex flex-col gap-5 min-w-0">
            {/* Lime hero — personal invite link */}
            <div className="relative overflow-hidden rounded-[18px] bg-secondary text-primary p-7">
              <div aria-hidden className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/40 blur-3xl pointer-events-none" />

              <div className="relative">
                <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-primary/60 mb-3">Your invite link</p>
                <h2 className="text-2xl font-bold mb-1.5 max-w-[520px]">Share your link — 5 credits when they subscribe.</h2>
                <p className="text-sm text-primary/70 leading-relaxed mb-6 max-w-[520px]">
                  Every friend who joins through your link starts a new chain — and their friends who join earn you
                  credits too.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[240px] rounded-lg bg-white/70 border border-black/10 px-4 py-3">
                    <span className="text-sm font-semibold text-primary truncate block">{INVITE_LINK}</span>
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

            {/* Your chain */}
            <DashCard className="p-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[15px] font-bold text-primary">Your chain</p>
                <span className="text-xs text-black/45">{CHAIN.length} people</span>
              </div>
              <p className="text-xs text-black/45 mb-5">
                Friends you invited, and the friends they invited — two levels deep.
              </p>

              <div className="flex flex-col divide-y divide-black/8">
                {CHAIN.map((row) => (
                  <div
                    key={row.name}
                    className={cn("flex items-center gap-3 py-3.5 first:pt-0 last:pb-0", row.depth === 2 && "pl-6")}>
                    {row.depth === 2 && <CornerDownRight className="h-3.5 w-3.5 flex-none text-black/25" />}
                    <span className="h-9 w-9 flex-none rounded-full bg-[#f0f0ea] text-primary font-extrabold text-xs flex items-center justify-center">
                      {initialsFor(row.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-primary truncate">{row.name}</p>
                      <p className="text-xs text-black/45 truncate">{row.meta}</p>
                    </div>
                    <Pill variant={tagVariant(row.tag)} className="flex-none">
                      {row.tag}
                    </Pill>
                  </div>
                ))}
              </div>
            </DashCard>
          </div>

          {/* Right rail */}
          <div className="flex flex-col gap-5 min-w-0">
            {/* Credits earned */}
            <DashCard className="p-6">
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-[15px] font-bold text-primary">Credits earned</p>
                <span className="text-2xl font-bold text-primary tabular-nums">{CREDITS_THIS_MONTH}</span>
              </div>
              <p className="text-xs text-black/45 mb-5">This month</p>

              <div className="flex flex-col divide-y divide-black/8">
                {CREDIT_BREAKDOWN.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm text-black/70">{entry.label}</span>
                    <span className="text-sm font-bold text-[#6c7a1e] flex-none tabular-nums">{entry.amount}</span>
                  </div>
                ))}
              </div>
            </DashCard>

            {/* Where to send it */}
            <DashCard className="p-6">
              <p className="text-[15px] font-bold text-primary mb-4">Where to send it</p>
              <div className="grid grid-cols-2 gap-2.5">
                {CHANNELS.map((channel) => {
                  const isCopy = channel.id === "copy";
                  const Icon = isCopy && copied ? Check : channel.icon;
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={isCopy ? handleCopy : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-3 text-left cursor-pointer transition-colors",
                        isCopy && copied
                          ? "border-[#6c7a1e]/30 bg-[#f0f0ea] text-[#6c7a1e]"
                          : "border-black/10 text-primary hover:border-black/25"
                      )}>
                      <Icon className="h-4 w-4 flex-none" />
                      <span className="text-xs font-semibold truncate">{isCopy && copied ? "Copied ✓" : channel.label}</span>
                    </button>
                  );
                })}
              </div>
            </DashCard>
          </div>
        </div>
      </main>

      {/* Share a win → celebrate reward */}
      <ShareWinModal open={shareWinOpen} onOpenChange={setShareWinOpen} tier="Weekly goal" onConfirm={handleShareConfirm} />
      <RewardModal
        open={rewardOpen}
        onOpenChange={setRewardOpen}
        amount={2}
        title="Three wins shared"
        body="Sharing your weekly goal counted toward this month's streak — 2 credits are on their way to your balance."
        balance={40}
      />
    </div>
  );
};

export default InvitesClient;
