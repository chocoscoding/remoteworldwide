"use client";

import { FC, useId, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, ListChecks, Loader2, Mic, Pencil, Plus } from "lucide-react";
import { format as formatDate } from "date-fns";
import { cn } from "@/lib/utils";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import { apiMessage } from "@/app/lib/api/core";
import { computePreparedness } from "@/app/lib/dashboard/prep-engine";
import { formatsLabel } from "@/app/lib/dashboard/prep-data";
import type { PrepSession, PrepTrack, SessionFormat } from "@/app/lib/dashboard/prep-data";
import { ROUND_OUTCOME_LABELS, ROUND_TYPE_LABELS, currentRound, roundInputs, roundName } from "@/app/lib/prep/tracks";
import type { PrepRound, PrepRoundInput, PrepRoundOutcome, UpdatePrepTrackInput } from "@/app/lib/prep/types";
import { TASK_LIMITS, type AddTasksResult } from "@/app/lib/tasks/types";
import { formatDuration } from "@/app/lib/voice/format";
import { scoreDisplayOf, sessionBelongsTo } from "@/app/lib/voice/mapSession";
import type { BillingState, PrepSessionMode, PrepSessionStatus, PrepSessionSummary } from "@/app/lib/voice/types";
import { useLikelyQuestions } from "@/hooks/queries/usePrepTrackQueries";
import { usePrepSessions } from "@/hooks/queries/usePrepSessionQueries";
import type { ChipTone } from "./Chip";
import Chip from "./Chip";
import LikelyQuestions from "./LikelyQuestions";
import PrepEmptyState from "./PrepEmptyState";
import RoundDialog, { type RoundDraft } from "./RoundDialog";
import SlidingTabs, { slidingTabId, slidingTabPanelId } from "@/app/components/dashboard/ui/SlidingTabs";
import TrackDetailsDialog from "./TrackDetailsDialog";
import TrackMark from "./TrackMark";
import TrackResumeCard from "./TrackResumeCard";
import TrackStateChip from "./TrackStateChip";
import { roundDateLabel, trackState } from "./track-state";
import { BUTTON_ACCENT, BUTTON_OUTLINE, BUTTON_SOLID, FIELD_SHELL, ICON_BUTTON_PRESS, PANEL, RAISED_DARK } from "./prep-styles";

/** The hub's tabs, in order. Exported so a link can open one directly (`?tab=questions`, read by the hub's page). */
export const PREP_HUB_TABS = ["overview", "questions", "rounds", "sessions", "actions"] as const;
export type PrepHubTab = (typeof PREP_HUB_TABS)[number];
type Tab = PrepHubTab;

/** A round's outcome as a chip: green for a result worth having, red for the end, blue while it is live. */
const OUTCOME_TONE: Record<PrepRoundOutcome, ChipTone> = { waiting: "blue", passed: "green", offer: "green", rejected: "red" };

/**
 * A saved session's state as a chip, for the rows that have no score to show
 * yet. Locked wins over ready: the report exists but can't be opened until it
 * is paid for, which is the thing the user needs to act on.
 */
export function savedSessionChip(status: PrepSessionStatus, locked: boolean): { label: string; tone: ChipTone } {
  if (locked) return { label: "Locked", tone: "red" };
  switch (status) {
    case "open":
      return { label: "Recording", tone: "blue" };
    case "uploading":
      return { label: "Saving", tone: "blue" };
    case "queued":
    case "processing":
      return { label: "Analysing", tone: "blue" };
    case "delayed":
      return { label: "Delayed", tone: "white" };
    case "failed":
      return { label: "Failed", tone: "red" };
    case "deleting":
      return { label: "Deleting", tone: "white" };
    default:
      return { label: "Ready", tone: "green" };
  }
}

const MODE_LABEL: Record<PrepSessionMode, string> = { voice: "Voice interview", text: "Typed interview" };

/**
 * One line of the track's history. The track's own list (from the service) and
 * the scored sessions PrepProvider merged into the track read differently, so
 * both are reduced to what a row shows before they are listed together,
 * newest first.
 */
interface HistoryRow {
  id: string;
  /** ISO. When it finished, or when it started if it hasn't. */
  at: string;
  title: string;
  length: string;
  /** Null when there is no score to show (too little evidence, or not graded yet). */
  score: number | null;
  /** The score is provisional: the session was too short to charge. Shown labelled, as the report shows it. */
  provisional: boolean;
  status: PrepSessionStatus | null;
  locked: boolean;
  cost: string | null;
}

/** What the session cost, once that is settled; nothing while it isn't. */
function costLabel(credits: number | null, state: BillingState | null): string | null {
  if (state === "not-charged") return "No charge";
  if ((state === "charged" || state === "unbilled") && credits !== null) return `${credits} ${credits === 1 ? "credit" : "credits"}`;
  return null;
}

/** `scoreDisplayOf`, for a row: the score it shows, and whether it is provisional. The report reads the same. */
function rowScore(session: Parameters<typeof scoreDisplayOf>[0]): Pick<HistoryRow, "score" | "provisional"> {
  const shown = scoreDisplayOf(session);
  return shown.kind === "unscored" ? { score: null, provisional: false } : { score: shown.score, provisional: shown.kind === "provisional" };
}

function savedRow(summary: PrepSessionSummary): HistoryRow {
  return {
    id: summary.id,
    at: summary.completedAt ?? summary.createdAt,
    title: MODE_LABEL[summary.mode],
    length: summary.durationMs !== null ? formatDuration(summary.durationMs) : `${summary.lengthMinutes} min`,
    ...rowScore(summary),
    status: summary.status,
    locked: summary.locked,
    cost: costLabel(summary.billing.credits, summary.billing.state),
  };
}

/** A scored session PrepProvider merged into the track before this track's own list arrived. */
function mergedRow(session: PrepSession): HistoryRow {
  return {
    id: session.id,
    at: session.completedAt,
    title: session.formats.length === 0 && session.mode ? MODE_LABEL[session.mode] : formatsLabel(session.formats),
    length: session.delivery ? formatDuration(session.delivery.durationMs) : `${session.lengthMinutes} min`,
    ...rowScore(session),
    status: session.status ?? null,
    locked: session.locked ?? false,
    cost: session.billing ? costLabel(session.billing.credits, session.billing.state) : null,
  };
}

const timeOf = (iso: string) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
};

/** Graded and readable: the row shows a score. */
const isScored = (row: HistoryRow) => (row.status === null || row.status === "ready") && !row.locked;

const roundWhen = (round: PrepRound): string =>
  round.scheduledAt ? formatDate(new Date(round.scheduledAt), "EEE d MMM, HH:mm") : "Not booked yet";

export interface PrepHubProps {
  track: PrepTrack;
  now: Date;
  /** The tab to open on, from the page's `?tab=`; the Overview otherwise. */
  initialTab?: PrepHubTab;
  onBack: () => void;
  onStartSession: (formats?: SessionFormat[]) => void;
  onViewReport: (sessionId: string) => void;
  onToggleAction: (actionId: string) => void;
  /** Resolves with the plan's answer: a full plan is a rejection inside it, not a throw. */
  onAddAction: (title: string) => Promise<AddTasksResult>;
  onSetOutcome: (roundId: string, outcome: PrepRoundOutcome | null) => Promise<void>;
  onSaveRounds: (rounds: PrepRoundInput[], changed?: { index: number; outcome: PrepRoundOutcome | null }) => Promise<void>;
  onUpdateTrack: (input: UpdatePrepTrackInput) => Promise<void>;
  onDeleteTrack: () => Promise<void>;
}

/** Which round the dialog is open on: an existing one by position, or a new one at the end. */
type RoundEditor = { index: number } | null;

const PrepHub: FC<PrepHubProps> = ({
  track,
  now,
  initialTab,
  onBack,
  onStartSession,
  onViewReport,
  onToggleAction,
  onAddAction,
  onSetOutcome,
  onSaveRounds,
  onUpdateTrack,
  onDeleteTrack,
}) => {
  const [tab, setTab] = useState<Tab>(initialTab ?? "overview");
  // The bar swaps panels in place, so it is marked up as tabs: each panel below names the tab that shows it.
  const tabsId = useId();
  const panel = (id: Tab) => ({ role: "tabpanel", id: slidingTabPanelId(tabsId, id), "aria-labelledby": slidingTabId(tabsId, id) }) as const;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [roundEditor, setRoundEditor] = useState<RoundEditor>(null);
  const [outcomeBusy, setOutcomeBusy] = useState<PrepRoundOutcome | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const saved = track.saved;
  const rounds = saved ? saved.rounds : [];
  const round = currentRound(rounds);
  const roundIndex = rounds.length - 1;

  const score = computePreparedness(track);
  const doneActions = track.actions.filter((a) => a.done).length;
  const roundPassed = Boolean(round?.scheduledAt && new Date(round.scheduledAt) < now);
  // A round that has happened with nothing recorded, or one still waiting to hear: ask how it went.
  const askOutcome = round !== null && (round.outcome === "waiting" || (round.outcome === null && roundPassed));
  const askNextRound = round?.outcome === "passed";

  const questions = useLikelyQuestions(saved ? track.id : null);
  const questionCount = questions.data?.set?.questions.length ?? 0;

  // Every session on this track, newest first. The track's own `sessions`
  // holds only scored ones (the preparedness score averages them), so the
  // sessions still being analysed, failed or locked come from this track's
  // list.
  const { data: savedList } = usePrepSessions({ trackId: track.id });
  const savedSessions = (savedList?.sessions ?? []).filter((s) => s.status !== "deleting" && sessionBelongsTo(track, s));
  const savedIds = new Set(savedSessions.map((s) => s.id));
  const history = [...savedSessions.map(savedRow), ...track.sessions.filter((s) => !savedIds.has(s.serverId ?? s.id)).map(mergedRow)].sort(
    (a, b) => timeOf(b.at) - timeOf(a.at),
  );
  const lastSession = history[0];

  const state = trackState(track, now);
  const dateLabel = roundDateLabel(track);
  const place = [track.roundLabel + (dateLabel ? ` · ${dateLabel}` : ""), track.location].filter(Boolean).join(" · ");

  async function recordOutcome(outcome: PrepRoundOutcome) {
    if (!round || outcomeBusy) return;
    setOutcomeBusy(outcome);
    setOutcomeError(null);
    try {
      await onSetOutcome(round.id, outcome);
    } catch (error) {
      setOutcomeError(apiMessage(error));
    } finally {
      setOutcomeBusy(null);
    }
  }

  /** The rounds with one saved from the dialog: replaced in place, or added at the end. */
  async function saveRound(index: number, draft: RoundDraft) {
    const inputs = roundInputs(rounds);
    const existing = rounds[index];
    // The id as `roundInputs` sends it: an optimistic stand-in goes up as a new round.
    const next: PrepRoundInput = { id: inputs[index]?.id ?? null, ...draft };
    if (existing) inputs[index] = next;
    else inputs.push(next);
    const outcomeChanged = (existing?.outcome ?? null) !== draft.outcome;
    await onSaveRounds(inputs, outcomeChanged ? { index, outcome: draft.outcome } : undefined);
  }

  async function removeRound(index: number) {
    await onSaveRounds(roundInputs(rounds.filter((_, i) => i !== index)));
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "questions", label: "Questions", count: questionCount },
    { id: "rounds", label: "Rounds", count: rounds.length },
    { id: "sessions", label: "Sessions", count: history.length },
    { id: "actions", label: "Actions", count: track.actions.length },
  ];

  const editing = roundEditor && saved ? roundEditor : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-primary cursor-pointer w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          All interviews
        </button>
      </div>

      {/* The one raised surface on this screen: who you're prepping for, how
          ready you are, and the single action that changes that. Identity on
          one line, state as a chip, score as a plain number — a ring reading
          "0" in 8px type was the least legible part of this page. */}
      <div className={cn(RAISED_DARK, "px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-4")}>
        <TrackMark mark={track.companyMark} logo={track.companyLogo} surface="hub" />

        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2">
            <h2 className="text-[19px] font-bold leading-tight">
              {track.company} — {track.role}
            </h2>
            {saved && (
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                aria-label="Edit this track's details"
                className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md text-white/45 hover:text-white hover:bg-white/10 cursor-pointer transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2.5">
            <TrackStateChip state={state} onDark />
            <span className="text-xs text-white/45">{place}</span>
          </div>
        </div>

        <div className="flex-none flex items-center gap-6">
          <ScoreRing
            value={score}
            size={78}
            tone="dark"
            label={
              <span className="text-center leading-none">
                <span className="block text-[19px] font-bold tabular-nums">
                  {score}
                  <span className="text-[12px]">%</span>
                </span>
                <span className="block text-[8.5px] font-bold uppercase tracking-[0.09em] text-white/40 mt-1">Prepared</span>
              </span>
            }
          />
          <button type="button" onClick={() => onStartSession()} className={BUTTON_ACCENT}>
            <Mic className="h-3.5 w-3.5" />
            Start a session
          </button>
        </div>
      </div>

      {askOutcome && round && (
        <div className={cn(PANEL, "p-4 flex items-center gap-4 flex-wrap")}>
          <span className="text-sm font-bold text-primary flex-1 min-w-[200px]">
            {round.outcome === "waiting"
              ? `Heard back about ${roundName(round, roundIndex).toLowerCase()}?`
              : `${roundName(round, roundIndex)} has passed. How did it go?`}
            {saved?.applicationId && <span className="block text-xs font-medium text-black/45 mt-0.5">Your tracker moves with it.</span>}
          </span>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => void recordOutcome("offer")} disabled={outcomeBusy !== null} className={BUTTON_ACCENT}>
              {outcomeBusy === "offer" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Got an offer
            </button>
            <button type="button" onClick={() => void recordOutcome("passed")} disabled={outcomeBusy !== null} className={BUTTON_OUTLINE}>
              {outcomeBusy === "passed" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Moved forward
            </button>
            <button type="button" onClick={() => void recordOutcome("rejected")} disabled={outcomeBusy !== null} className={BUTTON_OUTLINE}>
              {outcomeBusy === "rejected" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Didn&apos;t move forward
            </button>
            {round.outcome !== "waiting" && (
              <button
                type="button"
                onClick={() => void recordOutcome("waiting")}
                disabled={outcomeBusy !== null}
                className={BUTTON_OUTLINE}>
                {outcomeBusy === "waiting" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Still waiting
              </button>
            )}
          </div>
          {outcomeError && (
            <p role="alert" className="basis-full text-xs font-semibold text-red-700">
              {outcomeError}
            </p>
          )}
        </div>
      )}

      {askNextRound && (
        <div className={cn(PANEL, "p-4 flex items-center gap-4 flex-wrap")}>
          <span className="text-sm font-bold text-primary flex-1 min-w-[200px]">
            You moved forward. Add the next round once it&apos;s booked.
          </span>
          <button type="button" onClick={() => setRoundEditor({ index: rounds.length })} className={BUTTON_SOLID}>
            <Plus className="h-3.5 w-3.5" />
            Add the next round
          </button>
        </div>
      )}

      <SlidingTabs value={tab} options={TABS} onChange={setTab} tablist={{ id: tabsId, label: "Track sections" }} />

      {tab === "overview" && (
        <div {...panel("overview")} className="flex flex-wrap gap-5 items-start">
          <div className="flex-1 min-w-0 basis-[560px] flex flex-col gap-5">
            <div className={cn(PANEL, "overflow-hidden")}>
              <div className="px-5 py-3.5 border-b border-black/10">
                <span className="text-sm font-bold text-primary">Questions they&apos;re likely to ask</span>
              </div>
              <LikelyQuestions
                track={track}
                variant="preview"
                onPractise={(format) => onStartSession([format])}
                onAddPosting={() => setDetailsOpen(true)}
                onSeeAll={() => setTab("questions")}
              />
            </div>

            <div className={cn(PANEL, "p-5")}>
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <p className="text-sm font-bold text-primary">This round</p>
                {round && (
                  <button
                    type="button"
                    onClick={() => setRoundEditor({ index: roundIndex })}
                    className="text-xs font-bold text-black/50 hover:text-primary cursor-pointer">
                    Edit round
                  </button>
                )}
              </div>
              {!round ? (
                <PrepEmptyState
                  bare
                  icon={CalendarDays}
                  title="No rounds yet"
                  body="Add the first conversation once it's booked — a recruiter screen, a portfolio review — and when it is."
                  ctaLabel={saved ? "Add the first round" : undefined}
                  onCta={saved ? () => setRoundEditor({ index: 0 }) : undefined}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-bold text-primary">{roundName(round, roundIndex)}</span>
                    {round.outcome && <Chip tone={OUTCOME_TONE[round.outcome]}>{ROUND_OUTCOME_LABELS[round.outcome]}</Chip>}
                  </div>
                  <p className="text-xs text-black/50">{roundWhen(round)}</p>
                  {round.notes ? (
                    <p className="text-sm text-black/65 leading-relaxed whitespace-pre-line">{round.notes}</p>
                  ) : (
                    <p className="text-xs text-black/40">No notes yet — who you&apos;re meeting, what they asked you to prepare.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 basis-[300px] flex flex-col gap-5">
            {track.actions.length === 0 ? null : (
              <div className={cn(PANEL, "p-5")}>
                <div className="flex items-baseline justify-between gap-3 mb-3.5">
                  <p className="text-sm font-bold text-primary">Next actions</p>
                  <span className="text-xs text-black/45 tabular-nums">
                    {doneActions}/{track.actions.length}
                  </span>
                </div>

                <>
                  <div className="flex flex-col gap-3">
                    {track.actions
                      .filter((a) => !a.done)
                      .slice(0, 3)
                      .map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className="group flex gap-2.5 items-start text-left cursor-pointer"
                          onClick={() => onToggleAction(a.id)}>
                          <NeoCheckbox checked={a.done} size="sm" />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-primary">{a.title}</span>
                            <span className="block text-xs text-black/45">{a.source}</span>
                          </span>
                        </button>
                      ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("actions")}
                    className="text-xs font-bold text-black/50 hover:text-primary cursor-pointer mt-4">
                    See all actions →
                  </button>
                </>
              </div>
            )}

            {/* The resume this job was sent: what its likely questions are
                written from, and what a session needs before it starts. */}
            {saved && <TrackResumeCard track={saved} />}

            {!lastSession ? (
              <div className={cn(PANEL, "p-5")}>
                <p className="text-sm font-bold text-primary mb-1">No sessions yet</p>
                <p className="text-sm text-black/50 leading-relaxed mb-4">
                  Your score stays at 0 until you run one. Six minutes gives you a scorecard and a first checklist.
                </p>
                <button type="button" onClick={() => onStartSession()} className={BUTTON_SOLID}>
                  Run the first session
                </button>
              </div>
            ) : (
              <div className={cn(PANEL, "p-5")}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <p className="text-sm font-bold text-primary">Last session</p>
                  <span className="text-xs text-black/45">{lastSession.title}</span>
                </div>
                <p className="text-xs text-black/45 mb-4">
                  {formatDate(new Date(lastSession.at), "EEE d MMM")} ·{" "}
                  {lastSession.status !== null && !isScored(lastSession)
                    ? savedSessionChip(lastSession.status, lastSession.locked).label.toLowerCase()
                    : lastSession.score === null
                      ? "not scored"
                      : lastSession.provisional
                        ? `${lastSession.score}/100 · provisional`
                        : `${lastSession.score}/100`}
                </p>
                <button type="button" onClick={() => onViewReport(lastSession.id)} className={BUTTON_OUTLINE}>
                  View full report
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "questions" && (
        <div {...panel("questions")} className={cn(PANEL, "overflow-hidden")}>
          <LikelyQuestions
            track={track}
            variant="full"
            onPractise={(format) => onStartSession([format])}
            onAddPosting={() => setDetailsOpen(true)}
          />
        </div>
      )}

      {tab === "rounds" && (
        <div {...panel("rounds")} className={cn(PANEL, "overflow-hidden")}>
          {rounds.length === 0 ? (
            <PrepEmptyState
              bare
              icon={CalendarDays}
              title="No rounds yet"
              body="Each round of the loop goes here: what kind of conversation, when, and how it went."
              ctaLabel={saved ? "Add the first round" : undefined}
              onCta={saved ? () => setRoundEditor({ index: 0 }) : undefined}
            />
          ) : (
            <>
              {rounds.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoundEditor({ index: i })}
                  className="w-full flex items-start gap-4 px-5 py-3.5 border-b border-black/10 text-left cursor-pointer hover:bg-[#fbfbf7] transition-colors">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-primary">{roundName(r, i)}</span>
                    <span className="block text-xs text-black/45 mt-0.5">{roundWhen(r)}</span>
                    {r.notes && <span className="block text-xs text-black/55 mt-1 line-clamp-2">{r.notes}</span>}
                  </span>
                  {r.outcome ? (
                    <Chip tone={OUTCOME_TONE[r.outcome]}>{ROUND_OUTCOME_LABELS[r.outcome]}</Chip>
                  ) : (
                    <Chip tone="white">{ROUND_TYPE_LABELS[r.type]}</Chip>
                  )}
                  <ChevronRight className="h-4 w-4 flex-none text-black/30 mt-0.5" />
                </button>
              ))}
              <div className="px-5 py-3">
                <button type="button" onClick={() => setRoundEditor({ index: rounds.length })} className={BUTTON_OUTLINE}>
                  <Plus className="h-3.5 w-3.5" />
                  Add a round
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "sessions" && (
        <div {...panel("sessions")} className={cn(PANEL, "overflow-hidden")}>
          {history.length === 0 ? (
            <PrepEmptyState
              bare
              icon={Mic}
              title="No sessions yet"
              body="Run a mock interview to start building history here."
              ctaLabel="Start a session"
              onCta={() => onStartSession()}
            />
          ) : (
            history.map((s) => {
              const chip = s.status !== null && !isScored(s) ? savedSessionChip(s.status, s.locked) : null;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-4 px-5 py-3.5 border-b border-black/10 last:border-b-0 hover:bg-[#fbfbf7] transition-colors">
                  <button type="button" onClick={() => onViewReport(s.id)} className="min-w-0 flex-1 text-left cursor-pointer">
                    <span className="block text-sm font-bold text-primary">{s.title}</span>
                    <span className="block text-xs text-black/45">
                      {formatDate(new Date(s.at), "EEE d MMM")} · {s.length}
                      {s.cost && ` · ${s.cost}`}
                      {s.provisional && " · provisional score"}
                    </span>
                  </button>
                  {chip ? (
                    <Chip tone={chip.tone}>{chip.label}</Chip>
                  ) : (
                    <ScoreRing
                      value={s.score ?? 0}
                      size={34}
                      label={<span className="text-[10.5px] font-bold text-primary tabular-nums">{s.score ?? "—"}</span>}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onViewReport(s.id)}
                    aria-label="View this session's report"
                    className={ICON_BUTTON_PRESS}>
                    <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "actions" && (
        <div {...panel("actions")} className={cn(PANEL, "p-5 flex flex-col gap-4")}>
          {saved && <AddActionField onAdd={onAddAction} />}
          {track.actions.length === 0 ? (
            <PrepEmptyState
              bare
              icon={ListChecks}
              title="Nothing queued yet"
              body="A session's report puts its actions here and on your plan. Add your own above."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {track.actions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="group flex gap-3 items-start text-left cursor-pointer"
                  onClick={() => onToggleAction(a.id)}>
                  <NeoCheckbox checked={a.done} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-semibold", a.done ? "text-black/40 line-through" : "text-primary")}>
                      {a.title}
                    </span>
                    {a.detail && <span className="block text-xs text-black/45 mt-0.5">{a.detail}</span>}
                    <span className="block text-[11px] text-black/35 mt-1">{a.source}</span>
                  </span>
                  {a.effortMinutes > 0 && (
                    <span className="flex-none text-[11px] font-bold text-black/45 tabular-nums">{a.effortMinutes} min</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {track.status === "closed" && (
        <p className="text-xs text-black/40 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          This track is closed
          {track.outcome === "rejected" ? " — didn't move forward." : track.outcome === "offer" ? " — with an offer." : "."}
        </p>
      )}

      {saved && (
        <TrackDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          track={saved}
          onSave={onUpdateTrack}
          onDelete={onDeleteTrack}
        />
      )}

      {editing && (
        <RoundDialog
          // Keyed on the round, so reopening always starts from what is saved.
          key={rounds[editing.index]?.id ?? `new-${editing.index}`}
          open
          onOpenChange={(open) => !open && setRoundEditor(null)}
          round={rounds[editing.index] ?? null}
          position={editing.index + 1}
          onSave={(draft) => saveRound(editing.index, draft)}
          onDelete={rounds[editing.index] ? () => removeRound(editing.index) : undefined}
        />
      )}
    </div>
  );
};

/** An action of the user's own for this track. It lands on this month's plan too, as a prep task. */
const AddActionField: FC<{ onAdd: (title: string) => Promise<AddTasksResult> }> = ({ onAdd }) => {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = title.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onAdd(text);
      const refusal = result.rejected[0];
      if (refusal) setError(refusal.message);
      else setTitle("");
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className={cn(FIELD_SHELL, "flex-1 min-w-0")}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TASK_LIMITS.titleMax}
            placeholder="Add an action — it goes on your plan too"
            aria-label="New action for this track"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold text-primary placeholder:text-black/35 placeholder:font-medium"
          />
        </span>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className={cn(BUTTON_SOLID, "disabled:opacity-40 disabled:pointer-events-none")}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </form>
  );
};

export default PrepHub;
