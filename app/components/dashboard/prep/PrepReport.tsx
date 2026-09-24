"use client";

import { FC, useEffect, useId, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Copy, Loader2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import SlidingTabs, { slidingTabId, slidingTabPanelId } from "@/app/components/dashboard/ui/SlidingTabs";
import AddToPlanButton from "@/app/components/dashboard/plan/AddToPlanButton";
import { apiMessage } from "@/app/lib/api/core";
import { formatsLabel } from "@/app/lib/dashboard/prep-data";
import type { ActionItem, DimensionScore, LanguageStat, PrepSession, PrepTrack, TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import { trackHref } from "@/app/lib/prep/tracks";
import { qk } from "@/app/lib/query/keys";
import { TASK_LIMITS, periodOf, type TaskInput, type TaskItem } from "@/app/lib/tasks/types";
import { FLAG_KIND_META, SEVERITY_LABELS, formatMeasure, numberAnswers } from "@/app/lib/voice/format";
import { scoreDisplayOf } from "@/app/lib/voice/mapSession";
import type { DeliveryFlag, UnscoredDimension } from "@/app/lib/voice/types";
import { useCreateTasks, useUpdateTask } from "@/hooks/mutations/useTaskMutations";
import Chip from "./Chip";
import EvidenceDialog from "./EvidenceDialog";
import SummaryLines from "./delivery/SummaryLines";
import TimestampChip from "./delivery/TimestampChip";
import DictionAnalysis from "./report/DictionAnalysis";
import PositioningPanel from "./report/PositioningPanel";
import type { SectionsPoll } from "./report/SectionStates";
import { evidenceSummary, isLegacyTooShort, scoreExplanation, scoreHeadline } from "./report/scoreCopy";

/**
 * One session's report, as the AI service graded it, in tabs. The page wires
 * the parts that talk to the service (player, delivery, transcript, footer) in
 * as slots, and keeps the open tab in the address, so this component stays
 * free of fetching and routing. Every timestamp chip here (summary, evidence,
 * rewrites, actions, findings) plays only when the page wraps the report in a
 * PlaybackProvider, which it does for a recorded session alone.
 *
 * Nothing here is scored in the browser, and there is no sample report to
 * stand in for a thin one: a session too short to grade says so. Whether the
 * score shows, and whether it is provisional, is mapSession's
 * `scoreDisplayOf`, which the hub reads too, so the two always agree.
 */
export interface PrepReportProps {
  /** The session's saved track, or the stand-in built from its snapshot when that track is gone. */
  track: PrepTrack;
  session: PrepSession;
  onBack: () => void;
  onRunAnother: () => void;
  /** The tab asked for. One this report doesn't show (a panel that is null) shows Overall. */
  tab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
  /**
   * Under the header, above the tabs: the recording player, which sticks while
   * the report scrolls. Outside every tab because every tab plays from it:
   * its <audio> has to stay mounted whichever one is open.
   */
  player?: ReactNode;
  /** On Overall, after the scores: the measured delivery findings and timeline, less the findings the Diction tab shows (`isDictionFinding`). */
  delivery?: ReactNode;
  /** The Transcript tab's transcript, e.g. one that follows the recording; without it, the turns as text. */
  transcript?: ReactNode;
  /** Under the transcript, on its tab: rating how accurate the transcript was. */
  transcriptFooter?: ReactNode;
  /** At the end, under every tab: deleting the session. */
  footer?: ReactNode;
  /**
   * Positioning and Diction are written after the report is out, and the page
   * keeps reading the session while either is `pending`. This says when it
   * has stopped (and how to ask again), so a pending section doesn't promise
   * to appear on its own once nothing is checking.
   */
  sectionsPoll?: SectionsPoll;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

/**
 * The report's tabs, in order. Each label is written here and nowhere else,
 * so renaming a tab is a one-line change. Adding one is a row here and its
 * panel in the report's `panels`, which the compiler asks for once the id is
 * in this list.
 */
// In the order the owner set: Overall, Transcript, Diction and Grammar, Positioning.
export const REPORT_TABS = [
  { id: "overall", label: "Overall" },
  { id: "transcript", label: "Transcript" },
  // Word choice: grammar, hedging, fillers, the stats counted from the words.
  // The owner asked for "Dictation and Grammar"; dictation here meant diction.
  { id: "diction", label: "Diction and Grammar" },
  // How the answers position you for the role, in the owner's four areas.
  { id: "positioning", label: "Positioning" },
] as const;

export type ReportTab = (typeof REPORT_TABS)[number]["id"];

/** The tab a report opens on, and what an unknown `?tab=` shows. */
export const DEFAULT_REPORT_TAB: ReportTab = "overall";

/** A `?tab=` value as a tab; anything that isn't one is the default. */
export function parseReportTab(value: string | null | undefined): ReportTab {
  return REPORT_TABS.find((t) => t.id === value)?.id ?? DEFAULT_REPORT_TAB;
}

/**
 * The measured findings the Diction tab shows: filler words are about the
 * words chosen, not the voice. The page leaves them out of the delivery card
 * on Overall, so each finding shows once.
 */
export const isDictionFinding = (flag: Pick<DeliveryFlag, "kind">): boolean => flag.kind === "fillers";

/**
 * The rubric's hedging score (remoteworldwideai prepRubric.ts): "maybe",
 * "I think", answers that trail off, and for a recording long silences and
 * fading volume. Mostly word choice, so the Diction tab opens it up; it stays
 * on the scorecard as well, where the overall score is the mean of every row.
 */
const CONFIDENCE_DIMENSION = "confidence";

// ---------------------------------------------------------------------------
// The report's actions, on the plan
// ---------------------------------------------------------------------------

/** Where a prep task on the plan leads back to when its track is gone. */
const PREP_TASK_HREF = "/dashboard/prep";

/** How many of the weakest dimensions have their actions put on the plan without asking. */
const AUTO_PLAN_DIMENSIONS = 2;

/**
 * Sessions whose report already put actions on the plan during this page load.
 *
 * Module-level because "the first time a report is shown" has to outlive the
 * report: going back to the track and returning must neither add again nor
 * announce it again. The dedupeKey is still the real guard: a repeated add
 * answers with the task under `existing`, and a task the user undid stays
 * dismissed.
 */
const autoPlannedSessions = new Set<string>();

/**
 * Saved sessions whose report already put actions on the plan, in any earlier
 * page load. A saved session outlives the page, so "the first time it is
 * shown" has to as well: without this, every reload would send the add again
 * and could announce it again. Newest first, capped, so the list stays small.
 * Storage can be missing or refuse (private mode, policy); the in-memory set
 * above still holds for this load, and the dedupeKey stops a second task.
 */
const AUTO_PLANNED_STORAGE_KEY = "rww.prep-auto-planned";
const AUTO_PLANNED_STORAGE_MAX = 200;

function readAutoPlanned(): string[] {
  try {
    const raw = window.localStorage.getItem(AUTO_PLANNED_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberAutoPlanned(serverId: string): void {
  try {
    const ids = [serverId, ...readAutoPlanned().filter((id) => id !== serverId)].slice(0, AUTO_PLANNED_STORAGE_MAX);
    window.localStorage.setItem(AUTO_PLANNED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Nothing to fall back to: this load's in-memory set already has it.
  }
}

interface PlannedAction {
  item: ActionItem;
  task: TaskInput;
}

/**
 * Each action item as a plan task, weakest dimension first.
 *
 * The service's report keeps one item per dimension in ascending score order,
 * so the same sort of `session.dimensions` pairs them by position; the
 * contract does not say which dimension each came from, so the pairing is a
 * stand-in. It still holds as a key: the stored report keeps its order, so
 * each item gets the same key every time it is shown. An item past the end of
 * that list keys on its own id instead.
 *
 * Keys on the session's service id (`prep:{serverId}:{dimension}`), stable
 * across reloads and devices, so the same report can never put the same action
 * on the plan twice.
 *
 * When the session's saved track is still there, each task carries its id
 * (`metadata.trackId`) and links back to it: that is what makes the task one
 * of the track's actions, on its checklist as well as on the plan.
 */
function planActions(session: PrepSession, track: PrepTrack): PlannedAction[] {
  const weakestFirst = [...session.dimensions].sort((a, b) => a.score - b.score);
  const ref = session.serverId ?? session.id;
  const trackId = track.saved ? track.id : null;
  return session.actionItems.map((item, index) => {
    const dimension = weakestFirst[index]?.id ?? null;
    return {
      item,
      task: {
        title: item.title.slice(0, TASK_LIMITS.titleMax),
        detail: item.detail.slice(0, TASK_LIMITS.detailMax),
        href: trackId ? trackHref(trackId) : PREP_TASK_HREF,
        dedupeKey: `prep:${ref}:${dimension ?? item.id}`,
        metadata: { dimension, effortMinutes: item.effortMinutes, ...(trackId ? { trackId } : {}) },
      },
    };
  });
}

/** What the report says about the actions it put on the plan by itself. */
type AutoPlanNote =
  | { kind: "added"; tasks: TaskItem[]; undoing: boolean; error: string | null }
  | { kind: "undone" }
  | { kind: "not-added"; message: string };

const PrepReport: FC<PrepReportProps> = ({
  track,
  session,
  onBack,
  onRunAnother,
  tab,
  onTabChange,
  player,
  delivery,
  transcript,
  transcriptFooter,
  footer,
  sectionsPoll,
}) => {
  const queryClient = useQueryClient();
  const tabsId = useId();

  // How the score reads: the hub's answer too (`scoreDisplayOf`), so a
  // session the hub lists as "61/100 · provisional" shows 61, marked
  // provisional, here. A report from before the evidence gates that was too
  // short has no score and nothing on its scorecard worth showing.
  const display = scoreDisplayOf(session);
  const legacyTooShort = isLegacyTooShort(session);
  const unscoredDimensions = legacyTooShort ? [] : (session.unscoredDimensions ?? []);

  // A button inside one tab that opens another goes away with its panel, so
  // focus moves to the tab it opened instead of dropping to the page.
  const openTab = (next: ReportTab) => {
    onTabChange(next);
    document.getElementById(slidingTabId(tabsId, next))?.focus();
  };

  // The report's own checklist ticks here; the plan (and the track, which
  // lists the plan tasks tied to it) is where an action persists.
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  // Which score or stat is opened up, if any.
  const [openDetail, setOpenDetail] = useState<DimensionScore | LanguageStat | null>(null);
  const detailIsStat = openDetail !== null && "value" in openDetail;

  function isActionDone(a: { id: string; done: boolean }): boolean {
    return ticked[a.id] ?? a.done;
  }

  function toggleAction(a: { id: string; done: boolean }) {
    setTicked((prev) => ({ ...prev, [a.id]: !(prev[a.id] ?? a.done) }));
  }

  // Leaving the report sends the track's checklist for a fresh read: "Add to
  // plan" here may have put one of these actions on it.
  useEffect(() => () => void queryClient.invalidateQueries({ queryKey: qk.prep.tracks() }), [queryClient]);

  // Fixed when the report opens, so every task it adds lands on one month's plan.
  const [planPeriod] = useState(() => periodOf(new Date()));
  const { mutateAsync: addTasks } = useCreateTasks({ toastErrors: false });
  const { mutateAsync: patchTask } = useUpdateTask({ toastErrors: false });
  const [planNote, setPlanNote] = useState<AutoPlanNote | null>(null);

  // The first showing of a scored report puts its two weakest dimensions'
  // actions on the plan without asking. Only a full score: a provisional one
  // rests on a session too short to charge, and without a score there are too
  // few judged dimensions to rank, so neither adds anything by itself. Their
  // actions can still be added one at a time below.
  const autoPlanDue = display.kind === "scored";
  const planRef = session.serverId ?? session.id;
  useEffect(() => {
    if (!autoPlanDue || autoPlannedSessions.has(planRef)) return;
    // Done in an earlier page load: say nothing and send nothing. Read here,
    // not during render, because storage exists only in the browser.
    if (session.serverId && readAutoPlanned().includes(session.serverId)) {
      autoPlannedSessions.add(planRef);
      return;
    }
    const tasks = planActions(session, track)
      .slice(0, AUTO_PLAN_DIMENSIONS)
      .map(({ task }) => ({ ...task, period: planPeriod }));
    if (tasks.length === 0) return;
    autoPlannedSessions.add(planRef);
    addTasks({ tasks, source: { kind: "prep", ref: planRef } })
      .then((result) => {
        if (session.serverId) rememberAutoPlanned(session.serverId);
        const refusal = result.rejected[0];
        if (result.created.length > 0) setPlanNote({ kind: "added", tasks: result.created, undoing: false, error: null });
        else if (refusal) setPlanNote({ kind: "not-added", message: refusal.message });
        // They are the track's actions now as well.
        void queryClient.invalidateQueries({ queryKey: qk.prep.tracks() });
      })
      .catch((error: unknown) => {
        // Nothing landed, so the next showing may try again.
        autoPlannedSessions.delete(planRef);
        setPlanNote({ kind: "not-added", message: apiMessage(error) });
      });
  }, [autoPlanDue, planRef, session, track, planPeriod, addTasks, queryClient]);

  // Undo dismisses rather than deletes: the dedupeKey stays behind, so these
  // actions never come back on their own, and each row's "Add to plan" can
  // still reopen one.
  async function undoAutoPlan() {
    if (planNote?.kind !== "added" || planNote.undoing) return;
    const { tasks } = planNote;
    setPlanNote({ ...planNote, undoing: true, error: null });
    const results = await Promise.allSettled(tasks.map((task) => patchTask({ id: task.id, input: { status: "dismissed" } })));
    const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (!failure) {
      setPlanNote({ kind: "undone" });
      return;
    }
    setPlanNote({
      kind: "added",
      tasks: tasks.filter((_, index) => results[index].status === "rejected"),
      undoing: false,
      error: apiMessage(failure.reason),
    });
  }

  // Since last time, only between two full scores: a provisional one is a
  // first read, not a verdict to measure progress against.
  const priorSessions = track.sessions.filter((s) => s.completedAt < session.completedAt);
  const prior = priorSessions[priorSessions.length - 1];
  const priorDisplay = prior ? scoreDisplayOf(prior) : null;
  const delta = display.kind === "scored" && priorDisplay?.kind === "scored" ? display.score - priorDisplay.score : null;

  // Why the score is provisional or missing, with the session's own numbers.
  const headline = scoreHeadline(display, session);
  const explanation = scoreExplanation(display, session);
  const restsOn = legacyTooShort ? null : evidenceSummary(session.scoreEvidence);

  // The Overall tab's halves. A dimension too thin to judge is listed on the
  // scorecard as such rather than dropped, so the card shows even when
  // nothing on it could be scored.
  const hasScorecard = !legacyTooShort && (session.dimensions.length > 0 || unscoredDimensions.length > 0);
  const hasSummary = (session.summary?.length ?? 0) > 0 || session.coachNote.trim() !== "";

  // What the Diction tab has to say. The stats and the Confidence score are
  // the rubric's: a report from before the evidence gates graded a too-short
  // session at the floors, so it shows neither, and since the gates a
  // Confidence the session couldn't support is listed as not judged. The
  // filler findings are measured from the recording, like delivery, so they
  // stand either way. A finding is kept even without the measured rate
  // beside it.
  const dictionFindings = session.delivery?.flags.filter(isDictionFinding) ?? [];
  const fillersMeasured = session.delivery !== undefined && (session.delivery.metrics.fillersPer100Words !== null || dictionFindings.length > 0);
  const wordStats = legacyTooShort ? [] : session.languageStats;
  const confidence = legacyTooShort ? undefined : session.dimensions.find((d) => d.id === CONFIDENCE_DIMENSION);
  const confidenceUnjudged = confidence ? undefined : unscoredDimensions.find((d) => d.id === CONFIDENCE_DIMENSION);

  // Every tab's panel; null leaves a tab out, so none is ever shown empty.
  // Positioning and Diction always show: when a session has no analysis for
  // them, saying so (not analysed, still analysing, unavailable) is the
  // content. Only the open one is mounted, which is why the player sits
  // outside them.
  const panels: Record<ReportTab, ReactNode> = {
    overall: (
      <>
        {explanation && (
          <DashCard className="p-7 border-dashed border-2 border-black/20">
            <h3 className="text-[15px] font-bold text-primary mb-1.5">
              {display.kind === "provisional" ? "Provisional score" : legacyTooShort ? "Too short to score" : "Not enough to score"}
            </h3>
            <p className="text-sm text-black/60 leading-relaxed max-w-[560px]">
              {explanation}
              {legacyTooShort && " The transcript is kept either way."}
            </p>
            {restsOn && (
              <p className="text-xs text-black/55 leading-relaxed mt-2">
                <span className="font-bold text-black/65">What it rests on: </span>
                {restsOn}
              </p>
            )}
            <div className="flex gap-2.5 flex-wrap mt-4">
              <button type="button" onClick={onRunAnother} className="text-xs font-bold bg-[#222325] text-white rounded-lg px-3.5 py-2.5 cursor-pointer w-fit">
                Run a longer session
              </button>
              <button
                type="button"
                onClick={() => openTab("transcript")}
                className="text-xs font-semibold border-[1.5px] border-black/16 rounded-lg px-3.5 py-2.5 cursor-pointer hover:border-black/40">
                Read the transcript
              </button>
            </div>
          </DashCard>
        )}

        {/* Delivery is measured from the recording, not scored from the answers,
            so it has something to say even when the answers were too short. */}
        {legacyTooShort && delivery}

        {!legacyTooShort && (
          <>
            {(hasScorecard || hasSummary) && (
              <div className={cn("grid grid-cols-1 gap-5 items-start", hasScorecard && hasSummary && "md:grid-cols-2")}>
                {hasScorecard && (
                  <DashCard className="p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="text-[14.5px] font-bold text-primary">Scorecard</h3>
                      {display.kind === "provisional" && <Chip tone="blue">Provisional</Chip>}
                    </div>
                    <div className="flex flex-col gap-3.5">
                      {session.dimensions.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setOpenDetail(d)}
                          className="group text-left w-full cursor-pointer rounded-lg -mx-2 px-2 py-1.5 hover:bg-[#fbfbf7] transition-colors">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-bold text-primary inline-flex items-center gap-1">
                              {d.label}
                              <ChevronRight className="h-3.5 w-3.5 text-black/25 group-hover:text-black/60 transition-colors" />
                            </span>
                            <span className="text-sm font-bold text-primary tabular-nums">{d.score}</span>
                          </div>
                          <ProgressBar value={d.score * 10} fillColor={d.score < 7 ? "#cddd54" : "#e1f073"} height="h-1.5" className="mb-1.5" />
                          <p className="text-xs text-black/50 leading-relaxed">{d.note}</p>
                        </button>
                      ))}
                      {unscoredDimensions.map((d) => (
                        <UnjudgedRow key={d.id} dimension={d} />
                      ))}
                    </div>
                  </DashCard>
                )}

                {hasSummary && (
                  <div className="flex flex-col gap-5">
                    {/* A saved report writes its note a line at a time, each tied to a
                        moment in the recording; the joined note is the fallback. */}
                    {session.summary && session.summary.length > 0 ? (
                      <SummaryLines lines={session.summary} />
                    ) : (
                      <div className="bg-[#222325] text-white rounded-2xl p-5">
                        <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-secondary mb-2.5">Coach note</p>
                        <p className="text-sm text-white/80 leading-relaxed">{session.coachNote}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {delivery}

            {session.rewrites.length > 0 && (
              <DashCard className="p-0 overflow-hidden">
                <p className="text-[14.5px] font-bold text-primary px-6 py-4 border-b border-black/8">
                  {session.rewrites.length === 1 ? "One answer worth revisiting" : `${session.rewrites.length} answers worth revisiting`}
                </p>
                {session.rewrites.map((r) => (
                  <div key={r.id} className="px-6 py-5 border-b border-black/6 last:border-b-0">
                    <p className="text-sm font-bold text-primary mb-3">{r.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="rounded-xl border border-black/8 bg-[#fbfbf7] p-3.5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-black/40">{session.mode === "voice" ? "What you said" : "What you typed"}</p>
                          {r.atMs !== undefined && <TimestampChip atMs={r.atMs} endMs={r.endMs} />}
                        </div>
                        <p className="text-sm text-black/65 leading-relaxed">{r.said}</p>
                      </div>
                      <div className="rounded-xl border-2 border-[#222325] p-3.5 shadow-[3px_3px_0_0_#e1f073]">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-primary">A stronger version</p>
                          <button type="button" onClick={() => navigator.clipboard?.writeText(r.better)} className="text-black/40 hover:text-primary cursor-pointer">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-sm text-primary leading-relaxed">{r.better}</p>
                      </div>
                    </div>
                    <p className="text-xs text-black/45 mt-2.5">{r.why}</p>
                  </div>
                ))}
              </DashCard>
            )}

            <DashCard className="p-6">
              <div className="flex items-baseline justify-between mb-3.5">
                <p className="text-[14.5px] font-bold text-primary">Do these before your next round</p>
                <span className="text-xs text-black/45 tabular-nums">
                  {session.actionItems.filter(isActionDone).length} of {session.actionItems.length} done
                </span>
              </div>
              {/* Mounted before there is anything to say: a status region that
                  appears already holding its text is often not announced, and
                  this one says the plan changed without being asked. */}
              <div
                role="status"
                className={cn(
                  planNote && "mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-black/8 bg-[#f6faea] px-3.5 py-2.5 text-xs",
                )}>
                {planNote && (
                  <>
                    {planNote.kind === "added" && (
                      <>
                        <span className="font-semibold text-primary">
                          Added {planNote.tasks.length} {planNote.tasks.length === 1 ? "action" : "actions"} to your plan
                        </span>
                        <button
                          type="button"
                          onClick={() => void undoAutoPlan()}
                          aria-disabled={planNote.undoing || undefined}
                          className="inline-flex cursor-pointer items-center gap-1 font-bold text-primary underline decoration-2 underline-offset-2 hover:text-[#55591f] aria-disabled:cursor-default aria-disabled:opacity-60">
                          {planNote.undoing && <Loader2 aria-hidden className="h-3 w-3 animate-spin" />}
                          Undo
                        </button>
                        {planNote.error && <span className="basis-full text-red-700">{planNote.error}</span>}
                      </>
                    )}
                    {planNote.kind === "undone" && <span className="text-black/60">Taken back off your plan. You can add any of them again below.</span>}
                    {planNote.kind === "not-added" && <span className="text-black/60">Nothing was added to your plan. {planNote.message}</span>}
                  </>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {planActions(session, track).map(({ item: a, task }) => {
                  const done = isActionDone(a);
                  return (
                    // Side by side, not nested: the toggle and "Add to plan" are
                    // both buttons, and a button can't hold another.
                    <div key={a.id} className="flex items-start gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        className="group flex min-w-0 flex-1 gap-3 items-start text-left cursor-pointer"
                        onClick={() => toggleAction(a)}>
                        <NeoCheckbox checked={done} />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm font-semibold", done ? "text-black/40 line-through" : "text-primary")}>{a.title}</span>
                          <span className="block text-xs text-black/45 mt-0.5">{a.detail}</span>
                        </span>
                        <span className="text-xs font-bold text-black/45 flex-none tabular-nums">{a.effortMinutes} min</span>
                      </button>
                      {/* The moment this action comes from; beside the toggle, not in it, for the same reason. */}
                      {a.atMs !== undefined && <TimestampChip atMs={a.atMs} endMs={a.endMs} className="mt-0.5" />}
                      {/* On every action, the ones added above included (they read "Added"). */}
                      <AddToPlanButton task={{ ...task, period: planPeriod }} source={{ kind: "prep", ref: planRef }} />
                    </div>
                  );
                })}
              </div>
            </DashCard>
          </>
        )}
      </>
    ),

    transcript: (
      <>
        {transcript ?? <TurnsTranscript turns={session.transcript} />}
        {transcriptFooter}
      </>
    ),

    positioning: <PositioningPanel section={session.positioning} turns={session.transcript} poll={sectionsPoll} />,

    // The counted stats and Confidence first, then the analysed notes on
    // grammar and word choice, then the filler moments the recording measured.
    diction: (
      <>
        {(wordStats.length > 0 || confidence || confidenceUnjudged) && (
          <div className={cn("grid grid-cols-1 gap-5 items-start", wordStats.length > 0 && (confidence || confidenceUnjudged) && "md:grid-cols-2")}>
            {wordStats.length > 0 && (
              <DashCard className="p-6">
                <h3 className="text-[14.5px] font-bold text-primary mb-3.5">How you spoke</h3>
                <div className="flex flex-col gap-2.5">
                  {wordStats.map((stat) => (
                    <button
                      key={stat.id}
                      type="button"
                      onClick={() => setOpenDetail(stat)}
                      className="group flex items-baseline justify-between gap-3 w-full text-left cursor-pointer rounded-lg -mx-2 px-2 py-1 hover:bg-[#fbfbf7] transition-colors">
                      <span className="text-sm text-black/60 inline-flex items-center gap-1">
                        {stat.label}
                        <ChevronRight className="h-3.5 w-3.5 text-black/25 group-hover:text-black/60 transition-colors" />
                      </span>
                      <span className={cn("text-sm font-semibold text-right", stat.good ? "text-primary" : "text-black/45")}>{stat.value}</span>
                    </button>
                  ))}
                </div>
              </DashCard>
            )}

            {confidence && (
              <DashCard className="p-6">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <h3 className="text-[14.5px] font-bold text-primary">{confidence.label}</h3>
                  <span className="text-sm font-bold text-primary tabular-nums">
                    {confidence.score} / 10
                    {display.kind === "provisional" && <span className="font-normal text-black/50"> · provisional</span>}
                  </span>
                </div>
                <ProgressBar value={confidence.score * 10} fillColor={confidence.score < 7 ? "#cddd54" : "#e1f073"} height="h-1.5" className="mb-3" />
                <p className="text-sm text-black/60 leading-relaxed">{confidence.note}</p>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mt-4 mb-1">How to move this</p>
                <p className="text-sm text-black/60 leading-relaxed">{confidence.howToImprove}</p>
                {confidence.evidence.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpenDetail(confidence)}
                    className="mt-3.5 inline-flex items-center gap-1 text-xs font-bold text-primary cursor-pointer hover:text-[#55591f]">
                    {confidence.evidence.length === 1 ? "1 place this showed up" : `${confidence.evidence.length} places this showed up`}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </DashCard>
            )}

            {/* Too little to judge: said so, with what would get it judged, rather than a number. */}
            {confidenceUnjudged && (
              <DashCard className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-1.5">
                  <h3 className="text-[14.5px] font-bold text-primary">{confidenceUnjudged.label}</h3>
                  <Chip tone="white">Not enough to judge</Chip>
                </div>
                <p className="text-sm text-black/60 leading-relaxed">{confidenceUnjudged.note}</p>
                {confidenceUnjudged.howToImprove && (
                  <>
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mt-4 mb-1">To get it judged</p>
                    <p className="text-sm text-black/60 leading-relaxed">{confidenceUnjudged.howToImprove}</p>
                  </>
                )}
              </DashCard>
            )}
          </div>
        )}

        <DictionAnalysis section={session.diction} turns={session.transcript} mode={session.mode} poll={sectionsPoll} />

        {fillersMeasured && <DictionFindings flags={dictionFindings} turns={session.transcript} />}
      </>
    ),
  };

  // A tab asked for but left out (a null panel) shows Overall.
  const tabs = REPORT_TABS.filter((t) => panels[t.id] !== null);
  const shown = tabs.some((t) => t.id === tab) ? tab : DEFAULT_REPORT_TAB;

  return (
    <div className="max-w-[1000px] mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-primary cursor-pointer w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          {track.company} — {track.role}
        </button>
      </div>

      <DashCard className="p-6 flex items-center gap-6 flex-wrap">
        <div className="flex-none flex items-end gap-2.5">
          {display.kind === "unscored" ? (
            <span className="text-4xl font-bold text-black/30 leading-none">
              <span aria-hidden>—</span>
              <span className="sr-only">No overall score</span>
            </span>
          ) : (
            <span className="text-4xl font-bold text-primary leading-none tabular-nums">
              <span className="sr-only">Overall score </span>
              {display.score}
              <span className="sr-only"> out of 100</span>
            </span>
          )}
          {/* Marked in words at the number itself, not only in the line beside it. */}
          {display.kind === "provisional" && (
            <Chip tone="blue" className="mb-0.5">
              Provisional
            </Chip>
          )}
          {delta !== null && (
            <span className={cn("text-sm font-bold pb-1", delta >= 0 ? "text-[#55591f]" : "text-black/45")}>
              {delta >= 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-[220px]">
          <p className="text-[15px] font-bold text-primary mb-1">
            {formatsLabel(session.formats)} · {session.lengthMinutes} min
          </p>
          <p className="text-xs text-black/50">
            {session.difficulty} · {track.company}
          </p>
          {headline && <p className="text-xs font-semibold text-black/65 leading-relaxed mt-2">{headline}</p>}
        </div>
        <div className="flex gap-2.5 flex-none flex-wrap">
          <button
            type="button"
            onClick={onRunAnother}
            className="text-xs font-bold bg-[#222325] text-white rounded-lg px-3.5 py-2.5 cursor-pointer transition-[transform,box-shadow] duration-100 hover:shadow-[3px_3px_0_0_#e1f073] hover:-translate-x-px hover:-translate-y-px inline-flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5" />
            Run another session
          </button>
          <button type="button" onClick={onBack} className="text-xs font-semibold border-[1.5px] border-black/16 rounded-lg px-3.5 py-2.5 cursor-pointer hover:border-black/40">
            Back to prep
          </button>
        </div>
      </DashCard>

      {player}

      <SlidingTabs value={shown} options={tabs} onChange={onTabChange} tablist={{ id: tabsId, label: "Report sections" }} />

      {/* Keyed by tab, so each one opens fresh, as a page of its own would. */}
      <div
        key={shown}
        role="tabpanel"
        id={slidingTabPanelId(tabsId, shown)}
        aria-labelledby={slidingTabId(tabsId, shown)}
        tabIndex={0}
        className="flex flex-col gap-5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f6f6f6]">
        {panels[shown]}
      </div>

      {openDetail && (
        <EvidenceDialog
          open
          onOpenChange={(v) => !v && setOpenDetail(null)}
          title={openDetail.label}
          value={detailIsStat ? (openDetail as LanguageStat).value : `${(openDetail as DimensionScore).score} / 10`}
          summary={detailIsStat ? "" : (openDetail as DimensionScore).note}
          howToImprove={openDetail.howToImprove}
          evidence={openDetail.evidence}
        />
      )}

      {footer}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab pieces
// ---------------------------------------------------------------------------

/**
 * A scorecard row the session gave too little to judge. No number and no
 * filled bar, which would read as a low score; a dashed empty track keeps the
 * row's shape, the words say what it is, and the service's own lines say
 * which gate it missed and what would get it judged.
 */
const UnjudgedRow: FC<{ dimension: UnscoredDimension }> = ({ dimension: d }) => (
  <div className="-mx-2 px-2 py-1.5">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-1.5">
      <span className="text-sm font-bold text-primary">{d.label}</span>
      <Chip tone="white">Not enough to judge</Chip>
    </div>
    <div aria-hidden className="h-1.5 rounded-full border border-dashed border-black/25 mb-1.5" />
    <p className="text-xs text-black/50 leading-relaxed">{d.note}</p>
    {d.howToImprove && (
      <p className="text-xs text-black/60 leading-relaxed mt-1">
        <span className="font-bold text-black/70">To get it judged: </span>
        {d.howToImprove}
      </p>
    )}
  </div>
);

/** The turns as text, for a report without a transcript that follows the recording (a typed session). */
const TurnsTranscript: FC<{ turns: readonly TranscriptTurn[] }> = ({ turns }) => {
  const questions = turns.filter((t) => t.who === "ai").length;
  return (
    <DashCard className="p-6 flex flex-col gap-3.5">
      <h3 className="text-[14.5px] font-bold text-primary">
        Full transcript · {questions} {questions === 1 ? "question" : "questions"}
      </h3>
      {turns.map((t) => (
        <div key={t.id}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-black/35 mb-1">{t.who === "user" ? "You" : "Interviewer"}</p>
          <p className={cn("text-sm leading-relaxed", t.who === "user" ? "text-primary" : "text-black/60")}>{t.text}</p>
        </div>
      ))}
    </DashCard>
  );
};

/**
 * The answers where filler words bunched up, as the recording measured them:
 * each with its rate against the session's own, one line of coaching and a
 * chip that plays it. Laid out like the delivery card's findings on Overall,
 * which lists every other kind, so the two read as one set.
 */
const DictionFindings: FC<{ flags: readonly DeliveryFlag[]; turns: readonly TranscriptTurn[] }> = ({ flags, turns }) => {
  const numbers = numberAnswers(turns);
  const meta = FLAG_KIND_META.fillers;
  const inOrder = [...flags].sort((a, b) => a.atMs - b.atMs);
  return (
    <section aria-label={meta.label} className="rounded-2xl border border-black/10 bg-white">
      <header className="px-5 pb-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-[14.5px] font-bold text-primary">{meta.label}</h3>
          {inOrder.length > 0 && (
            <span className="text-xs text-black/45">
              {inOrder.length} {inOrder.length === 1 ? "answer" : "answers"}
            </span>
          )}
        </div>
        <p className="mt-1 max-w-[560px] text-xs leading-relaxed text-black/50">{meta.what}</p>
      </header>
      <div className="border-t border-black/10 px-5 py-5 sm:px-6">
        {inOrder.length === 0 ? (
          <p className="text-sm leading-relaxed text-black/55">No answer had enough of them to stand out.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {inOrder.map((flag) => {
              const answer = numbers.get(flag.turnId);
              return (
                <li key={flag.id} className="flex items-start gap-3 rounded-xl border border-black/10 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-primary">{formatMeasure(flag.measure)}</p>
                    <p className="mt-1 text-sm leading-relaxed text-black/60">{flag.coaching}</p>
                    <p className="mt-1.5 text-[11.5px] text-black/40">
                      {answer !== undefined && <>Answer {answer} · </>}
                      {SEVERITY_LABELS[flag.severity]}
                    </p>
                  </div>
                  <TimestampChip atMs={flag.atMs} endMs={flag.endMs} className="mt-0.5" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default PrepReport;
