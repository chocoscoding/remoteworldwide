"use client";

import { FC, useRef, useState } from "react";
import { Plus, Sparkles, Linkedin, Check, Scissors, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import { REFERRAL_CONTACTS } from "@/app/lib/dashboard/mock-data";
import type { ReferralContact } from "@/app/lib/dashboard/types";

// ---------------------------------------------------------------------------
// Local content that isn't shared with any other screen — kept here rather
// than in mock-data.ts.
// ---------------------------------------------------------------------------

interface FilterOption {
  id: string;
  label: string;
}

const FILTERS: FilterOption[] = [
  { id: "strongest", label: "Strongest first" },
  { id: "applied", label: "Roles I applied to" },
  { id: "alumni", label: "Alumni" },
  { id: "timezone", label: "Same timezone" },
];

/** Long + short outreach drafts, keyed by ReferralContact.id. */
const DRAFT_MESSAGES: Record<string, { long: string; short: string }> = {
  "ref-tunde": {
    long:
      "Hey Tunde — hope things are good on the platform team! I saw Vercel has a Senior Product Designer role open and I'd love to throw my hat in. We overlapped for two years at Andela, so you've seen my work firsthand — would you be up for referring me, or pointing me to whoever's hiring? Happy to send over my resume and a two-line blurb you can forward, no pressure either way.",
    short:
      "Hey Tunde — saw the Senior Product Designer opening at Vercel and would love a referral if you're up for it. Happy to send my resume plus a short blurb you can forward. No pressure!",
  },
  "ref-maria": {
    long:
      "Hi Maria — Chidi Nwosu suggested I reach out. I'm a product designer (6 years, most recently at Paystack) and I'm really drawn to how Linear treats craft and interaction detail. I noticed you're hiring a Senior Product Designer — would you be open to a short chat, or could Chidi make a quick introduction? Happy to share my portfolio either way.",
    short:
      "Hi Maria — Chidi Nwosu suggested I reach out about the Senior Product Designer role at Linear. Would you be open to a quick intro via Chidi, or a short chat?",
  },
  "ref-sam": {
    long:
      "Hi Sam — fellow Andela alum here! I'm applying to the Senior Designer role at Deel and figured I'd say hello first. I've spent the last few years designing payment and compliance flows at Paystack, which feels close to what Deel builds for global payroll. Would you be open to flagging my application, or sharing what the team's really looking for?",
    short:
      "Hi Sam — fellow Andela alum applying to the Senior Designer role at Deel. Would you be open to flagging my application or sharing what the team's looking for?",
  },
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function tieVariant(tie: string): "positive" | "neutral" {
  return tie === "Strong tie" ? "positive" : "neutral";
}

const ReferralsClient: FC = () => {
  const [filter, setFilter] = useState<string>("strongest");
  const [allDrafted, setAllDrafted] = useState(false);
  const [askedIds, setAskedIds] = useState<Set<string>>(new Set());

  const [draftContactId, setDraftContactId] = useState<string>("ref-tunde");
  const [shortened, setShortened] = useState(false);
  const [copied, setCopied] = useState(false);
  const draftCardRef = useRef<HTMLDivElement>(null);

  const activeContact: ReferralContact =
    REFERRAL_CONTACTS.find((c) => c.id === draftContactId) ?? REFERRAL_CONTACTS[0];
  const activeDraft = DRAFT_MESSAGES[activeContact.id] ?? DRAFT_MESSAGES["ref-tunde"];
  const draftText = shortened ? activeDraft.short : activeDraft.long;

  const openDraftFor = (id: string) => {
    setDraftContactId(id);
    setShortened(false);
    setCopied(false);
    draftCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const markAsked = (id: string) => {
    setAskedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const openLinkedIn = () => {
    if (typeof window !== "undefined") {
      window.open("https://www.linkedin.com/", "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyAndOpen = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(draftText).catch(() => {});
    }
    setCopied(true);
    openLinkedIn();
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Referral search</h1>
        </div>
        <div className="flex items-center gap-3 flex-none">
          <Pill variant="neutral" className="gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            Connected: LinkedIn, Gmail
          </Pill>
          <StickerButton variant="primary" size="md" onClick={() => {}}>
            <Plus className="h-4 w-4" />
            Add a network
          </StickerButton>
        </div>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1100px] mx-auto">
        {/* Dark hero */}
        <div className="relative overflow-hidden rounded-[18px] bg-[#222325] text-white p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div
            aria-hidden
            className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-secondary/25 blur-3xl pointer-events-none"
          />

          <div className="relative max-w-xl">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-secondary mb-3">Referral search</p>
            <h2 className="text-[26px] md:text-[32px] font-bold leading-tight mb-3">
              6 people can put you in front of a hiring manager this week
            </h2>
            <p className="text-sm text-white/60 leading-relaxed">
              We matched your LinkedIn and Gmail contacts against the companies you&apos;re applying to — starting
              with the three warmest paths below.
            </p>
          </div>

          <div className="relative flex-none flex flex-col items-start md:items-end gap-2">
            <StickerButton
              variant="secondary"
              size="lg"
              shadowColor="#ffffff"
              onClick={() => setAllDrafted(true)}>
              <Sparkles className="h-4 w-4" />
              Draft all intros
            </StickerButton>
            {allDrafted && <span className="text-xs font-semibold text-secondary">6 intro drafts queued ✓</span>}
          </div>
        </div>

        {/* Filter pills */}
        <div className="mt-7">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-2.5">Sort contacts</p>
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
                  filter === f.id ? "bg-[#222325] text-white" : "bg-[#f0f0ea] text-black/60 hover:bg-[#e7e7df]"
                )}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
          {REFERRAL_CONTACTS.map((c) => {
            const available = c.status.toLowerCase().includes("available");
            const StatusIcon = available ? CheckCircle2 : Clock;
            const asked = askedIds.has(c.id);

            return (
              <DashCard key={c.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 flex-none rounded-full bg-[#f0f0ea] text-primary font-extrabold text-sm flex items-center justify-center">
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-primary truncate">{c.name}</p>
                      <p className="text-xs text-black/45 truncate">
                        {c.role} · {c.company}
                      </p>
                    </div>
                  </div>
                  <Pill variant={tieVariant(c.tie)} className="flex-none">
                    {c.tie}
                  </Pill>
                </div>

                {c.bio && <p className="text-xs text-black/55 leading-relaxed mb-4">{c.bio}</p>}

                <div className="flex flex-col gap-2.5 mb-5">
                  <div>
                    <p className="text-[11px] text-black/40 mb-0.5">Target role</p>
                    <p className="text-sm font-semibold text-primary">{c.targetRole}</p>
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium",
                      available ? "text-[#6c7a1e]" : "text-black/50"
                    )}>
                    <StatusIcon className="h-3.5 w-3.5 flex-none" />
                    {c.status}
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2 pt-1">
                  <StickerButton
                    variant="primary"
                    size="sm"
                    onClick={() => openDraftFor(c.id)}
                    className="flex-1">
                    Draft intro
                  </StickerButton>
                  {c.via ? (
                    <StickerButton
                      variant="outline"
                      size="sm"
                      onClick={() => markAsked(c.id)}
                      disabled={asked}
                      className="flex-1">
                      {asked ? "Asked ✓" : `Ask ${c.via.split(" ")[0]}`}
                    </StickerButton>
                  ) : (
                    <StickerButton variant="outline" size="sm" onClick={openLinkedIn} className="flex-1">
                      View LinkedIn
                    </StickerButton>
                  )}
                </div>
              </DashCard>
            );
          })}
        </div>

        {/* Draft preview card */}
        <div ref={draftCardRef}>
          <DashCard className="p-6 mt-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 flex-none rounded-full bg-[#222325] text-[#e1f073] font-extrabold text-xs flex items-center justify-center">
                  {initials(activeContact.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-primary">Draft for {activeContact.name.split(" ")[0]}</p>
                  <p className="text-xs text-black/45 truncate">
                    {activeContact.role} at {activeContact.company} · {activeContact.tie}
                  </p>
                </div>
              </div>
              {shortened && <Pill variant="neutral">Shortened</Pill>}
            </div>

            <div className="rounded-xl bg-[#fbfbf7] border border-black/8 p-4 mb-5">
              <p className="text-sm text-black/75 leading-relaxed whitespace-pre-line">{draftText}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <StickerButton variant="primary" size="md" onClick={handleCopyAndOpen}>
                {copied ? <Check className="h-4 w-4" /> : <Linkedin className="h-4 w-4" />}
                {copied ? "Copied ✓" : "Copy & open LinkedIn"}
              </StickerButton>
              <StickerButton variant="outline" size="md" onClick={() => setShortened((v) => !v)}>
                <Scissors className="h-4 w-4" />
                {shortened ? "Use full version" : "Make it shorter"}
              </StickerButton>
              <span className="text-xs text-black/40 ml-auto">
                Referrals typically hear back about 4× as often as cold applications.
              </span>
            </div>
          </DashCard>
        </div>
      </main>
    </div>
  );
};

export default ReferralsClient;
