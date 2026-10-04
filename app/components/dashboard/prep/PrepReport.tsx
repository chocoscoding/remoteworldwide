"use client";

import { FC, useEffect, useId, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import SlidingTabs, { slidingTabId, slidingTabPanelId } from "@/app/components/dashboard/ui/SlidingTabs";
import { formatsLabel } from "@/app/lib/dashboard/prep-data";
import type { DimensionScore, LanguageStat, PrepSession, PrepTrack, TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import type { PracticeQuestion } from "@/app/lib/prep/practice";
import { qk } from "@/app/lib/query/keys";
import { withoutAudioTags } from "@/app/lib/voice/audioTags";
import { scoreDisplayOf } from "@/app/lib/voice/mapSession";
import type { UnscoredDimension } from "@/app/lib/voice/types";
import EvidenceDialog from "./EvidenceDialog";
import SummaryLines from "./delivery/SummaryLines";
import type { SessionQuestionRef } from "./report/answerNotes";
import DeliveryTab from "./report/DeliveryTab";
import FixChecklist from "./report/FixChecklist";
import PositioningPanel from "./report/PositioningPanel";
import QuestionByQuestion from "./report/QuestionByQuestion";
import { deliverySummary, formatScore } from "./report/reportScales";
import ScoreRing from "./report/ScoreRing";
import Scorecard from "./report/Scorecard";
import type { SectionsPoll } from "./report/SectionStates";
import { evidenceSummary, isLegacyTooShort, scoreExplanation, scoreHeadline } from "./report/scoreCopy";

/**
 * One session's report, as the AI service graded it, in tabs. The page wires
 * the parts that talk to the service (the player, the transcript, deleting,
 * starting a practice session) in as slots and callbacks, and keeps the open
 * tab in the address, so this component stays free of fetching and routing.
 * Every timestamp chip here plays only when the page wraps the report in a
 * PlaybackProvider, which it does for a recorded session alone.
 *
 * Nothing here is scored in the browser, and there is no sample report to
 * stand in for a thin one: a session too short to grade says so. Whether the
 * score shows, and whether it is provisional, is mapSession's
 * `scoreDisplayOf`, which the hub reads too, so the two always agree. And
 * nothing goes on the plan by itself: "Add all to my plan" on Overall is the
 * only way the report's actions get there.
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
   * The header's right half: the recording player. Outside every tab because
   * every tab plays from it: its <audio> has to stay mounted whichever one is
   * open. Without it (a typed session, or a recording not ready to play) the
   * header is the score alone.
   */
  player?: ReactNode;
  /** The round the session was for, as it was when the session ran; the track's current one by default. */
  roundLabel?: string;
  /** The questions the session set out to ask, in order: what "not reached" and practising are about. */
  questions?: readonly SessionQuestionRef[];
  /** Starts a practice session on exactly these questions. Without it, no practice button shows. */
  onPractise?: (questions: PracticeQuestion[]) => void;
  /** The report transcript has no word timings, so the Delivery tab says what it could not measure. */
  noWordTimings?: boolean;
  /** The Transcript tab's transcript, e.g. one that follows the recording; without it, the turns as text. */
  transcript?: ReactNode;
  /** Under the transcript, on its tab, when the transcript doesn't carry it itself. */
  transcriptFooter?: ReactNode;
  /** On Overall, at the foot of the right-hand column: deleting the session. */
  deleteAction?: ReactNode;
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
export const REPORT_TABS = [
  { id: "overall", label: "Overall" },
  { id: "transcript", label: "Transcript" },
  // How it was said: the measured delivery, and grammar and word choice,
  // which had a tab of their own ("Diction and Grammar") until 2026-10-04.
  { id: "delivery", label: "Delivery" },
  // How the answers position you for the role, criterion by criterion.
  { id: "positioning", label: "Positioning" },
] as const;

export type ReportTab = (typeof REPORT_TABS)[number]["id"];

/** The tab a report opens on, and what an unknown `?tab=` shows. */
export const DEFAULT_REPORT_TAB: ReportTab = "overall";

/** Tabs that were folded into another, so an old link still lands on what it pointed to. */
const RENAMED_TABS: Readonly<Record<string, ReportTab>> = { diction: "delivery" };

/** A `?tab=` value as a tab; anything that isn't one is the default. */
export function parseReportTab(value: string | null | undefined): ReportTab {
  if (value && RENAMED_TABS[value]) return RENAMED_TABS[value];
  return REPORT_TABS.find((t) => t.id === value)?.id ?? DEFAULT_REPORT_TAB;
}

/** What the evidence dialog is open on: a score, a dimension too thin to judge, or a counted stat. */
type Detail =
  | { kind: "dimension"; dimension: DimensionScore }
  | { kind: "unscored"; dimension: UnscoredDimension }
  | { kind: "stat"; stat: LanguageStat };

const NOTHING_FLAGGED = "Nothing flagged here. This one held up across your answers.";

const NO_QUESTIONS: readonly SessionQuestionRef[] = [];

/** A track with no round yet says so in its label ("Not scheduled yet"), which says nothing about this session. */
const UNSCHEDULED = /^not scheduled/i;

const PrepReport: FC<PrepReportProps> = ({
  track,
  session,
  onBack,
  onRunAnother,
  tab,
  onTabChange,
  player,
  roundLabel,
  questions = NO_QUESTIONS,
  onPractise,
  noWordTimings = false,
  transcript,
  transcriptFooter,
  deleteAction,
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

  // Which score or stat is opened up, if any.
  const [detail, setDetail] = useState<Detail | null>(null);

  // Leaving the report sends the track's checklist for a fresh read: "Add all
  // to my plan" here may have put this report's actions on it.
  useEffect(() => () => void queryClient.invalidateQueries({ queryKey: qk.prep.tracks() }), [queryClient]);

  // Since last time, only between two full scores: a provisional one is a
  // first read, not a verdict to measure progress against.
  const priorSessions = track.sessions.filter((s) => s.completedAt < session.completedAt);
  const prior = priorSessions[priorSessions.length - 1];
  const priorDisplay = prior ? scoreDisplayOf(prior) : null;
  const delta = display.kind === "scored" && priorDisplay?.kind === "scored" ? display.score - priorDisplay.score : null;

  // The header's two lines, and why a score is missing.
  const round = roundLabel ?? track.roundLabel;
  const title = [formatsLabel(session.formats), UNSCHEDULED.test(round) ? "" : round].filter((part) => part.trim() !== "").join(" · ");
  const subtitle =
    [scoreHeadline(display, session), delta !== null ? `${delta >= 0 ? "+" : "−"}${Math.abs(delta)} since your last session` : null]
      .filter((part): part is string => Boolean(part))
      .join(" · ") || `${session.lengthMinutes} min session`;
  const explanation = scoreExplanation(display, session);
  const restsOn = legacyTooShort ? null : evidenceSummary(session.scoreEvidence);
  const backLabel = [track.role, track.company].filter((part) => part.trim() !== "").join(" at ");

  const hasSummary = (session.summary?.length ?? 0) > 0 || session.coachNote.trim() !== "";
  const deliveryLine = session.delivery && !noWordTimings ? deliverySummary(session.delivery.metrics) : null;
  // The counted stats are the rubric's: a report from before the evidence
  // gates graded a too-short session at the floors, so it shows none.
  const wordStats = legacyTooShort ? [] : session.languageStats;

  // Every tab's panel. Positioning and Delivery always show: when a session
  // has no analysis for them, saying so (not analysed, still analysing,
  // unavailable, a typed session) is the content. Only the open one is
  // mounted, which is why the player sits outside them.
  const panels: Record<ReportTab, ReactNode> = {
    overall: (
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
          {explanation && (
            <section className="rounded-[14px] border-2 border-dashed border-black/20 bg-white px-5 py-4">
              <h2 className="text-[15px] font-bold text-[#222325]">{legacyTooShort ? "Too short to score" : "Not enough to score"}</h2>
              <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-black/60">
                {explanation}
                {legacyTooShort && " The transcript is kept either way."}
              </p>
              {restsOn && (
                <p className="mt-2 text-xs leading-relaxed text-black/55">
                  <span className="font-bold text-black/65">What it rests on: </span>
                  {restsOn}
                </p>
              )}
              <div className="mt-3.5 flex flex-wrap gap-2.5">
                <button type="button" onClick={onRunAnother} className="w-fit cursor-pointer rounded-lg bg-[#222325] px-3.5 py-2.5 text-xs font-bold text-white">
                  Run a longer session
                </button>
                <button
                  type="button"
                  onClick={() => openTab("transcript")}
                  className="cursor-pointer rounded-lg border-[1.5px] border-black/[0.16] px-3.5 py-2.5 text-xs font-semibold hover:border-black/40">
                  Read the transcript
                </button>
              </div>
            </section>
          )}

          {!legacyTooShort && (
            <Scorecard
              dimensions={session.dimensions}
              unscored={unscoredDimensions}
              provisional={display.kind === "provisional"}
              onOpen={(pick) => setDetail(pick)}
            />
          )}

          <QuestionByQuestion
            turns={session.transcript}
            questions={questions}
            dimensions={legacyTooShort ? [] : session.dimensions}
            rewrites={session.rewrites}
            onPractise={onPractise}
          />

          {hasSummary &&
            // A saved report writes its note a line at a time, each tied to a
            // moment in the recording; the joined note is the fallback.
            (session.summary && session.summary.length > 0 ? (
              <SummaryLines lines={session.summary} title="Coach note" tone="light" className="rounded-[14px] border-black/[0.16] p-4" />
            ) : (
              <section aria-label="Coach note" className="rounded-[14px] border border-black/[0.16] bg-white p-4">
                <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-black/45">Coach note</h2>
                <p className="text-sm leading-relaxed text-black/65">{session.coachNote}</p>
              </section>
            ))}
        </div>

        <aside aria-label="Before your next round" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
          {!legacyTooShort && <FixChecklist session={session} track={track} />}
          {deliveryLine && (
            <button
              type="button"
              onClick={() => openTab("delivery")}
              className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] bg-white px-4 py-3 text-left br-plain-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] font-extrabold text-[#222325]">How you delivered it</span>
                <span className="text-xs text-[#5f6062]">{deliveryLine}</span>
              </span>
              <ArrowRight aria-hidden className="h-4 w-4 flex-none text-[#222325]" />
              <span className="sr-only">Open the Delivery tab</span>
            </button>
          )}
          {deleteAction}
        </aside>
      </div>
    ),

    transcript: (
      <>
        {transcript ?? <TurnsTranscript turns={session.transcript} />}
        {transcriptFooter}
      </>
    ),

    delivery: (
      <DeliveryTab
        session={session}
        questions={questions}
        languageStats={wordStats}
        noWordTimings={noWordTimings}
        poll={sectionsPoll}
        onOpenStat={(stat) => setDetail({ kind: "stat", stat })}
      />
    ),

    positioning: <PositioningPanel section={session.positioning} turns={session.transcript} poll={sectionsPoll} onPractise={onPractise} />,
  };

  // A tab asked for but left out (a null panel) shows Overall.
  const tabs = REPORT_TABS.filter((t) => panels[t.id] !== null).map((t) => ({ ...t, className: TAB_CLASS, activeClassName: TAB_CLASS }));
  const shown = tabs.some((t) => t.id === tab) ? tab : DEFAULT_REPORT_TAB;

  return (
    <div className="mx-auto flex max-w-[1096px] flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded text-[13px] font-bold text-[#44453f] hover:text-[#222325] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]">
          <ArrowLeft aria-hidden className="h-[15px] w-[15px] flex-none" />
          <span className="truncate">{backLabel}</span>
        </button>
        <span aria-hidden className="flex-1" />
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 cursor-pointer items-center rounded-[9px] border border-black/30 bg-white px-3.5 text-[13px] font-bold text-[#222325] transition-colors hover:border-[#222325] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]">
          Back to prep
        </button>
        <button
          type="button"
          onClick={onRunAnother}
          className="inline-flex h-10 items-center rounded-[9px] bg-[#e1f073] px-4 text-[13px] font-extrabold text-[#222325] br-bold-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222325] focus-visible:ring-offset-2">
          Run another session
        </button>
      </div>

      {/* With a recording it sticks while the report scrolls, so the player
          is always in reach of the chip just pressed. On a phone the two
          halves stack, too tall to pin, so it scrolls away there. */}
      <section
        aria-label="Session"
        className={cn("flex flex-wrap items-stretch overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white", player && "md:sticky md:top-3 md:z-30")}>
        <div className="flex min-w-0 flex-[1_1_300px] items-center gap-3.5 px-5 py-3">
          <ScoreRing display={display} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-[15px] font-extrabold leading-snug text-[#222325]">{title}</h1>
            <p className="text-[13px] leading-snug text-[#5f6062]">{subtitle}</p>
          </div>
        </div>
        {player && <div className="flex min-w-0 flex-[1_1_380px] [&>*]:flex-1">{player}</div>}
      </section>

      <SlidingTabs value={shown} options={tabs} onChange={onTabChange} tablist={{ id: tabsId, label: "Report sections" }} className="border-[1.5px] shadow-none" />

      {/* Keyed by tab, so each one opens fresh, as a page of its own would. */}
      <div
        key={shown}
        role="tabpanel"
        id={slidingTabPanelId(tabsId, shown)}
        aria-labelledby={slidingTabId(tabsId, shown)}
        tabIndex={0}
        className="flex flex-col gap-3.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f6f6f6]">
        {panels[shown]}
      </div>

      {detail && (
        <EvidenceDialog
          open
          onOpenChange={(v) => !v && setDetail(null)}
          {...(detail.kind === "dimension"
            ? {
                title: detail.dimension.label,
                value: `${formatScore(detail.dimension.score)} / 10`,
                summary: detail.dimension.note,
                howToImprove: detail.dimension.howToImprove,
                evidence: detail.dimension.evidence,
                emptyNote: NOTHING_FLAGGED,
              }
            : detail.kind === "unscored"
              ? {
                  title: detail.dimension.label,
                  value: "Not enough to judge",
                  summary: detail.dimension.note,
                  howToImprove: detail.dimension.howToImprove,
                  evidence: [],
                  emptyNote: "Nothing to quote: this session didn't give enough to judge it.",
                }
              : {
                  title: detail.stat.label,
                  value: detail.stat.value,
                  summary: "",
                  howToImprove: detail.stat.howToImprove,
                  evidence: detail.stat.evidence,
                  emptyNote: NOTHING_FLAGGED,
                })}
        />
      )}
    </div>
  );
};

/** The mockup's tab size: taller and wider than the bar's default. */
const TAB_CLASS = "px-[18px] py-2.5 text-[13px]";

// ---------------------------------------------------------------------------
// Tab pieces
// ---------------------------------------------------------------------------

/** The turns as text, for a report without a transcript that follows the recording (a typed session). */
const TurnsTranscript: FC<{ turns: readonly TranscriptTurn[] }> = ({ turns }) => {
  const questions = turns.filter((t) => t.who === "ai").length;
  return (
    <section aria-label="Transcript" className="flex flex-col gap-3.5 rounded-[14px] border border-black/[0.16] bg-white p-5">
      <h2 className="text-[15px] font-extrabold text-[#222325]">
        Transcript · {questions} {questions === 1 ? "question" : "questions"}
      </h2>
      {turns.map((t) => (
        <div key={t.id}>
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-black/45">{t.who === "user" ? "You" : "Interviewer"}</p>
          {/* An interviewer line never shows an audio tag: how it was voiced, not what was asked. The answer is the candidate's own. */}
          <p className={cn("text-sm leading-relaxed", t.who === "user" ? "text-[#222325]" : "text-black/60")}>{t.who === "user" ? t.text : withoutAudioTags(t.text)}</p>
        </div>
      ))}
    </section>
  );
};

export default PrepReport;
