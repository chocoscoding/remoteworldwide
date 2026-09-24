"use client";

// A session's report, read from the AI service by its id (a 24-hex ObjectId),
// polled while it is being saved and analysed, and shown with its recording
// when it has one. Every report is the service's: nothing is scored in the
// browser, so an id that could not be the service's is simply not found.
//
// The header names the session's saved track when it is still there, and falls
// back to what the session froze at create when it is not (deleted, or the
// session predates saved tracks).
//
// A finished report opens on the tab in `?tab=` (an id from PrepReport's
// REPORT_TABS), so a tab can be linked to and survives a refresh.
//
// The report's Positioning and Diction sections are written after it is out,
// so a `ready` session can still have them `pending`; the page keeps reading
// it until both settle (`useSectionsPoll`).

import { FC, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hashKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { format as formatDate } from "date-fns";
import { ArrowLeft, RotateCcw, SearchX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePrep } from "../../../PrepProvider";
import { useBilling } from "@/app/(pages)/(dashboard)/dashboard/settings/BillingProvider";
import PrepReport, { DEFAULT_REPORT_TAB, isDictionFinding, parseReportTab, type ReportTab } from "@/app/components/dashboard/prep/PrepReport";
import type { SectionsPoll } from "@/app/components/dashboard/prep/report/SectionStates";
import PrepPageShell from "@/app/components/dashboard/prep/PrepPageShell";
import PrepEmptyState from "@/app/components/dashboard/prep/PrepEmptyState";
import Chip from "@/app/components/dashboard/prep/Chip";
import { savedSessionChip } from "@/app/components/dashboard/prep/PrepHub";
import { BUTTON_OUTLINE, PANEL } from "@/app/components/dashboard/prep/prep-styles";
import {
  AccuracyRating,
  AnalysisProgress,
  DeleteSessionButton,
  DeliveryFindings,
  DeliveryTimeline,
  LockedReport,
  PlaybackProvider,
  RecordingPlayer,
  SyncedTranscript,
  usePlaybackControls,
} from "@/app/components/dashboard/prep/delivery";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { formatsLabel, type PrepTrack, type SessionFormat } from "@/app/lib/dashboard/prep-data";
import { qk } from "@/app/lib/query/keys";
import { getPlaybackLink, insufficientCreditsOf } from "@/app/lib/voice/api";
import { formatDuration } from "@/app/lib/voice/format";
import { detailToPrepSession, isServerSessionId, sameCompany, trackFromSnapshot } from "@/app/lib/voice/mapSession";
import type { PrepSessionDetail, StepState } from "@/app/lib/voice/types";
import { usePrepSessionMutations } from "@/hooks/mutations/usePrepSessionMutations";
import { PREP_POLL, prepSessionQuery, usePrepSession } from "@/hooks/queries/usePrepSessionQueries";

export interface ReportClientProps {
  trackId: string;
  sessionId: string;
}

const ReportClient: FC<ReportClientProps> = ({ trackId, sessionId }) =>
  isServerSessionId(sessionId) ? <SavedReport trackId={trackId} sessionId={sessionId} /> : <UnknownReport trackId={trackId} />;

export default ReportClient;

const setupHref = (trackId: string, formats?: SessionFormat[]) =>
  `/dashboard/prep/${trackId}/setup${formats?.length ? `?format=${formats.join(",")}` : ""}`;

/** An id the service could never have issued: an old in-memory practice report, or a hand-typed link. */
const UnknownReport: FC<{ trackId: string }> = ({ trackId }) => {
  const router = useRouter();
  const { getTrack } = usePrep();
  const track = getTrack(trackId);
  return (
    <PrepPageShell>
      <PrepEmptyState
        icon={SearchX}
        title="Report not found"
        body="Every report is saved with its session. This link doesn't point to one — run a fresh session to get a new report."
        ctaLabel={track ? "Back to track" : "Back to all interviews"}
        onCta={() => router.push(track ? `/dashboard/prep/${trackId}` : "/dashboard/prep")}
      />
    </PrepPageShell>
  );
};

// ---------------------------------------------------------------------------
// Saved sessions (the AI service)
// ---------------------------------------------------------------------------

const SavedReport: FC<ReportClientProps> = ({ trackId, sessionId }) => {
  const router = useRouter();
  const { getTrack, status: tracksStatus } = usePrep();
  // Once the session is deleted there is nothing left to read; turning the
  // query off first stops a refetch from answering 404 on the way out.
  const [deleted, setDeleted] = useState(false);
  const { data: detail, error, isPending, refetch, isRefetching } = usePrepSession(sessionId, { enabled: !deleted });

  // The saved track, when it is still this session's. A saved track's id is an
  // ObjectId and unique for good, so it alone decides (a renamed track still
  // owns its sessions); an older session's in-memory track id also needs the
  // company it had at create, because those ids repeated across page loads.
  const memoryTrack = getTrack(detail?.prep.trackId || trackId);
  const liveTrack =
    detail && memoryTrack && (isServerSessionId(memoryTrack.id) || sameCompany(memoryTrack.company, detail.prep.trackSnapshot.company)) ? memoryTrack : undefined;
  const backHref = liveTrack ? `/dashboard/prep/${liveTrack.id}` : memoryTrack && !detail ? `/dashboard/prep/${memoryTrack.id}` : "/dashboard/prep";

  // Between the delete answering and the page leaving.
  if (deleted) {
    return (
      <PrepPageShell>
        <PrepEmptyState icon={Trash2} title="Session deleted" body="Its recording, transcript and report are gone. Taking you back…" />
      </PrepPageShell>
    );
  }

  // The tracks too: the report puts its actions on the plan tagged with the
  // session's track, and a report shown before the track arrived would add
  // them untagged — on the plan but missing from the track's checklist.
  if (isPending || tracksStatus === "loading") {
    return (
      <PrepPageShell>
        <div className="max-w-[1000px] mx-auto flex flex-col gap-5" aria-busy="true">
          <p className="sr-only" role="status">
            Loading your report
          </p>
          <div className={cn(PANEL, "h-[104px] animate-pulse")} />
          <div className={cn(PANEL, "h-[220px] animate-pulse")} />
        </div>
      </PrepPageShell>
    );
  }

  if (!detail) {
    const missing = error instanceof BackendError && error.status === 404;
    return (
      <PrepPageShell>
        <PrepEmptyState
          icon={SearchX}
          title={missing ? "Report not found" : "We couldn't load this report"}
          body={
            missing
              ? "This session may have been deleted, or it was saved under another account."
              : `${apiMessage(error)} Your session is saved; try again in a moment.`
          }
          ctaLabel={missing ? (memoryTrack ? "Back to track" : "Back to all interviews") : "Try again"}
          ctaBusy={isRefetching}
          onCta={missing ? () => router.push(backHref) : () => void refetch()}
        />
      </PrepPageShell>
    );
  }

  return (
    <PrepPageShell>
      <SavedReportBody
        detail={detail}
        track={liveTrack ?? trackFromSnapshot(detail)}
        backHref={backHref}
        runAnotherHref={liveTrack ? setupHref(liveTrack.id, detail.prep.formats) : "/dashboard/prep"}
        onDeleted={() => setDeleted(true)}
      />
    </PrepPageShell>
  );
};

interface SavedReportBodyProps {
  detail: PrepSessionDetail;
  track: PrepTrack;
  backHref: string;
  runAnotherHref: string;
  /** Called before the page leaves, so nothing reads the deleted session again. */
  onDeleted: () => void;
}

/** A failed step goes back to pending when a retry is accepted, as the service does; finished steps stay finished. */
const resetFailedSteps = (steps: PrepSessionDetail["analysis"]["steps"]): PrepSessionDetail["analysis"]["steps"] => {
  const next = { ...steps };
  for (const key of Object.keys(next) as Array<keyof typeof next>) {
    const step: StepState = next[key];
    if (step.status === "failed") next[key] = { ...step, status: "pending", error: null };
  }
  return next;
};

const SavedReportBody: FC<SavedReportBodyProps> = ({ detail, track, backHref, runAnotherHref, onDeleted }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = detail.id;
  const detailKey = qk.prep.session(id);
  const voice = detail.mode === "voice";
  const playable = voice && detail.recording?.playbackReady === true;
  const noWordTimings = voice && detail.analysis.transcriptCoverage === 0;
  const session = useMemo(() => detailToPrepSession(detail), [detail]);
  const getUrl = useCallback(() => getPlaybackLink(id), [id]);
  const sectionsPoll = useSectionsPoll(id, sectionsPending(detail));

  // The report's tab is read from the address and written back to it.
  // Replaced, not pushed, so Back leaves the report rather than stepping
  // through every tab looked at. Native history, which Next keeps
  // useSearchParams in step with, rather than router.replace, which would
  // fetch the page again for a change only this page reads.
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const tab = parseReportTab(searchParams.get("tab"));
  const showTab = (next: ReportTab) => {
    const params = new URLSearchParams(searchParams.toString());
    // The default tab is the report's plain address.
    if (next === DEFAULT_REPORT_TAB) params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };

  // --- Actions ------------------------------------------------------------
  // The shared session mutations keep the cache and the lists in step with
  // what the service answered; this page adds only what it shows.

  const { rating, unlock, retry, delete: removal } = usePrepSessionMutations();

  const retryAnalysis = () =>
    retry.mutate(id, {
      // Shown as queued at once, so the failed card (and its button) doesn't
      // linger until the refetch the hook started comes back.
      onSuccess: (result) =>
        queryClient.setQueryData<PrepSessionDetail>(detailKey, (current) =>
          current
            ? {
                ...current,
                status: result.status,
                analysis: { ...current.analysis, error: null, retriesLeft: result.retriesLeft, steps: resetFailedSteps(current.analysis.steps) },
              }
            : current
        ),
    });

  const deleteSession = () =>
    removal
      .mutateAsync(id)
      // Already gone is what was asked for.
      .catch((reason: unknown) => {
        if (!(reason instanceof BackendError && reason.status === 404)) throw reason;
      })
      .then(() => {
        onDeleted();
        toast.success("Session deleted");
        router.replace(backHref);
      });

  // The balance a locked report quotes: the sidebar's own copy, so the two
  // never disagree, and the unlock mutation refreshes it. The 402 from an
  // unlock carries a fresher one.
  const { subscription } = useBilling();
  const accountBalance = typeof subscription?.creditBalance === "number" && Number.isFinite(subscription.creditBalance) ? subscription.creditBalance : null;
  const refusal = insufficientCreditsOf(unlock.error);

  // --- Pieces -------------------------------------------------------------

  const player = playable ? <RecordingPlayer getUrl={getUrl} title={`${detail.company || track.company} · ${detail.prep.trackSnapshot.roundLabel || detail.role}`} /> : null;

  // Without the batch transcript (locked reports withhold it; typed sessions
  // never have one) the turns carry the text.
  const transcript = voice ? (
    <SyncedTranscript segments={detail.delivery?.transcript.segments ?? []} words={detail.delivery?.transcript.words ?? []} turns={detail.turns} />
  ) : undefined;

  // It rates the transcript, so the report puts it on the Transcript tab.
  const accuracyRating =
    voice && detail.status === "ready" ? <AccuracyRating value={detail.rating?.score ?? null} onRate={(score) => rating.mutateAsync({ id, score })} /> : null;

  const deleteButton = (
    <div className="flex justify-end">
      <DeleteSessionButton mode={detail.mode} onDelete={deleteSession} deleting={removal.isPending} />
    </div>
  );

  const footer = (
    <div className="flex flex-col gap-3">
      {accuracyRating}
      {deleteButton}
    </div>
  );

  // --- States -------------------------------------------------------------

  const layout = layoutOf(detail);
  let body: ReactNode;
  if (layout === "report") {
    body = (
      <PrepReport
        track={track}
        session={session}
        onBack={() => router.push(backHref)}
        onRunAnother={() => router.push(runAnotherHref)}
        tab={tab}
        onTabChange={showTab}
        player={player}
        delivery={
          (detail.delivery || noWordTimings) && (
            <>
              {noWordTimings && <NoWordTimingsNotice />}
              {detail.delivery && (
                <>
                  {/* Filler words are on the Diction tab, so they aren't listed twice. */}
                  <DeliveryFindings
                    flags={detail.delivery.flags.filter((flag) => !isDictionFinding(flag))}
                    metrics={detail.delivery.metrics}
                    turns={detail.turns}
                    noWordTimings={noWordTimings}
                  />
                  <DeliveryTimeline delivery={detail.delivery} turns={detail.turns} />
                </>
              )}
            </>
          )
        }
        transcript={transcript}
        transcriptFooter={accuracyRating}
        footer={deleteButton}
        sectionsPoll={sectionsPoll}
      />
    );
  } else {
    // The transcript is worth showing once it is final: typed answers always
    // are; spoken ones once the batch transcript has replaced the captions.
    const turnsFinal = !voice || detail.analysis.steps.transcribe.status === "done" || detail.locked;
    const hasAnswers = detail.turns.some((turn) => turn.who === "user" && turn.text.trim() !== "");
    const readyWithoutReport = detail.status === "ready" && !detail.locked;

    body = (
      <div className="max-w-[1000px] mx-auto flex flex-col gap-5">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-primary cursor-pointer w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          {track.company} — {track.role}
        </button>

        <SessionHeader detail={detail} />

        {player}

        {detail.locked ? (
          <LockedReport
            credits={detail.billing.credits}
            balance={refusal?.balance ?? accountBalance}
            onUnlock={() => unlock.mutate(id)}
            unlocking={unlock.isPending}
            error={unlock.error ? apiMessage(unlock.error) : null}
          />
        ) : readyWithoutReport ? (
          // The service says ready but sent no report; a reload usually
          // catches the one being written.
          <div className={cn(PANEL, "p-6")}>
            <p className="text-[15px] font-bold text-primary">Your report is almost here</p>
            <p className="mt-1 max-w-[520px] text-sm leading-relaxed text-black/55">It finished, but the report didn&apos;t come through with it. Check again in a moment.</p>
            <button
              type="button"
              onClick={() => void queryClient.invalidateQueries({ queryKey: detailKey })}
              className={cn(BUTTON_OUTLINE, "mt-4")}>
              <RotateCcw aria-hidden className="h-3.5 w-3.5" />
              Check again
            </button>
          </div>
        ) : (
          <AnalysisProgress
            status={detail.status}
            steps={detail.analysis.steps}
            progress={detail.analysis.progress}
            error={detail.analysis.error}
            retriesLeft={detail.analysis.retriesLeft}
            onRetry={retryAnalysis}
            retrying={retry.isPending}
            mode={detail.mode}
          />
        )}

        {turnsFinal && hasAnswers && (transcript ?? <TypedTranscript turns={detail.turns} />)}

        {footer}
      </div>
    );
  }

  // Everything that plays shares one recording, so the provider wraps the
  // whole report; without a recording, the chips inside simply don't render.
  return playable ? (
    <PlaybackProvider durationMs={detail.recording?.durationMs ?? detail.durationMs}>
      <PlaybackHandoff sessionId={id} layout={layout} />
      {body}
    </PlaybackProvider>
  ) : (
    body
  );
};

type Layout = "report" | "status";

/** The full report, or the page's own layout for every other state (in progress, failed, locked). */
const layoutOf = (detail: PrepSessionDetail): Layout => (detail.status === "ready" && !detail.locked && detail.report ? "report" : "status");

// ---------------------------------------------------------------------------
// The sections written after the report
// ---------------------------------------------------------------------------

/**
 * How the page reads a session whose report is out but whose Positioning or
 * Diction is still being written.
 */
const SECTIONS_POLL = {
  /** Past this a run is late rather than slow (it is a model call or two), so the page asks less often. */
  lateAfterMs: 2 * 60_000,
  lateMs: 30_000,
  /**
   * The service answers `unavailable` for a section still pending 15 minutes
   * after the report was published (INSIGHTS_STALE_MS in remoteworldwideai
   * prepSerializers.ts), which ends the wait by itself. This is for when that
   * doesn't happen (a publish time it can't read, a clock that disagrees):
   * sixteen minutes of waiting on this page is at least a minute past it, so
   * the page stops asking there and the section offers to check again. A
   * stuck `pending` never polls for good.
   */
  ceilingMs: 16 * 60_000,
} as const;

/** A shown report with a section still being written. An absent section (an older session) is not pending: it never arrives. */
const sectionsPending = (detail: PrepSessionDetail): boolean =>
  layoutOf(detail) === "report" && (detail.report?.positioning?.status === "pending" || detail.report?.diction?.status === "pending");

/** The wait so far, as a poll interval: the session query's own quick-then-slower rate, then twice a minute once late. */
const sectionsInterval = (waitedMs: number): number =>
  waitedMs < PREP_POLL.backoffAfterMs ? PREP_POLL.fastMs : waitedMs < SECTIONS_POLL.lateAfterMs ? PREP_POLL.slowMs : SECTIONS_POLL.lateMs;

/**
 * Keeps reading the session while `waiting` (a section is `pending`).
 *
 * The session query polls only while the session itself is in flight and
 * stops at `ready`, which is before these sections land. So this adds a
 * second observer to the same cached query, with the same fetch (the
 * `prepSessionQuery` options the page's query uses), enabled only while
 * waiting, with its own interval. The cache shares one fetch between the two
 * observers, and the page reads the answer through its own, so this one never
 * re-renders anything (`notifyOnChangeProps: []`).
 *
 * Past `SECTIONS_POLL.ceilingMs` the observer turns off and `stalled` says
 * so; "Check again" reads once at once and starts a fresh wait.
 */
function useSectionsPoll(sessionId: string, waiting: boolean): SectionsPoll {
  const queryClient = useQueryClient();
  // Bumped by "Check again": each round is a wait of its own, with its own ceiling.
  const [round, setRound] = useState(0);
  const [stalledRound, setStalledRound] = useState<number | null>(null);
  const waitingSince = useRef<number | null>(null);

  useEffect(() => {
    if (!waiting) return undefined;
    waitingSince.current = Date.now();
    const ceiling = window.setTimeout(() => setStalledRound(round), SECTIONS_POLL.ceilingMs);
    return () => {
      window.clearTimeout(ceiling);
      waitingSince.current = null;
    };
  }, [waiting, round]);

  const stalled = waiting && stalledRound === round;

  useQuery({
    ...prepSessionQuery(queryClient, sessionId),
    enabled: waiting && !stalled,
    // Read after each answer, so the rate eases off as the wait goes on.
    refetchInterval: () => sectionsInterval(waitingSince.current === null ? 0 : Date.now() - waitingSince.current),
    notifyOnChangeProps: [],
  });

  const onCheckAgain = useCallback(() => {
    setRound((r) => r + 1);
    void queryClient.invalidateQueries({ queryKey: qk.prep.session(sessionId), exact: true });
  }, [queryClient, sessionId]);

  return useMemo(() => ({ stalled, onCheckAgain }), [stalled, onCheckAgain]);
}

/**
 * The report arriving (or unlocking) swaps the page's layout, which remounts
 * the player and its <audio>. Someone listening at that moment should not be
 * cut off, so when the cached session is about to change layout, playback is
 * held and the new element resumes where the old one was, playing if it was.
 * It listens to the query cache because the cache hears the new data as it
 * lands, before React replaces the element.
 */
const PlaybackHandoff: FC<{ sessionId: string; layout: Layout }> = ({ sessionId, layout }) => {
  const controls = usePlaybackControls();
  const queryClient = useQueryClient();
  const shown = useRef(layout);
  useEffect(() => {
    shown.current = layout;
  }, [layout]);
  useEffect(() => {
    if (!controls) return undefined;
    const hash = hashKey(qk.prep.session(sessionId));
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.query.queryHash !== hash) return;
      const next = event.query.state.data as PrepSessionDetail | undefined;
      if (next && layoutOf(next) !== shown.current) controls.holdForReload();
    });
  }, [controls, queryClient, sessionId]);
  return null;
};

/** D15: the report transcript failed for good, so delivery says what it could not measure instead of reporting zeros. */
const NoWordTimingsNotice: FC = () => (
  <p role="note" className={cn(PANEL, "px-6 py-4 text-sm leading-relaxed text-black/60")}>
    <span className="font-bold text-primary">Word timings unavailable</span> — this report was built from what the interviewer heard, without a transcript.
  </p>
);

// ---------------------------------------------------------------------------
// The pieces around a report that isn't showing yet
// ---------------------------------------------------------------------------

/** A typed session's answers while its report is on the way (or failed): nothing was recorded, so nothing plays. */
const TypedTranscript: FC<{ turns: PrepSessionDetail["turns"] }> = ({ turns }) => (
  <section aria-label="Transcript" className={cn(PANEL, "p-6 flex flex-col gap-3.5")}>
    <h3 className="text-[14.5px] font-bold text-primary">What you wrote</h3>
    {turns.map((turn) => (
      <div key={turn.id}>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-black/35 mb-1">{turn.who === "user" ? "You" : "Interviewer"}</p>
        <p className={cn("text-sm leading-relaxed", turn.who === "user" ? "text-primary" : "text-black/60")}>{turn.text}</p>
      </div>
    ))}
  </section>
);

const SessionHeader: FC<{ detail: PrepSessionDetail }> = ({ detail }) => {
  const chip = savedSessionChip(detail.status, detail.locked);
  const when = detail.completedAt ?? detail.createdAt;
  const facts = [
    detail.mode === "voice" ? "Voice interview" : "Typed interview",
    formatDate(new Date(when), "EEE d MMM"),
    detail.durationMs !== null ? formatDuration(detail.durationMs) : `${detail.lengthMinutes} min`,
    detail.billing.credits !== null && detail.billing.credits > 0 ? `${detail.billing.credits} ${detail.billing.credits === 1 ? "credit" : "credits"}` : null,
  ].filter((fact): fact is string => fact !== null);

  return (
    <div className={cn(PANEL, "p-6 flex items-center gap-4 flex-wrap")}>
      <div className="flex-1 min-w-[220px]">
        <p className="text-[15px] font-bold text-primary mb-1">
          {formatsLabel(detail.prep.formats)} · {detail.prep.lengthMinutes} min
        </p>
        <p className="text-xs text-black/50">{facts.join(" · ")}</p>
      </div>
      <Chip tone={chip.tone}>{chip.label}</Chip>
    </div>
  );
};
