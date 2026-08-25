"use client";

import { FC, useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock, DollarSign, Gift, Heart, Landmark, PartyPopper, Send, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { LANDED_CHECKLIST } from "@/app/lib/dashboard/mock-data";
import type { ChecklistItem } from "@/app/lib/dashboard/types";

// ---------------------------------------------------------------------------
// Local content that isn't shared with any other screen — kept here rather
// than in mock-data.ts, same convention as the other already-built screens.
// ---------------------------------------------------------------------------

interface BannerStat {
  id: string;
  label: string;
  value: string;
}

const BANNER_STATS: BannerStat[] = [
  { id: "apps", label: "Applications sent", value: "34" },
  { id: "loops", label: "Interview loops", value: "3" },
  { id: "referral", label: "Referral used", value: "1" },
  { id: "negotiated", label: "Negotiated up", value: "+$12k" },
];

/**
 * Per-checklist-item contextual hint, keyed by `ChecklistItem.id` from
 * `LANDED_CHECKLIST`. "open" renders a clickable "Open" affordance that
 * expands a short tip note; "pending" renders a passive dashed tag for a
 * step that isn't actionable yet.
 */
const CHECKLIST_HINTS: Record<string, { label: string; variant: "open" | "pending"; note?: string }> = {
  "landed-4": {
    label: "Open",
    variant: "open",
    note: "Bring three things to that conversation: what shipped in week one, one thing that surprised you, and a direct question about how “good” gets measured at day 30.",
  },
  "landed-5": {
    label: "Pending",
    variant: "pending",
  },
};

interface PaymentTopic {
  id: string;
  title: string;
  icon: typeof Landmark;
  blurb: string;
}

const PAYMENT_TOPICS: PaymentTopic[] = [
  {
    id: "invoicing",
    title: "Invoicing & taxes",
    icon: Landmark,
    blurb:
      "Send one invoice a month in USD and keep a simple ledger of what lands. Most Nigeria-based contractors file quarterly — set aside 20–25% of every payment so tax season isn't a scramble.",
  },
  {
    id: "usd",
    title: "Getting USD in cheaply",
    icon: DollarSign,
    blurb:
      "Wise and Payoneer both beat a traditional bank wire on fees and the NGN conversion rate. Compare the live rate on each before you withdraw — the spread moves week to week.",
  },
  {
    id: "timezone",
    title: "Time-zone boundaries",
    icon: Clock,
    blurb:
      "GMT+1 overlaps 4–5 hours with most US teams. Block those hours for meetings and protect the rest as deep-work — put the boundary on your calendar in week one, not after you're already burnt out.",
  },
];

const LandedClient: FC = () => {
  const [items, setItems] = useState<ChecklistItem[]>(LANDED_CHECKLIST);
  // The streak is retired here, not deleted — the final count stays on the
  // profile. It's the proof the whole thing worked.
  const { current, longest, applications, retiredStreak, markHired } = useActivity();
  const finalStreak = retiredStreak ?? current;
  const [archived, setArchived] = useState(false);
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());
  const [story, setStory] = useState("");
  const [shared, setShared] = useState(false);

  const doneCount = items.filter((i) => i.done).length;
  const checklistPct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  const toggleNote = (id: string) => {
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTopic = (id: string) => {
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShare = () => {
    if (!story.trim()) return;
    setShared(true);
  };

  const handleWriteAnother = () => {
    setStory("");
    setShared(false);
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">You got the job</h1>
        </div>
        <Pill variant="neutral" className="gap-1.5 flex-none">
          <PartyPopper className="h-3 w-3" />
          Day 6 of your first 90
        </Pill>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1100px] mx-auto">
        {/* Celebratory banner */}
        <div className="relative overflow-hidden rounded-[18px] bg-secondary text-primary p-7">
          <div aria-hidden className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/40 blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <PartyPopper className="h-4 w-4 text-primary/70" />
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-primary/60">
                Offer accepted · 2 August
              </span>
            </div>

            <h2 className="text-2xl sm:text-[28px] font-bold text-primary mb-6 max-w-[560px] leading-tight">
              Senior Product Designer at Vercel
            </h2>

            <div className="flex flex-wrap gap-3">
              {/* The retired streak leads, ahead of the static banner stats —
                  it's the number they actually built. */}
              <div className="rounded-xl border-2 border-primary bg-white px-4 py-3 min-w-[136px]">
                <p className="flex items-center gap-1.5 text-2xl font-bold leading-none text-primary">
                  <Trophy className="h-4 w-4" />
                  {finalStreak}
                </p>
                <p className="text-xs text-primary/60 mt-1.5">Final streak · retired</p>
              </div>
              {BANNER_STATS.map((stat) => (
                <div key={stat.id} className="rounded-xl bg-white/50 px-4 py-3 min-w-[136px]">
                  <p className="text-2xl font-bold leading-none text-primary">{stat.value}</p>
                  <p className="text-xs text-primary/60 mt-1.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {retiredStreak === null && (
              <button
                type="button"
                onClick={markHired}
                className="mt-5 inline-flex items-center gap-2 rounded-lg border-2 border-primary bg-white px-4 py-2 text-sm font-bold text-primary transition-all hover:shadow-[3px_3px_0_0_#222325] cursor-pointer">
                <Trophy className="h-4 w-4" />
                Retire my streak at {current} days
              </button>
            )}
          </div>
        </div>

        {/* Archive + referral, the two things left to do after an offer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          <DashCard className="p-5">
            <p className="text-[15px] font-bold text-primary mb-1">Your open applications</p>
            <p className="text-xs text-black/45 mb-3">
              {archived
                ? "Archived. Nobody's waiting on you."
                : `${applications.length + 34} still open. Withdrawing is a two-line email — we'll draft it.`}
            </p>
            <StickerButton variant={archived ? "outline" : "primary"} size="md" disabled={archived} onClick={() => setArchived(true)}>
              <Send className="h-4 w-4" />
              {archived ? "Archived" : "Archive & draft withdrawals"}
            </StickerButton>
          </DashCard>

          <DashCard className="p-5">
            <p className="text-[15px] font-bold text-primary mb-1">Pass it on</p>
            <p className="text-xs text-black/45 mb-3">
              You took {longest} days at your best. Someone six weeks behind you could use the head start.
            </p>
            <Link href="/dashboard/invites">
              <StickerButton variant="outline" size="md">
                <Gift className="h-4 w-4" />
                Invite someone · +10 credits
              </StickerButton>
            </Link>
          </DashCard>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5 mt-5 items-start">
          {/* Left: "Your first 90 days" checklist */}
          <DashCard className="p-6">
            <div className="flex items-center justify-between gap-4 mb-1">
              <p className="text-[15px] font-bold text-primary">Your first 90 days</p>
              <Pill variant="positive" className="flex-none">
                {doneCount} of {items.length} done
              </Pill>
            </div>
            <p className="text-xs text-black/45 mb-4">A few things worth getting right before day 30.</p>

            <ProgressBar value={checklistPct} height="h-1.5" className="mb-2" />

            <div className="flex flex-col mt-3">
              {items.map((item) => {
                const hint = CHECKLIST_HINTS[item.id];
                const noteOpen = openNotes.has(item.id);

                return (
                  <div key={item.id} className="flex items-start gap-3 py-3 border-b border-black/6 last:border-0">
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      aria-pressed={item.done}
                      className="group flex-none mt-0.5 cursor-pointer">
                      <NeoCheckbox checked={item.done} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <p className={cn("text-sm", item.done ? "text-black/40 line-through" : "text-primary font-medium")}>
                          {item.text}
                        </p>
                        {!item.done && hint?.variant === "pending" && (
                          <Pill variant="outline-dashed" className="flex-none">
                            {hint.label}
                          </Pill>
                        )}
                      </div>

                      {!item.done && hint?.variant === "open" && (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={() => toggleNote(item.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer">
                            {hint.label}
                            <ChevronDown className={cn("h-3 w-3 transition-transform", noteOpen && "rotate-180")} />
                          </button>
                          <div
                            className={cn(
                              "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
                              noteOpen ? "max-h-[160px] opacity-100 mt-2" : "max-h-0 opacity-0"
                            )}>
                            <p className="text-xs text-black/55 leading-relaxed bg-[#f6f6f6] rounded-lg p-3">{hint.note}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </DashCard>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            {/* Getting paid across borders */}
            <DashCard className="p-6">
              <p className="text-[15px] font-bold text-primary mb-1">Getting paid across borders</p>
              <p className="text-xs text-black/45 mb-3">Three things most new remote hires figure out the hard way.</p>

              <div className="flex flex-col divide-y divide-black/6">
                {PAYMENT_TOPICS.map((topic) => {
                  const open = openTopics.has(topic.id);
                  const Icon = topic.icon;

                  return (
                    <div key={topic.id}>
                      <button
                        type="button"
                        onClick={() => toggleTopic(topic.id)}
                        className="w-full flex items-center gap-3 py-2.5 text-left cursor-pointer group">
                        <span className="h-8 w-8 flex-none rounded-lg bg-[#f0f0ea] text-primary flex items-center justify-center transition-colors group-hover:bg-secondary/40">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 text-sm font-semibold text-primary">{topic.title}</span>
                        <ChevronDown className={cn("h-4 w-4 text-black/35 transition-transform flex-none", open && "rotate-180")} />
                      </button>
                      <div
                        className={cn(
                          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
                          open ? "max-h-[200px] opacity-100 pb-3.5" : "max-h-0 opacity-0"
                        )}>
                        <p className="text-xs text-black/55 leading-relaxed pl-11 pr-1">{topic.blurb}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DashCard>

            {/* Dark "Help the next person" card */}
            <div className="rounded-[18px] bg-primary text-white p-6">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="h-8 w-8 flex-none rounded-full bg-secondary/20 flex items-center justify-center">
                  <Heart className="h-4 w-4 text-secondary" />
                </span>
                <p className="text-[15px] font-bold">Help the next person</p>
              </div>

              {shared ? (
                <div className="mt-1">
                  <p className="text-sm text-white/75 leading-relaxed mb-4">
                    Thanks — that&apos;s exactly the kind of note someone refreshing their tracker at 2am needs to read.
                    It&apos;ll go out anonymously once it&apos;s been reviewed.
                  </p>
                  <StickerButton variant="outline" size="sm" shadowColor="rgba(255,255,255,.3)" onClick={handleWriteAnother}
                    className="bg-transparent border-white/25 text-white hover:border-white/60">
                    Write another
                  </StickerButton>
                </div>
              ) : (
                <>
                  <p className="text-sm text-white/70 leading-relaxed mb-4">
                    Someone six weeks behind you is about to give up on their search. Write down one honest thing that
                    helped — it posts anonymously to the community, never with your name attached.
                  </p>
                  <textarea
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                    placeholder="What actually moved the needle for you? A habit, a rewrite, a hard conversation you're glad you had..."
                    className="w-full min-h-[110px] resize-none rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/40 p-3.5 mb-4 focus:outline-none focus:border-white/35 transition-colors"
                  />
                  <div className="flex items-center gap-3">
                    <StickerButton variant="secondary" size="md" shadowColor="#ffffff" onClick={handleShare} disabled={!story.trim()}>
                      <Send className="h-4 w-4" />
                      Share your story
                    </StickerButton>
                    <span className="text-xs text-white/45">Posted anonymously</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandedClient;
