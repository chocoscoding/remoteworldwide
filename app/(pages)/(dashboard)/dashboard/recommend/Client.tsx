"use client";

// Recommendations — reviewer-picked, answer-and-connect.
//
// Our reviewers pick one or two people and put them straight in front of a
// company, skipping the funnel. The company asks a question or two, you
// answer, you talk. That is the whole model, and it's why there is no
// messaging UI here and no "ask for an intro" button: you don't choose to be
// recommended, and answering the questions IS the conversation.
//
// Fit scores are computed from your preferences (lib/dashboard/fit.ts), not
// stored — change a preference and every number on this screen moves.

import { FC, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import Pill from "@/app/components/dashboard/ui/Pill";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import PauseSearchDialog from "@/app/components/dashboard/PauseSearchDialog";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useNetwork } from "@/app/components/dashboard/network/NetworkProvider";
import { useSettings } from "../settings/SettingsProvider";
import FitCard from "./_components/FitCard";
import PipelineCard from "./_components/PipelineCard";

const WHAT_WE_LOOK_FOR = [
  "A portfolio that shows decisions, not just screens.",
  "Evidence you've shipped with engineers, not thrown work over a wall.",
  "Written communication — most of these teams are async by default.",
  "A resume that survives a 20-second skim.",
  "Fit against what you told us you want, scored live from your preferences.",
];

const RecommendClient: FC = () => {
  const { pipeline, targets } = useNetwork();
  const { goals, pausedDaysLeft, resumeSearch } = useActivity();
  const { preferences, profile } = useSettings();

  const [lookForOpen, setLookForOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);

  const paused = goals.paused;
  const awaitingYou = pipeline.filter((e) => e.questions?.some((q) => !q.answer)).length;
  const pipelineTargetIds = new Set(pipeline.map((e) => e.targetId));
  const watching = targets.filter((t) => !t.onHold && !pipelineTargetIds.has(t.id)).length;

  const prefs = {
    targetRoles: preferences.targetRoles,
    minSalary: preferences.minSalary,
    remotePolicy: preferences.remotePolicy,
  };
  const fitProfile = { skills: profile.skills, timezone: profile.timezone };

  const STATS: { value: number; label: string; note: string }[] = [
    { value: pipeline.length, label: "Put forward", note: "companies our reviewers chose you for" },
    { value: awaitingYou, label: "Waiting on you", note: awaitingYou === 1 ? "answer their questions" : "nothing to answer" },
    { value: watching, label: "Being watched", note: "on your list for the next round" },
  ];

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Recommendations</h1>
          <Pill variant="neutral" className="hidden sm:inline-flex">
            Picked by humans at Remote Worldwide
          </Pill>
        </div>
        <button
          type="button"
          onClick={() => setLookForOpen((v) => !v)}
          className="inline-flex flex-none cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline">
          What we look for
          {lookForOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            lookForOpen ? "mb-6 max-h-[420px] opacity-100" : "max-h-0 opacity-0"
          )}>
          <DashCard className="bg-[#fbfbf7] p-6">
            <p className="mb-3 text-sm font-bold text-primary">What our reviewers look for</p>
            <ul className="flex flex-col gap-2">
              {WHAT_WE_LOOK_FOR.map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-4 w-4 flex-none place-content-center rounded bg-[#e1f073]">
                    <Check className="h-2.5 w-2.5 text-[#222325]" strokeWidth={3.5} />
                  </span>
                  <span className="text-sm leading-relaxed text-black/60">{line}</span>
                </li>
              ))}
            </ul>
          </DashCard>
        </div>

        {/* How it actually works — no self-serve step to imply. */}
        <div className="mb-6 overflow-hidden rounded-2xl bg-[#222325] p-7">
          <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.09em] text-[#e1f073]">
            <Sparkles className="h-3.5 w-3.5" />
            How recommendations work
          </div>
          <p className="mt-3 max-w-2xl text-[22px] font-bold leading-snug text-white">
            We pick one or two people a week and put them straight in front of a company — no application, no queue.
          </p>
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-white/60">
            A reviewer here reads your work and decides. If a company wants to go further, they send a question or two; you
            answer them below, and you&apos;re talking to their hiring team directly. You can&apos;t request this — keeping your
            profile sharp is what puts you in the running.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/[0.06] px-4 py-3.5">
                <p className="text-2xl font-bold text-[#e1f073] tabular-nums">{s.value}</p>
                <p className="mt-0.5 text-xs font-bold text-white">{s.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{s.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Eligibility — reads the real paused state, not a local flag. */}
        <DashCard className="mb-8 flex flex-wrap items-center justify-between gap-4 bg-[#fbfbf7] p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#e1f073]">
              <BadgeCheck className="h-4 w-4 text-[#222325]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">
                {paused ? "Recommendations are paused" : "You're in the running"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-black/55">
                {paused
                  ? `Paused${pausedDaysLeft !== null ? ` — ${pausedDaysLeft} day${pausedDaysLeft === 1 ? "" : "s"} left` : ""}. Reviewers will skip you until you resume.`
                  : `Reviewers are matching you against ${watching} ${watching === 1 ? "company" : "companies"} this week.`}
              </p>
            </div>
          </div>
          {/* No ink here — the page's one primary is "Send answers" on the
              awaiting card. Resume gets the lime active tier instead. */}
          <div className="flex flex-none items-center gap-2.5">
            <Link
              href="/dashboard/settings/preferences"
              className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-black/55 transition-colors hover:bg-black/[0.05] hover:text-primary">
              Update preferences
            </Link>
            {paused ? (
              <StickerButton variant="secondary" size="sm" onClick={resumeSearch}>
                Resume
              </StickerButton>
            ) : (
              <StickerButton variant="outline" size="sm" onClick={() => setPauseOpen(true)}>
                Pause
              </StickerButton>
            )}
          </div>
        </DashCard>

        <section className="mb-8">
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-bold text-primary">Companies you&apos;re in front of</h2>
            {awaitingYou > 0 && (
              <span className="text-xs font-semibold text-[#6c7a1e]">
                {awaitingYou} waiting on your answer{awaitingYou === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {pipeline.length === 0 ? (
            <DashEmptyState
              icon={Sparkles}
              title="Nobody's put you forward yet"
              body="Reviewers pick weekly. A sharp resume and clear preferences are what get you looked at."
              ctaLabel="Update your preferences"
              ctaHref="/dashboard/settings/preferences"
            />
          ) : (
            <div className="flex flex-col gap-4">
              {pipeline.map((entry) => (
                <PipelineCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3.5">
            {/* Quiet tier on purpose: this list is context for the reviewers'
                next pick, not a peer of the pipeline above it. */}
            <h2 className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55">Companies we think you fit</h2>
            <p className="mt-1 text-xs text-black/55">
              Scored live against your preferences — reviewers use this as one input when they pick.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {targets.map((t) => (
              <FitCard key={t.id} target={t} prefs={prefs} profile={fitProfile} />
            ))}
          </div>
        </section>
      </main>

      <PauseSearchDialog open={pauseOpen} onOpenChange={setPauseOpen} />
    </div>
  );
};

export default RecommendClient;
