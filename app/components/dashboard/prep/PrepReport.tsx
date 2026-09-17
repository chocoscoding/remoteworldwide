"use client";

import { FC, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Copy, Loader2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import AddToPlanButton from "@/app/components/dashboard/plan/AddToPlanButton";
import { apiMessage } from "@/app/lib/api/core";
import { buildDemoReport } from "@/app/lib/dashboard/prep-engine";
import { formatsLabel } from "@/app/lib/dashboard/prep-data";
import type { ActionItem, DimensionScore, LanguageStat, PrepSession, PrepTrack } from "@/app/lib/dashboard/prep-data";
import { TASK_LIMITS, periodOf, type TaskInput, type TaskItem } from "@/app/lib/tasks/types";
import { useCreateTasks, useUpdateTask } from "@/hooks/mutations/useTaskMutations";
import PreviewToggle from "./PreviewToggle";
import EvidenceDialog from "./EvidenceDialog";
import SummaryLines from "./delivery/SummaryLines";
import TimestampChip from "./delivery/TimestampChip";

/**
 * One session's report. A demo session scored in the browser and a session
 * the AI service saved render through the same component; the saved one adds
 * pieces the page wires to the service, passed in as slots so this component
 * stays free of fetching. Every timestamp chip here (summary, evidence,
 * rewrites, actions) plays only when the page wraps the report in a
 * PlaybackProvider, which it does for a recorded session alone.
 */
export interface PrepReportProps {
  track: PrepTrack;
  session: PrepSession;
  onBack: () => void;
  onRunAnother: () => void;
  onToggleAction: (actionId: string) => void;
  /** Under the header: the recording player, which sticks while the report scrolls. */
  player?: ReactNode;
  /** After the scores: the measured delivery findings and timeline. */
  delivery?: ReactNode;
  /** Replaces the fold-out transcript, e.g. with one that follows the recording. */
  transcript?: ReactNode;
  /** At the end: rating the transcript, deleting the session. */
  footer?: ReactNode;
}

const GENERATING_STEPS = ["Read the transcript", "Scored six dimensions", "Writing rewrites and actions…"];

// ---------------------------------------------------------------------------
// The report's actions, on the plan
// ---------------------------------------------------------------------------

/** Where a prep task on the plan leads back to. */
const PREP_TASK_HREF = "/dashboard/prep";

/** How many of the weakest dimensions have their actions put on the plan without asking. */
const AUTO_PLAN_DIMENSIONS = 2;

/**
 * Sessions whose report already put actions on the plan during this page load.
 *
 * Module-level because "the first time a report is shown" has to outlive the
 * report: going back to the track and returning must neither add again nor
 * announce it again. It lasts exactly as long as the sessions themselves,
 * which PrepProvider keeps in memory. The dedupeKey is still the real guard: a
 * repeated add answers with the task under `existing`, and a task the user
 * undid stays dismissed.
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
 * ActionItem doesn't say which dimension it came from. `buildActions` in
 * prep-engine.ts writes one item per dimension in ascending score order (a
 * stable sort of `session.dimensions`), so the same sort pairs them by
 * position. An item past the end of that list keys on its own id instead.
 *
 * A saved session keys on its service id (`prep:{serverId}:{dimension}`),
 * which is stable across reloads and devices, so the same report can never put
 * the same action on the plan twice. Its items are the report model's, checked
 * by the service, and the contract does not say which dimension each came
 * from, so the pairing by position is a stand-in there. It still holds as a
 * key: the stored report keeps its order, so each item gets the same key every
 * time it is shown.
 */
function planActions(session: PrepSession): PlannedAction[] {
  const weakestFirst = [...session.dimensions].sort((a, b) => a.score - b.score);
  const ref = session.serverId ?? session.id;
  return session.actionItems.map((item, index) => {
    const dimension = weakestFirst[index]?.id ?? null;
    return {
      item,
      task: {
        title: item.title.slice(0, TASK_LIMITS.titleMax),
        detail: item.detail.slice(0, TASK_LIMITS.detailMax),
        href: PREP_TASK_HREF,
        dedupeKey: `prep:${ref}:${dimension ?? item.id}`,
        metadata: { dimension, effortMinutes: item.effortMinutes },
      },
    };
  });
}

/** What the report says about the actions it put on the plan by itself. */
type AutoPlanNote =
  | { kind: "added"; tasks: TaskItem[]; undoing: boolean; error: string | null }
  | { kind: "undone" }
  | { kind: "not-added"; message: string };

const PrepReport: FC<PrepReportProps> = ({ track, session: sessionProp, onBack, onRunAnother, onToggleAction, player, delivery, transcript, footer }) => {
  const saved = sessionProp.serverId !== undefined;
  // A saved session's report was written by the service before this page
  // could show it (the page showed the real progress meanwhile), so there is
  // nothing to stage.
  const [ready, setReady] = useState(saved);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [preview, setPreview] = useState<"default" | "too-short">("default");
  // A real session that was skipped through has nothing to show, so the
  // "Default" preview would render the too-short state and the full report
  // would be unreachable. Substituting a demo report — scored by the real
  // engine over a canned transcript — makes both states actually viewable.
  // Built lazily so the substitution costs nothing on a normal report.
  // Never for a saved session: that one is the user's real result, and made-up
  // scores in its place would read as theirs.
  const [demo] = useState(() => buildDemoReport(track));
  const substitute = sessionProp.tooShort && !saved;
  const session: PrepSession = preview === "too-short" ? { ...sessionProp, tooShort: true } : substitute ? demo : sessionProp;
  const showingDemo = preview === "default" && substitute;

  // Demo action ids don't exist on the track, so they'd be inert if routed
  // through onToggleAction. Ticking them locally keeps the preview honest
  // about how the checklist behaves without writing sample data to the track.
  // A saved session's actions aren't on the in-memory track either (the
  // service keeps the report, not a checklist), so they tick locally too; the
  // plan is where they persist.
  const localChecklist = showingDemo || saved;
  const [demoDone, setDemoDone] = useState<Record<string, boolean>>({});
  // Which score or stat is opened up, if any.
  const [openDetail, setOpenDetail] = useState<DimensionScore | LanguageStat | null>(null);
  const detailIsStat = openDetail !== null && "value" in openDetail;

  function isActionDone(a: { id: string; done: boolean }): boolean {
    if (localChecklist) return demoDone[a.id] ?? a.done;
    return track.actions.find((ta) => ta.id === a.id)?.done ?? a.done;
  }

  function toggleAction(a: { id: string; done: boolean }) {
    if (localChecklist) setDemoDone((prev) => ({ ...prev, [a.id]: !(prev[a.id] ?? a.done) }));
    else onToggleAction(a.id);
  }

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setReady(true), 1400);
    return () => clearTimeout(t);
  }, [ready]);

  // Fixed when the report opens, so every task it adds lands on one month's plan.
  const [planPeriod] = useState(() => periodOf(new Date()));
  const { mutateAsync: addTasks } = useCreateTasks({ toastErrors: false });
  const { mutateAsync: patchTask } = useUpdateTask({ toastErrors: false });
  const [planNote, setPlanNote] = useState<AutoPlanNote | null>(null);

  // The first showing of a scored report puts its two weakest dimensions'
  // actions on the plan without asking. A real session's only: the demo that
  // stands in for a skipped session is sample data, and a too-short session
  // has no scores to rank. It waits for `ready`, so a report left before it
  // appeared has added nothing.
  const autoPlanDue = ready && !sessionProp.tooShort;
  const planRef = sessionProp.serverId ?? sessionProp.id;
  useEffect(() => {
    if (!autoPlanDue || autoPlannedSessions.has(planRef)) return;
    // Done in an earlier page load: say nothing and send nothing. Read here,
    // not during render, because storage exists only in the browser.
    if (sessionProp.serverId && readAutoPlanned().includes(sessionProp.serverId)) {
      autoPlannedSessions.add(planRef);
      return;
    }
    const tasks = planActions(sessionProp)
      .slice(0, AUTO_PLAN_DIMENSIONS)
      .map(({ task }) => ({ ...task, period: planPeriod }));
    if (tasks.length === 0) return;
    autoPlannedSessions.add(planRef);
    addTasks({ tasks, source: { kind: "prep", ref: planRef } })
      .then((result) => {
        if (sessionProp.serverId) rememberAutoPlanned(sessionProp.serverId);
        const refusal = result.rejected[0];
        if (result.created.length > 0) setPlanNote({ kind: "added", tasks: result.created, undoing: false, error: null });
        else if (refusal) setPlanNote({ kind: "not-added", message: refusal.message });
      })
      .catch((error: unknown) => {
        // Nothing landed, so the next showing may try again.
        autoPlannedSessions.delete(planRef);
        setPlanNote({ kind: "not-added", message: apiMessage(error) });
      });
  }, [autoPlanDue, planRef, sessionProp, planPeriod, addTasks]);

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

  const priorSessions = track.sessions.filter((s) => s.completedAt < session.completedAt);
  const prior = priorSessions[priorSessions.length - 1];
  const delta = prior && !prior.tooShort && !session.tooShort ? session.overallScore - prior.overallScore : null;

  return (
    <div className="max-w-[1000px] mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-primary cursor-pointer w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          {track.company} — {track.role}
        </button>
        <PreviewToggle
          value={preview}
          onChange={setPreview}
          options={[
            { id: "default", label: "Default" },
            { id: "too-short", label: "Too short" },
          ]}
        />
      </div>

      <DashCard className="p-6 flex items-center gap-6 flex-wrap">
        <div className="flex-none flex items-end gap-2.5">
          <span className="text-4xl font-bold text-primary leading-none tabular-nums">{session.tooShort ? "—" : session.overallScore}</span>
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

      {!ready && (
        <DashCard className="p-6">
          <p className="text-sm font-bold text-primary mb-3.5">Writing your report</p>
          <div className="flex flex-col gap-2.5">
            {GENERATING_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2.5 text-sm font-semibold text-primary">
                <span
                  className={cn(
                    "h-4.5 w-4.5 rounded-full flex items-center justify-center text-[9px] flex-none",
                    i < 2 ? "bg-secondary" : "border-2 border-[#222325]"
                  )}>
                  {i < 2 ? "✓" : ""}
                </span>
                {s}
              </div>
            ))}
          </div>
          <ProgressBar value={68} className="mt-4" height="h-1.5" />
        </DashCard>
      )}

      {ready && session.tooShort && (
        <DashCard className="p-7 border-dashed border-2 border-black/20">
          <p className="text-[15px] font-bold text-primary mb-1.5">Too short to score</p>
          <p className="text-sm text-black/60 leading-relaxed max-w-[460px] mb-4">
            You answered {session.transcript.filter((t) => t.who === "user" && t.text.trim()).length} question
            {session.transcript.filter((t) => t.who === "user" && t.text.trim()).length === 1 ? "" : "s"} — scoring needs a bit more to be
            worth anything. The transcript is below and kept either way.
          </p>
          <button type="button" onClick={onRunAnother} className="text-xs font-bold bg-[#222325] text-white rounded-lg px-3.5 py-2.5 cursor-pointer w-fit">
            Run a proper session
          </button>
        </DashCard>
      )}

      {/* Delivery is measured from the recording, not scored from the answers,
          so it has something to say even when the answers were too short. */}
      {ready && session.tooShort && delivery}

      {ready && !session.tooShort && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            <DashCard className="p-6">
              <p className="text-[14.5px] font-bold text-primary mb-4">Scorecard</p>
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
              </div>
            </DashCard>

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
              <DashCard className="p-5">
                <p className="text-[14.5px] font-bold text-primary mb-3.5">How you spoke</p>
                <div className="flex flex-col gap-2.5">
                  {session.languageStats.map((stat) => (
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
            </div>
          </div>

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
              {planActions(session).map(({ item: a, task }) => {
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
                    {/* On every real action, the ones added above included (they read "Added"). Never on the demo's sample actions. */}
                    {!showingDemo && <AddToPlanButton task={{ ...task, period: planPeriod }} source={{ kind: "prep", ref: planRef }} />}
                  </div>
                );
              })}
            </div>
          </DashCard>
        </>
      )}

      {transcript ?? (
        <button
          type="button"
          onClick={() => setTranscriptOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-6 py-4 cursor-pointer hover:border-black/25 transition-colors">
          <span className="text-sm font-bold text-primary">Full transcript · {session.transcript.filter((t) => t.who === "ai").length} questions</span>
          <span className="text-xs font-bold text-black/50 inline-flex items-center gap-1">
            {transcriptOpen ? "Hide" : "Show"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", transcriptOpen && "rotate-180")} />
          </span>
        </button>
      )}

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

      {transcript === undefined && transcriptOpen && (
        <DashCard className="p-6 flex flex-col gap-3.5">
          {session.transcript.map((t) => (
            <div key={t.id}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-black/35 mb-1">{t.who === "user" ? "You" : "Interviewer"}</p>
              <p className={cn("text-sm leading-relaxed", t.who === "user" ? "text-primary" : "text-black/60")}>{t.text}</p>
            </div>
          ))}
        </DashCard>
      )}

      {footer}
    </div>
  );
};

export default PrepReport;
