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
// watching" is live Remote Worldwide listings found and scored in the browser
// from your target roles and the roles you've been applying to
// (lib/dashboard/fit.ts) — computed, never stored, so change a preference or
// log an application and every card on this screen re-ranks.
//
// Being recommended is on Basic and up (owner, 2026-10-01). Below it the list
// is not read, its section says what the plan adds, and the eligibility
// checklist carries the plan as one more thing to do. Worth watching stays.

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
import { PlanChip } from "@/app/components/dashboard/billing/UpgradeModal";
import { PlanLockNote, usePlanLock } from "@/app/components/dashboard/billing/PlanLock";
import { BASIC_GATES } from "@/app/lib/settings/planGates";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useSettings } from "../settings/SettingsProvider";
import ClosedRecRow from "@/app/components/dashboard/recommend/ClosedRecRow";
import EligibilityCard, { firstFixHref } from "@/app/components/dashboard/recommend/EligibilityCard";
import FitCard from "@/app/components/dashboard/recommend/FitCard";
import PipelineSummaryCard from "@/app/components/dashboard/recommend/PipelineSummaryCard";
import { companyKeyOf } from "@/app/lib/contacts/people";
import { computeFit, recentApplications, roleTokens, watchSearchTerms, type FitHistory, type FitPrefs, type FitProfile } from "@/app/lib/dashboard/fit";
import { toPipelineEntry, toWatchTarget } from "@/app/lib/recommendations/view";
import { useApplications } from "@/hooks/queries/useApplicationsQuery";
import { WATCH_SEARCHES, useRecommendationEligibility, useRecommendations, useWarmPaths, useWatchPool } from "@/hooks/queries/useRecommendationsQuery";

const WHAT_WE_LOOK_FOR = [
  "A portfolio that shows decisions, not just screens.",
  "Proof you've shipped work with engineers.",
  "Clear writing. Most of these teams work async.",
  "A resume that holds up in a 20-second skim.",
  "A match with your preferences and recent applications.",
];

/** One company + role, however it was typed — an application and a listing for the same job share it. */
const jobKey = (company: string, role: string) => `${companyKeyOf(company)}|${[...roleTokens(role)].sort().join(" ")}`;

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
  const lock = usePlanLock(BASIC_GATES.recommendations);
  const recommendations = useRecommendations({ enabled: !lock.locked });
  // The application trend: what you've logged in the tracker lately.
  const applications = useApplications();
  const history: FitHistory = useMemo(() => ({ applied: recentApplications(applications.data ?? []) }), [applications.data]);
  const searchTerms = useMemo(() => watchSearchTerms(preferences, history, WATCH_SEARCHES), [preferences, history]);
  const pool = useWatchPool(searchTerms);
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
    () => ({ targetRoles: preferences.targetRoles, experienceLevel: preferences.experienceLevel, remotePolicy: preferences.remotePolicy }),
    [preferences.targetRoles, preferences.experienceLevel, preferences.remotePolicy],
  );
  const fitProfile: FitProfile = useMemo(() => ({ timezone: profile.timezone }), [profile.timezone]);
  // Neither target roles nor applications: nothing to say what's worth watching.
  const nothingToGoOn = searchTerms.length === 0 && !applications.isPending;

  // The best fits in the pool that relate to your roles or applications, minus
  // any listing you're already in front of or have applied to. Scored here, not
  // stored: the ranking moves the moment a preference does.
  const watched = useMemo(() => {
    const inPipeline = new Set(pipeline.map((e) => e.platformJobId).filter(Boolean));
    const applied = new Set((applications.data ?? []).flatMap((a) => (a.listing ? [a.listing.platformJobId] : [])));
    const appliedJobs = new Set((applications.data ?? []).map((a) => jobKey(a.company, a.role)));
    // The same job listed twice shows once — the fresher listing, since the sort puts it first.
    const shown = new Set<string>();
    return pool.jobs
      .filter((job) => !inPipeline.has(job.id) && !applied.has(job.id) && !appliedJobs.has(jobKey(job.company, job.role)))
      .map((job) => toWatchTarget(job))
      .map((target) => ({ target, fit: computeFit(target, prefs, fitProfile, history) }))
      .filter(({ fit }) => fit.relevant)
      .sort((a, b) => b.fit.score - a.fit.score || (b.target.postedAt ?? 0) - (a.target.postedAt ?? 0))
      .filter(({ target }) => {
        const key = jobKey(target.company, target.role);
        if (shown.has(key)) return false;
        shown.add(key);
        return true;
      })
      .slice(0, WATCH_SHOWN);
  }, [pool.jobs, pipeline, applications.data, prefs, fitProfile, history]);

  const warmPathAt = useWarmPaths(watched.map((w) => w.target.company));
  const watching = watched.length;

  const STATS: { value: number; label: string; note: string }[] = [
    { value: awaitingYou, label: "Waiting on you", note: awaitingYou > 0 ? "questions to answer" : "nothing to answer" },
    { value: watching, label: "Worth watching", note: "live listings that fit you" },
  ];

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Recommendations</h1>
          <Pill variant="neutral" className="hidden sm:inline-flex">
            Picked by our reviewers
          </Pill>
          {lock.locked && <PlanChip plan="basic" className="flex-none" />}
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
            Each week we put one or two people straight in front of a company. No application, no queue.
          </p>
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-white/60">
            A reviewer reads your work and decides. If the company wants to go further, it sends a question or two. Answer them here and
            you&apos;re talking to its hiring team. You can&apos;t request a pick. A sharp profile is what gets you one.
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
              <p className="text-sm font-bold text-primary">{paused ? "You're unavailable" : "You're available"}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-black/55">
                {paused
                  ? `Reviewers can't see you.${pausedDaysLeft !== null ? ` ${pausedDaysLeft}d left on the pause.` : ""}`
                  : ineligible
                    ? "Finish the checklist above so reviewers can pick you."
                    : "Reviewers can pick you while you're available."}
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

          {lock.locked ? (
            <PlanLockNote
              gate={BASIC_GATES.recommendations}
              title="Recommendations come with Basic"
              body="On Basic and up, reviewers can put a strong profile like yours in front of a hiring team. Anything already made for you is kept."
            />
          ) : recommendations.isPending ? (
            <PipelineSkeleton />
          ) : recommendations.isError && pipeline.length === 0 ? (
            <RetryCard title="We couldn't load your recommendations." onRetry={() => void recommendations.refetch()} />
          ) : activePipeline.length === 0 ? (
            ineligible ? (
              <DashEmptyState
                icon={Sparkles}
                title="Nothing yet"
                body="Finish the checklist above to be considered."
                ctaLabel="Finish your profile"
                ctaHref={firstFixHref(ineligible)}
              />
            ) : (
              <DashEmptyState
                icon={Sparkles}
                title="Nothing yet"
                body="Reviewers pick every week. Keep your resume and preferences current."
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
            <p className="mt-1 text-xs text-black/55">Live listings like your target roles and recent applications.</p>
          </div>

          {/* The applications are waited for: the trend decides what is searched and how it ranks, so cards would reshuffle when they landed. */}
          {pool.loading || applications.isPending ? (
            <FitSkeleton />
          ) : nothingToGoOn ? (
            <DashEmptyState
              icon={Sparkles}
              title="Tell us what you're after"
              body="Add a target role or log an application to see matching listings here."
              ctaLabel="Set your target roles"
              ctaHref="/dashboard/settings/preferences"
            />
          ) : pool.failed ? (
            <RetryCard title="We couldn't load listings to score." onRetry={pool.retry} />
          ) : watched.length === 0 ? (
            <DashEmptyState
              icon={Sparkles}
              title="Nothing close right now"
              body="No live listings match your target roles or recent applications yet. New ones arrive daily."
              ctaLabel="Browse all jobs"
              ctaHref="/jobs"
            />
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
              {watched.map(({ target, fit }) => (
                <FitCard key={target.id} target={target} fit={fit} contact={warmPathAt(target.company)} />
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
