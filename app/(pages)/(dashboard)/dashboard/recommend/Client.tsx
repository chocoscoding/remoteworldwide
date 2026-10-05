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
// Two layouts, by the server's eligibility verdict. Eligible: what's waiting on
// you, the companies you're in front of beside how it works, then the
// listings. Not yet: "Step one" (the checklist) leads, how it works runs under
// it, and the listings say which of their four signals matched.
//
// Being recommended is on Basic and up (owner, 2026-10-01). Below it the list
// is not read, its section says what the plan adds, and the eligibility
// checklist carries the plan as one more thing to do. Worth watching stays.

import { FC, ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, RotateCw, Sparkles } from "lucide-react";
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
import AvailabilityPill from "@/app/components/dashboard/recommend/AvailabilityPill";
import ClosedRecRow from "@/app/components/dashboard/recommend/ClosedRecRow";
import EligibilityCard from "@/app/components/dashboard/recommend/EligibilityCard";
import FitCard, { FIT_TIER_SHORT } from "@/app/components/dashboard/recommend/FitCard";
import FitSignalsNote from "@/app/components/dashboard/recommend/FitSignalsNote";
import { HowItWorksBand } from "@/app/components/dashboard/recommend/HowItWorks";
import PipelineSummaryCard from "@/app/components/dashboard/recommend/PipelineSummaryCard";
import RecommendAside from "@/app/components/dashboard/recommend/RecommendAside";
import WaitingOnYouBanner from "@/app/components/dashboard/recommend/WaitingOnYouBanner";
import { companyKeyOf } from "@/app/lib/contacts/people";
import {
  computeFit,
  fitSignals,
  recentApplications,
  roleTokens,
  watchSearchTerms,
  type FitHistory,
  type FitPrefs,
  type FitProfile,
} from "@/app/lib/dashboard/fit";
import type { IntroPipelineEntry } from "@/app/lib/dashboard/types";
import { holdsPriorityIntro } from "@/app/lib/dashboard/gifts";
import { toPipelineEntry, toWatchTarget } from "@/app/lib/recommendations/view";
import { useApplications } from "@/hooks/queries/useApplicationsQuery";
import { WATCH_SEARCHES, useRecommendationEligibility, useRecommendations, useWarmPaths, useWatchPool } from "@/hooks/queries/useRecommendationsQuery";

/** One company + role, however it was typed — an application and a listing for the same job share it. */
const jobKey = (company: string, role: string) => `${companyKeyOf(company)}|${[...roleTokens(role)].sort().join(" ")}`;

/** Listings shown under "worth watching": the best fits from the pool, two rows of three. */
const WATCH_SHOWN = 6;

/** Soonest to close first; one without a clock goes last. */
const byDeadline = (a: IntroPipelineEntry, b: IntroPipelineEntry) => (a.expiresInDays ?? Infinity) - (b.expiresInDays ?? Infinity);

/** Flat pulse blocks in the summary card's own layout, while the list loads. */
const PipelineSkeleton: FC = () => (
  <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading your recommendations">
    {[0, 1].map((i) => (
      <DashCard key={i} className="border-black/[0.14] p-[18px]">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 flex-none animate-pulse rounded-full bg-black/[0.07]" />
          <div className="min-w-0 flex-1">
            <span className="block h-4 w-36 animate-pulse rounded bg-black/[0.07]" />
            <span className="mt-2 block h-3 w-52 animate-pulse rounded bg-black/[0.06]" />
          </div>
        </div>
        <span className="mt-4 block h-5 w-full animate-pulse rounded bg-black/[0.05]" />
      </DashCard>
    ))}
  </div>
);

const FitSkeleton: FC = () => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4" aria-busy="true" aria-label="Loading listings">
    {[0, 1, 2].map((i) => (
      <DashCard key={i} className="border-black/[0.14] p-[18px]">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 flex-none animate-pulse rounded-full bg-black/[0.07]" />
          <div className="min-w-0 flex-1">
            <span className="block h-4 w-28 animate-pulse rounded bg-black/[0.07]" />
            <span className="mt-2 block h-3 w-40 animate-pulse rounded bg-black/[0.06]" />
          </div>
        </div>
        <span className="mt-4 block h-6 w-48 animate-pulse rounded-full bg-black/[0.06]" />
        <span className="mt-4 block h-9 w-full animate-pulse rounded-lg bg-black/[0.05]" />
      </DashCard>
    ))}
  </div>
);

/** Where "Step one" or the companies go, until the server says which. */
const TopSkeleton: FC = () => (
  <div className="h-[244px] animate-pulse rounded-2xl border border-black/[0.08] bg-white" aria-busy="true" aria-label="Loading where you stand" />
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

/** "Companies you're in front of" with nothing live: the heading, the reason and the count, in one dashed row. */
const NoCompaniesRow: FC<{ body: string; side: ReactNode }> = ({ body, side }) => (
  <section
    aria-label="Companies you're in front of"
    className="flex flex-wrap items-center gap-3 rounded-[14px] border border-dashed border-black/35 px-5 py-4">
    <div className="flex min-w-0 flex-[1_1_320px] flex-col">
      <h2 className="text-[15px] font-extrabold text-primary">Companies you&apos;re in front of</h2>
      <span className="text-[13px] text-[#5f6062]">{body}</span>
    </div>
    <div className="flex-none">{side}</div>
  </section>
);

const RecommendClient: FC = () => {
  const { goals, pausedDaysLeft, resumeSearch, gifts } = useActivity();
  const { preferences, profile } = useSettings();
  const lock = usePlanLock(BASIC_GATES.recommendations);
  // A redeemed priority intro (a streak gift) opens recommendations on any plan, as the backend does.
  const locked = lock.locked && !holdsPriorityIntro(gifts);
  const recommendations = useRecommendations({ enabled: !locked });
  // The application trend: what you've logged in the tracker lately.
  const applications = useApplications();
  const history: FitHistory = useMemo(() => ({ applied: recentApplications(applications.data ?? []) }), [applications.data]);
  const searchTerms = useMemo(() => watchSearchTerms(preferences, history, WATCH_SEARCHES), [preferences, history]);
  const pool = useWatchPool(searchTerms);
  // The server's verdict, not one worked out here from `profile`: that object
  // carries unsaved edits, and a reviewer only ever sees what was saved. A
  // failed read falls back to the eligible layout, which asks nothing of you.
  const eligibility = useRecommendationEligibility();
  const ineligible = eligibility.data && !eligibility.data.eligible ? eligibility.data : null;
  const masterResume = eligibility.data?.masterResume ?? null;

  const [pauseOpen, setPauseOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const paused = goals.paused;

  // Mapped once per fetch: the day counts are read off the clock here, not on every render.
  const pipeline = useMemo(() => (locked ? [] : (recommendations.data ?? []).map((item) => toPipelineEntry(item))), [locked, recommendations.data]);

  // Live cards, recently closed rows, and the >7-day history behind a
  // disclosure — a pass never renders as a card and never says "rejected".
  const activePipeline = pipeline.filter((e) => !e.outcome);
  const closedPipeline = pipeline.filter((e) => e.outcome);
  const recentClosed = closedPipeline.filter((e) => (e.outcomeAgoDays ?? 0) <= 7);
  const historyClosed = closedPipeline.filter((e) => (e.outcomeAgoDays ?? 0) > 7);

  const waitingOnYou = activePipeline.filter((e) => e.questions?.some((q) => !q.answer)).sort(byDeadline)[0];

  const prefs: FitPrefs = useMemo(
    () => ({ targetRoles: preferences.targetRoles, experienceLevel: preferences.experienceLevel, remotePolicy: preferences.remotePolicy }),
    [preferences.targetRoles, preferences.experienceLevel, preferences.remotePolicy],
  );
  const fitProfile: FitProfile = useMemo(() => ({ timezone: profile.timezone }), [profile.timezone]);
  const signals = useMemo(() => fitSignals(prefs, fitProfile, history), [prefs, fitProfile, history]);
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

  const missingSignal = Object.values(signals).some((has) => !has);
  // Quoted as the cards say it: the compact pill's short word, else the tier's own.
  const tones = new Set(watched.map((w) => w.fit.tier.tone));
  const sharedTier = tones.size === 1 && watched[0] ? (ineligible ? watched[0].fit.tier.label : FIT_TIER_SHORT[watched[0].fit.tier.tone]) : null;
  const watchBasis = signals.role && signals.trend ? "your target roles and recent applications" : signals.role ? "your target roles" : "your recent applications";

  const availability = paused ? "paused" : ineligible ? "ineligible" : "available";

  // The live list, the closed rows and the history, or the one dashed row
  // that stands in for all of it while there's nothing live.
  const companies = (() => {
    const closed = (
      <>
        {recentClosed.map((entry) => (
          <ClosedRecRow key={entry.id} entry={entry} />
        ))}
        {historyClosed.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              aria-expanded={historyOpen}
              className="flex h-8 cursor-pointer items-center gap-1 text-xs font-bold text-[#5f6062] transition-colors hover:text-primary">
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
      </>
    );

    if (locked) {
      return ineligible ? (
        <NoCompaniesRow
          body="Recommendations come with Basic. Anything already made for you is kept."
          side={
            <StickerButton variant="outline" size="sm" onClick={lock.upgrade}>
              Upgrade to Basic
            </StickerButton>
          }
        />
      ) : (
        <section aria-label="Companies you're in front of" className="flex flex-col gap-3">
          <h2 className="text-base font-extrabold text-primary">Companies you&apos;re in front of</h2>
          <PlanLockNote
            gate={BASIC_GATES.recommendations}
            title="Recommendations come with Basic"
            body="On Basic and up, reviewers can put a strong profile like yours in front of a hiring team. Anything already made for you is kept."
          />
        </section>
      );
    }

    if (!recommendations.isPending && !(recommendations.isError && pipeline.length === 0) && activePipeline.length === 0) {
      return (
        <div className="flex flex-col gap-3">
          <NoCompaniesRow
            body={
              ineligible
                ? "None yet. They'll appear here once a reviewer picks you."
                : "None yet. Reviewers pick every week, so keep your resume and preferences current."
            }
            side={<Pill className="font-bold">0 active</Pill>}
          />
          {closed}
        </div>
      );
    }

    return (
      <section aria-label="Companies you're in front of" className="flex min-w-0 flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-extrabold text-primary">Companies you&apos;re in front of</h2>
          {activePipeline.length > 0 && <span className="text-xs font-bold text-[#5f6062]">{activePipeline.length} active</span>}
        </div>
        {recommendations.isPending ? (
          <PipelineSkeleton />
        ) : recommendations.isError && pipeline.length === 0 ? (
          <RetryCard title="We couldn't load your recommendations." onRetry={() => void recommendations.refetch()} />
        ) : (
          activePipeline.map((entry) => <PipelineSummaryCard key={entry.id} entry={entry} />)
        )}
        {closed}
      </section>
    );
  })();

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center gap-3 border-b border-black/10 bg-white/90 px-8 py-2 backdrop-blur-sm">
        <h1 className="whitespace-nowrap text-[17px] font-extrabold text-primary">Recommendations</h1>
        <Pill variant="neutral" className="hidden sm:inline-flex">
          Picked by our reviewers
        </Pill>
        {locked && <PlanChip plan="basic" className="flex-none" />}
        <div className="flex-1" />
        {/* Drawn once the server has said where you stand, so it never flips from "available" to "not yet". */}
        {(paused || !eligibility.isPending) && (
          <AvailabilityPill state={availability} pausedDaysLeft={pausedDaysLeft} onPause={() => setPauseOpen(true)} onResume={resumeSearch} />
        )}
        <NotificationBell />
      </header>

      <main className="mx-auto flex max-w-[1160px] flex-col gap-7 px-8 pb-14 pt-7">
        {waitingOnYou && <WaitingOnYouBanner entry={waitingOnYou} />}

        {eligibility.isPending ? (
          <TopSkeleton />
        ) : ineligible ? (
          <>
            {/* Step one leads: it is the only part of this screen that's yours to do. */}
            <EligibilityCard eligibility={ineligible} />
            <HowItWorksBand />
            {companies}
          </>
        ) : (
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex min-w-0 flex-[999_1_560px] flex-col">{companies}</div>
            <RecommendAside masterResume={masterResume} />
          </div>
        )}

        <section aria-label="Jobs worth watching" className="flex flex-col gap-3.5">
          <div className={cn("flex flex-wrap items-baseline justify-between gap-2", !ineligible && "border-t border-black/[0.14] pt-5")}>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-base font-extrabold text-primary">Jobs worth watching</h2>
              <span className="text-[13px] text-[#5f6062]">
                Live listings like {watchBasis}. Apply to these yourself{ineligible ? " while you wait" : ""}.
              </span>
            </div>
            <Link href="/jobs" className="text-[13px] font-bold text-primary underline decoration-2 underline-offset-[3px] hover:text-[#6c7a1e]">
              Browse all jobs
            </Link>
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
              body="Nothing posted in the last three weeks matches your target roles or recent applications yet. New ones arrive daily."
              ctaLabel="Browse all jobs"
              ctaHref="/jobs"
            />
          ) : (
            <>
              {missingSignal && <FitSignalsNote signals={signals} sharedTier={sharedTier} />}
              <div
                className={cn(
                  "grid gap-4",
                  ineligible ? "grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))]" : "grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))]",
                )}>
                {watched.map(({ target, fit }) => (
                  <FitCard
                    key={target.id}
                    target={target}
                    fit={fit}
                    contact={warmPathAt(target.company)}
                    variant={ineligible ? "detailed" : "compact"}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <PauseSearchDialog open={pauseOpen} onOpenChange={setPauseOpen} />
    </div>
  );
};

export default RecommendClient;
