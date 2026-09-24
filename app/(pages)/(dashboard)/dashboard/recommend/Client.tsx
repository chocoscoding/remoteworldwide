"use client";

// Recommendations — reviewer-picked, answer-and-connect.
//
// Our reviewers pick one or two people and put them straight in front of a
// company, skipping the funnel. The company asks a question or two, you
// answer, you talk. That is the whole model, and it's why there is no
// messaging UI here and no "ask for an intro" button: you don't choose to be
// recommended, and answering the questions IS the conversation.
//
// Both halves are real now. "Companies you're in front of" is the backend's
// recommendations, written by reviewers from the admin screens. "Worth
// watching" is live Remote Worldwide listings, scored in the browser against
// your preferences (lib/dashboard/fit.ts) — computed, never stored, so change a
// preference and every card on this screen re-ranks.

import { FC, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, ChevronDown, ChevronUp, RotateCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import Pill from "@/app/components/dashboard/ui/Pill";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import PauseSearchDialog from "@/app/components/dashboard/PauseSearchDialog";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useSettings } from "../settings/SettingsProvider";
import ClosedRecRow from "@/app/components/dashboard/recommend/ClosedRecRow";
import EligibilityCard, { firstFixHref } from "@/app/components/dashboard/recommend/EligibilityCard";
import FitCard from "@/app/components/dashboard/recommend/FitCard";
import PipelineSummaryCard from "@/app/components/dashboard/recommend/PipelineSummaryCard";
import { computeFit, type FitPrefs, type FitProfile } from "@/app/lib/dashboard/fit";
import { toPipelineEntry, toWatchTarget } from "@/app/lib/recommendations/view";
import { useRecommendationEligibility, useRecommendations, useWarmPaths, useWatchPool } from "@/hooks/queries/useRecommendationsQuery";

const WHAT_WE_LOOK_FOR = [
  "A portfolio that shows decisions, not just screens.",
  "Evidence you've shipped with engineers, not thrown work over a wall.",
  "Written communication — most of these teams are async by default.",
  "A resume that survives a 20-second skim.",
  "Fit against what you told us you want, scored live from your preferences.",
];

/** Listings shown under "worth watching": the best fits from the pool, two rows of three. */
const WATCH_SHOWN = 6;

/** Flat pulse blocks in the summary card's own layout, while the list loads. */
const PipelineSkeleton: FC = () => (
  <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading your recommendations">
    {[0, 1].map((i) => (
      <DashCard key={i} className="p-5">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 flex-none animate-pulse rounded-full bg-black/[0.07]" />
          <div className="min-w-0 flex-1">
            <span className="block h-4 w-36 animate-pulse rounded bg-black/[0.07]" />
            <span className="mt-2 block h-3 w-52 animate-pulse rounded bg-black/[0.06]" />
          </div>
        </div>
        <span className="mt-4 block h-1.5 w-full animate-pulse rounded bg-black/[0.06]" />
      </DashCard>
    ))}
  </div>
);

const FitSkeleton: FC = () => (
  <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading listings">
    {[0, 1, 2].map((i) => (
      <DashCard key={i} className="p-5">
        <span className="block h-4 w-28 animate-pulse rounded bg-black/[0.07]" />
        <span className="mt-2 block h-3 w-40 animate-pulse rounded bg-black/[0.06]" />
        <span className="mt-5 block h-6 w-24 animate-pulse rounded-full bg-black/[0.06]" />
        <span className="mt-4 block h-[52px] w-full animate-pulse rounded-xl bg-black/[0.05]" />
      </DashCard>
    ))}
  </div>
);

/** A read that failed, with the one thing to do about it. */
const RetryCard: FC<{ title: string; onRetry: () => void }> = ({ title, onRetry }) => (
  <DashCard className="flex flex-wrap items-center justify-between gap-3 p-5">
    <p className="text-sm font-semibold text-primary">{title}</p>
    <StickerButton variant="outline" size="sm" onClick={onRetry}>
      <RotateCw className="h-3.5 w-3.5" />
      Try again
    </StickerButton>
  </DashCard>
);

const RecommendClient: FC = () => {
  const { goals, pausedDaysLeft, resumeSearch } = useActivity();
  const { preferences, profile } = useSettings();
  const recommendations = useRecommendations();
  const pool = useWatchPool(preferences.targetRoles);
  // The server's verdict, not one worked out here from `profile`: that object
  // carries unsaved edits, and a reviewer only ever sees what was saved.
  const eligibility = useRecommendationEligibility();
  const ineligible = eligibility.data && !eligibility.data.eligible ? eligibility.data : null;
  const masterResume = eligibility.data?.masterResume ?? null;

  const [lookForOpen, setLookForOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);

  const paused = goals.paused;
  const [historyOpen, setHistoryOpen] = useState(false);

  // Mapped once per fetch: the day counts are read off the clock here, not on every render.
  const pipeline = useMemo(() => (recommendations.data ?? []).map((item) => toPipelineEntry(item)), [recommendations.data]);

  // Live cards, recently closed rows, and the >7-day history behind a
  // disclosure — a pass never renders as a card and never says "rejected".
  const activePipeline = pipeline.filter((e) => !e.outcome);
  const closedPipeline = pipeline.filter((e) => e.outcome);
  const recentClosed = closedPipeline.filter((e) => (e.outcomeAgoDays ?? 0) <= 7);
  const historyClosed = closedPipeline.filter((e) => (e.outcomeAgoDays ?? 0) > 7);

  const awaitingYou = activePipeline.filter((e) => e.questions?.some((q) => !q.answer)).length;

  const prefs: FitPrefs = useMemo(
    () => ({ targetRoles: preferences.targetRoles, minSalary: preferences.minSalary, remotePolicy: preferences.remotePolicy }),
    [preferences.targetRoles, preferences.minSalary, preferences.remotePolicy],
  );
  const fitProfile: FitProfile = useMemo(() => ({ skills: profile.skills, timezone: profile.timezone }), [profile.skills, profile.timezone]);

  // The best fits in the pool, minus any listing you're already in front of.
  // Scored here, not stored: the ranking moves the moment a preference does.
  const targets = useMemo(() => {
    const inPipeline = new Set(pipeline.map((e) => e.platformJobId).filter(Boolean));
    return pool.jobs
      .filter((job) => !inPipeline.has(job.id))
      .map((job) => toWatchTarget(job))
      .map((target) => ({ target, score: computeFit(target, prefs, fitProfile).score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, WATCH_SHOWN)
      .map(({ target }) => target);
  }, [pool.jobs, pipeline, prefs, fitProfile]);

  const warmPathAt = useWarmPaths(targets.map((t) => t.company));
  const watching = targets.length;

  const STATS: { value: number; label: string; note: string }[] = [
    { value: awaitingYou, label: "Waiting on you", note: awaitingYou > 0 ? "answer their questions" : "nothing to answer" },
    { value: watching, label: "Worth watching", note: "live listings scored against your preferences" },
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
        <div className="flex flex-none items-center gap-4">
          <button
            type="button"
            onClick={() => setLookForOpen((v) => !v)}
            className="inline-flex flex-none cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline">
            What we look for
            {lookForOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            lookForOpen ? "mb-6 max-h-[420px] opacity-100" : "max-h-0 opacity-0",
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
            A reviewer here reads your work and decides. If a company wants to go further, they send a question or two; you answer them
            below, and you&apos;re talking to their hiring team directly. You can&apos;t request this — keeping your profile sharp is what
            puts you in the running.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/[0.06] px-4 py-3.5">
                <p className="text-2xl font-bold text-[#e1f073] tabular-nums">{s.value}</p>
                <p className="mt-0.5 text-xs font-bold text-white">{s.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{s.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Eligibility — a complete profile and a master resume, as the server
            judges it. Only shown while something is missing. */}
        {ineligible && <EligibilityCard eligibility={ineligible} />}

        {/* Availability — reads the real paused state, not a local flag. */}
        <DashCard className="mb-8 flex flex-wrap items-center justify-between gap-4 bg-[#fbfbf7] p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#e1f073]">
              <BadgeCheck className="h-4 w-4 text-[#222325]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">{paused ? "You're Unavailable" : "You're Available"}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-black/55">
                {paused
                  ? `You're hidden from reviewers — resume anytime.${pausedDaysLeft !== null ? ` ${pausedDaysLeft}d left on the pause.` : ""}`
                  : ineligible
                    ? "Once your profile is complete, reviewers can put you in front of a company while you're available."
                    : "Reviewers can put you in front of a company while you're available."}
              </p>
              {masterResume && !ineligible && (
                <p className="mt-1 text-xs leading-relaxed text-black/55">
                  They&apos;ll read <span className="font-semibold text-primary">{masterResume.name}</span>, your master resume.{" "}
                  <Link href="/dashboard/vault" className="font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
                    Change
                  </Link>
                </p>
              )}
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

          {recommendations.isPending ? (
            <PipelineSkeleton />
          ) : recommendations.isError && pipeline.length === 0 ? (
            <RetryCard title="We couldn't load your recommendations." onRetry={() => void recommendations.refetch()} />
          ) : activePipeline.length === 0 ? (
            ineligible ? (
              <DashEmptyState
                icon={Sparkles}
                title="Nothing yet"
                body="Reviewers only pick from complete profiles with a master resume. Finish the checklist above to be considered."
                ctaLabel="Finish your profile"
                ctaHref={firstFixHref(ineligible)}
              />
            ) : (
              <DashEmptyState
                icon={Sparkles}
                title="Nothing yet"
                body="Reviewers are looking this week. A sharp resume and clear preferences are what get you looked at."
                ctaLabel="Update your preferences"
                ctaHref="/dashboard/settings/preferences"
              />
            )
          ) : (
            <div className="flex flex-col gap-3">
              {activePipeline.map((entry) => (
                <PipelineSummaryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}

          {recentClosed.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {recentClosed.map((entry) => (
                <ClosedRecRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}

          {historyClosed.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-expanded={historyOpen}
                className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-black/50 transition-colors hover:text-primary">
                History · {historyClosed.length}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", historyOpen && "rotate-180")} />
              </button>
              {historyOpen && (
                <div className="mt-2 flex flex-col gap-2">
                  {historyClosed.map((entry) => (
                    <ClosedRecRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3.5">
            {/* Quiet tier on purpose: this list is context for the reviewers'
                next pick, not a peer of the pipeline above it. */}
            <h2 className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55">Jobs worth watching</h2>
            <p className="mt-1 text-xs text-black/55">
              Live Remote Worldwide listings, scored against your preferences — reviewers use this as one input when they pick.
            </p>
          </div>

          {pool.loading ? (
            <FitSkeleton />
          ) : pool.failed ? (
            <RetryCard title="We couldn't load listings to score." onRetry={pool.retry} />
          ) : targets.length === 0 ? (
            <DashEmptyState
              icon={Sparkles}
              title="No live listings to score yet"
              body="New Remote Worldwide listings land here, ranked by how well they fit what you told us you want."
              ctaLabel="Browse all jobs"
              ctaHref="/jobs"
            />
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
              {targets.map((t) => (
                <FitCard key={t.id} target={t} prefs={prefs} profile={fitProfile} contact={warmPathAt(t.company)} />
              ))}
            </div>
          )}
        </section>
      </main>

      <PauseSearchDialog open={pauseOpen} onOpenChange={setPauseOpen} />
    </div>
  );
};

export default RecommendClient;
