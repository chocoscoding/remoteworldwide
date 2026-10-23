"use client";

// The resume step's score and fixes in one card (owner's design, 2026-10-19, "AI apply resume
// step"): the ring and where the score stands, the two stages with a bar per check, what the last
// change did (with the points stuffing took off), then the Missing / Working tabs and what to do
// next. Everything here is drawn from props; ResumeStep decides what the buttons do.

import { Fragment, useLayoutEffect, useRef, useState, type FC, type ReactNode } from "react";
import { AlertCircle, ArrowDown, ArrowRight, ArrowUp, Check, Crosshair, Eye, Hash, Loader2, MoreHorizontal, Plus, RotateCw, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { METRIC_GROUPS, fixFirstId, scoreColorOf, type WorkingItem } from "@/app/lib/apply/fixes";
import type { ScoreDrop } from "@/app/lib/apply/score-changes";
import { capAsks } from "@/app/lib/apply/ask-cap";
import type { ScanReport } from "@/app/lib/ats/types";
import { displayedScore } from "@/app/lib/ats/score";
import type { ResumePlace } from "@/app/lib/resume/ai";

// ---- The score ------------------------------------------------------------------------------

export type ScoreState =
  | { kind: "none" }
  | { kind: "scoring" }
  | { kind: "ready" }
  | { kind: "stale" }
  /**
   * The scan ran on a reduced path (semantic matching down, say) and could not check most of the
   * posting (owner, 2026-10-19: "73 instead of 89"). Said as it is, with Rescore; never kept as a
   * step's score.
   */
  | { kind: "partial"; checked: number; total: number; recovering?: boolean }
  | { kind: "failed"; message: string; retryable: boolean; credits: boolean };

const C = 94.2;
const arc = (score: number) => ((Math.max(0, Math.min(100, score)) / 100) * C).toFixed(1);

/** The ring: a gain shows bright over the old score, a loss leaves the old score faint behind. */
const Ring: FC<{ score: number | null; previous: number | null; state: ScoreState["kind"] }> = ({ score, previous, state }) => {
  if (state === "scoring") {
    return (
      <span className="h-[88px] w-[88px] flex-none">
        {/* Filled in grey from 0, slowing as it nears the top, never spinning (owner, 2026-10-20). */}
        <svg width="88" height="88" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r="15" fill="none" stroke="#ecece6" strokeWidth="3.2" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="#b9bab4" strokeWidth="3.2" strokeLinecap="round" className="ats-ring-fill" transform="rotate(-90 18 18)" />
        </svg>
      </span>
    );
  }
  if (score === null) {
    return (
      <span className="grid h-[88px] w-[88px] flex-none place-content-center rounded-full border-[6px] border-dashed border-[#e4e4dd] text-[26px] font-extrabold text-[#b9bab4]">
        –
      </span>
    );
  }
  const color = scoreColorOf(score);
  const up = previous !== null && previous < score;
  const down = previous !== null && previous > score;
  return (
    <span
      className={cn("relative h-[88px] w-[88px] flex-none", (state === "stale" || state === "partial") && "opacity-45")}
      role="img"
      aria-label={`ATS score ${Math.round(score)} out of 100`}>
      <svg width="88" height="88" viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="#ecece6" strokeWidth="3.2" />
        {down && previous !== null && (
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke={color}
            strokeOpacity=".25"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeDasharray={`${arc(previous)} ${C}`}
            transform="rotate(-90 18 18)"
          />
        )}
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke={color}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray={`${arc(score)} ${C}`}
          transform="rotate(-90 18 18)"
        />
        {up && previous !== null && (
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="#ffffff"
            strokeOpacity=".55"
            strokeWidth="3.2"
            // Round like the score's arc, so its rounded start never shows through at the top as
            // a filled cap (owner, 2026-10-21).
            strokeLinecap="round"
            strokeDasharray={`${arc(previous)} ${C}`}
            transform="rotate(-90 18 18)"
          />
        )}
      </svg>
      <span className="absolute inset-0 grid place-content-center text-[28px] font-extrabold tracking-[-0.02em] text-primary">
        {Math.round(score)}
      </span>
    </span>
  );
};

const SMALL_BUTTON =
  "flex h-7 flex-none cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold text-primary";

/** The left of the score row: the ring, "ATS score" and where it stands. The job is in the page's header. */
const ScoreSide: FC<{
  state: ScoreState;
  score: number | null;
  previous: number | null;
  onRescore?: () => void;
  creditsHref: string;
}> = ({ state, score, previous, onRescore, creditsHref }) => {
  const shown = displayedScore(score, state.kind);
  const delta = state.kind === "ready" && shown !== null && previous !== null ? Math.round(shown) - Math.round(previous) : 0;
  return (
    <div className="flex min-w-0 flex-none items-center gap-4 lg:w-[280px]">
      <Ring score={shown} previous={state.kind === "ready" ? previous : null} state={state.kind} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-base font-extrabold text-primary">ATS score</span>
        {state.kind === "none" && <span className="text-xs text-[#5f6062]">Pick a resume above.</span>}
        {state.kind === "scoring" && <span className="text-xs font-bold text-[#55564f]">Scoring…</span>}
        {state.kind === "ready" && delta === 0 && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#6c7a1e]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#6c7a1e]" />
            Up to date
          </span>
        )}
        {state.kind === "ready" && delta > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#6c7a1e]">
            <ArrowUp className="h-3 w-3" strokeWidth={3} />
            Up {delta} since last change
          </span>
        )}
        {state.kind === "ready" && delta < 0 && (
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#b23c26]">
            <ArrowDown className="h-3 w-3" strokeWidth={3} />
            Down {-delta} since last change
          </span>
        )}
        {state.kind === "stale" && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#8a8b85]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#b9bab4]" />
            Edited since this score
          </span>
        )}
        {state.kind === "partial" && (
          <>
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#a06f00]">
              <AlertCircle className="h-3 w-3" strokeWidth={2.4} />
              {state.recovering ? "Finishing checks automatically" : "Partly checked"}
            </span>
            <span className="text-xs text-[#8a8b85]">
              {state.total > 0 && state.checked < state.total ? `${state.checked} of ${state.total} checked` : "Final match check incomplete"}
            </span>
          </>
        )}
        {state.kind === "failed" && (
          <>
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#b23c26]">
              <AlertCircle className="h-3 w-3" strokeWidth={2.4} />
              Couldn&apos;t score it
            </span>
            <span className="text-xs text-[#8a8b85]">{state.credits ? state.message : "Nothing was charged."}</span>
          </>
        )}
        {(state.kind === "stale" || (state.kind === "partial" && !state.recovering)) && onRescore && (
          <button
            type="button"
            onClick={onRescore}
            className={cn(SMALL_BUTTON, "br-plain br-lime mt-1 self-start border-[1.5px] !border-[#222325] bg-[#e1f073]")}>
            <RotateCw className="h-[13px] w-[13px]" strokeWidth={2.4} />
            Rescore
          </button>
        )}
        {state.kind === "failed" && state.retryable && onRescore && (
          <button type="button" onClick={onRescore} className={cn(SMALL_BUTTON, "mt-1 self-start border border-[#222325]/22 bg-white")}>
            <RotateCw className="h-[13px] w-[13px]" strokeWidth={2.4} />
            Try again
          </button>
        )}
        {state.kind === "failed" && state.credits && (
          <a
            href={creditsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-xs font-extrabold text-primary underline underline-offset-2">
            Get more credits
          </a>
        )}
      </span>
    </div>
  );
};

/** Pass the AI / Pass the human: a grey panel each, every check with its bar, its "Fix first" and how it moved. */
const StagePanels: FC<{ report: ScanReport | null; previousMetrics?: Record<string, number>; partial?: boolean }> = ({
  report,
  previousMetrics,
  partial = false,
}) => {
  // A partly checked scan's keyword match is over the few it could check: shown as not checked, never as a number.
  const byId = new Map(
    (report?.metrics ?? []).filter((metric) => !(partial && metric.id === "keyword-match")).map((metric) => [metric.id, metric]),
  );
  const first = report && !partial ? fixFirstId(report) : null;
  return (
    <>
      {METRIC_GROUPS.map((group) => (
        <div key={group.title} className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl bg-[#f6f6f6] px-4 py-3.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f6062]">{group.title}</span>
          {group.ids.map((id) => {
            const metric = byId.get(id);
            const label =
              metric?.label ??
              (id === "keyword-match"
                ? "Keyword match"
                : id === "parseability"
                  ? "Parseability"
                  : id === "impact-language"
                    ? "Impact language"
                    : "Length & format");
            const notChecked =
              (partial && id === "keyword-match") || metric?.checked === false || (metric !== undefined && metric.value === null);
            const value = metric && metric.value !== null && !notChecked ? Math.round(metric.value) : null;
            const was = previousMetrics?.[id];
            const moved = value !== null && was !== undefined ? value - was : 0;
            return (
              <div key={id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[13px] font-bold text-primary">{label}</span>
                  {first === id && (
                    <span className="rounded-full bg-[#fbe9e5] px-[7px] text-[11px] font-extrabold text-[#b23c26]">Fix first</span>
                  )}
                  <span className="text-[13px] font-extrabold text-primary">
                    {value ?? (notChecked ? <span className="text-xs font-bold text-[#a06f00]">not checked</span> : "–")}
                    {value !== null && <span className="text-[11px] font-semibold text-[#9a9b95]"> / 100</span>}
                    {moved !== 0 && (
                      <span
                        className={cn(
                          "ml-1.5 inline-flex items-center gap-px text-[11px] font-extrabold",
                          moved > 0 ? "text-[#6c7a1e]" : "text-[#b23c26]",
                        )}>
                        {moved > 0 ? (
                          <ArrowUp className="h-2.5 w-2.5" strokeWidth={3} />
                        ) : (
                          <ArrowDown className="h-2.5 w-2.5" strokeWidth={3} />
                        )}
                        {Math.abs(moved)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#ecece6]">
                  {value !== null && (
                    <div className="h-full rounded-full" style={{ width: `${value}%`, background: scoreColorOf(value) }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
};

export const ScoreRow: FC<{
  state: ScoreState;
  report: ScanReport | null;
  previousScore: number | null;
  previousMetrics?: Record<string, number>;
  progress?: string[];
  onRescore?: () => void;
  creditsHref: string;
  drops?: ScoreDrop[];
  onShowDrop?: (lines: string[]) => void;
  onUndoChange?: () => void;
}> = ({ state, report, previousScore, previousMetrics, progress = [], onRescore, creditsHref, drops = [], onShowDrop, onUndoChange }) => (
  // Never the score's recipe under it (owner, 2026-10-19: "70% keyword match" read as a keyword matcher).
  <div className="flex flex-col gap-3">
    <div className="flex flex-col items-stretch gap-4 lg:flex-row">
      <ScoreSide
        state={state}
        score={report ? report.score : null}
        previous={previousScore}
        onRescore={onRescore}
        creditsHref={creditsHref}
      />
      <StagePanels
        report={state.kind === "ready" || state.kind === "stale" || state.kind === "partial" ? report : null}
        previousMetrics={state.kind === "ready" ? previousMetrics : undefined}
        partial={state.kind === "partial"}
      />
    </div>
    {state.kind === "ready" && progress.length > 0 && (
      <p className="text-xs text-[#5f6062]" role="status">
        Stronger evidence for: {progress.join(", ")}.
        {report?.score === previousScore ? " Your overall score is unchanged." : ""}
      </p>
    )}
    {state.kind === "ready" && previousScore !== null && report?.score === previousScore && progress.length === 0 && drops.length === 0 && (
      <details className="text-xs text-[#73746d]">
        <summary className="cursor-pointer">Saved · score unchanged</summary>
        <p className="mt-1 max-w-2xl leading-relaxed">The edit is saved. This scan did not change your rounded overall score. Adding a skill can strengthen the resume without changing a requirement's existing credit; experience shows how you used it.</p>
      </details>
    )}
    {state.kind === "ready" && drops.length > 0 && (
      <details key={report?.scanId} className="rounded-lg border border-[#222325]/10 px-3 py-2 text-xs text-[#5f6062]">
        <summary className="cursor-pointer font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4">Why did it change? <span className="ml-1 font-normal text-[#73746d]">{drops.length} {drops.length === 1 ? "check" : "checks"} lower</span></summary>
        <div className="mt-3 flex flex-col gap-3">
          {drops.map(drop => <div key={drop.id} className="min-w-0">
            <p className="font-semibold text-primary">{drop.label} <span className="ml-1 font-normal">{drop.before} → {drop.after}{drop.id === "repetition" ? " points deducted" : ""}</span></p>
            {drop.reasons.map(reason => <p key={reason} className="mt-1 max-w-3xl leading-relaxed">{reason}</p>)}
            {drop.lines.length > 0 && onShowDrop && <button type="button" onClick={() => onShowDrop(drop.lines)} className="mt-1.5 inline-flex cursor-pointer items-center gap-1 font-semibold text-primary underline underline-offset-2"><Eye className="h-3 w-3" />Show supporting text</button>}
          </div>)}
          <div className="flex flex-wrap items-center gap-3 border-t border-black/8 pt-2">
            <span>You can keep this edit or undo it.</span>
            {onUndoChange && <button type="button" onClick={onUndoChange} className="cursor-pointer font-semibold text-primary underline underline-offset-2">Undo last change</button>}
          </div>
        </div>
      </details>
    )}
  </div>
);

// ---- Points taken off ----------------------------------------------------------------------

export interface StuffingNoteView {
  points: number;
  /** The posting's skills in the Skills list that no role or project mentions. */
  unbacked: string[];
  /** Anything else the scorer took points off for, in its words: a keyword twice in one bullet, numbers on every line. */
  others: string[];
}

const listOf = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** Up to three names, then "and N more". */
const someOf = (names: string[]) => (names.length <= 3 ? listOf(names) : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`);

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The points the score took off for padding, as one short row under the keywords (owner,
 * 2026-10-19: "the information is long... four buttons"): what it is in a line, "Add them to
 * experience" and "Show in resume" (the skills lit on the page), and the rest (take them out,
 * keep) in a menu.
 */
export const StuffingNote: FC<{
  note: StuffingNoteView;
  /** Works the skills into experience (AI). */
  onProve?: () => void;
  /** Takes them out of Skills for this job (no AI). */
  onRemove?: () => void;
  onShowWhere?: () => void;
  onKeep: () => void;
}> = ({ note, onProve, onRemove, onShowWhere, onKeep }) => {
  const [menu, setMenu] = useState(false);
  const n = note.unbacked.length;
  const pick = (run?: () => void) => () => {
    setMenu(false);
    run?.();
  };
  const what =
    n > 0 ? (
      <>
        <strong>
          {n} {n === 1 ? "skill" : "skills"} in Skills no role shows.
        </strong>{" "}
        <span className="text-[#55564f]">Recruiters may read {n === 1 ? "it" : "them"} as copied from the posting.</span>
      </>
    ) : (
      <>
        <strong>Some wording looks padded.</strong> <span className="text-[#55564f]">{note.others.map(sentence).join(". ")}.</span>
      </>
    );
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-2.5 rounded-[10px] bg-[#fff7e6] px-3 py-1.5">
      <span className="flex h-5 flex-none items-center whitespace-nowrap rounded-full bg-[#d99a00] px-2 text-[11px] font-extrabold text-white">
        −{note.points} {note.points === 1 ? "pt" : "pts"}
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-snug" title={n > 0 ? listOf(note.unbacked) : undefined}>
        {what}
      </span>
      {onShowWhere && <ShowInResume onClick={onShowWhere} />}
      {onProve && n > 0 && (
        <button type="button" onClick={onProve} className={ROW_BUTTON}>
          <Plus className="h-3 w-3" strokeWidth={2.6} />
          Add {n === 1 ? "it" : "them"} to experience
        </button>
      )}
      <Popover open={menu} onOpenChange={setMenu}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="More about this"
            title="More"
            className="grid h-[30px] w-[30px] flex-none cursor-pointer place-content-center rounded-lg text-primary hover:bg-black/[0.05]">
            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={4}
          className="w-72 overflow-hidden rounded-xl border-[1.5px] border-[#222325] bg-white p-0 shadow-[3px_3px_0_0_#222325]">
          {n > 0 && (
            <p className="border-b border-black/8 px-3.5 py-2.5 text-xs leading-relaxed text-[#55564f]">
              <strong className="text-primary">{someOf(note.unbacked)}</strong> {n === 1 ? "is" : "are"} in Skills, but no job or project
              mentions {n === 1 ? "it" : "them"}.{note.others.length > 0 ? ` Also: ${note.others.join("; ")}.` : ""}
            </p>
          )}
          {onRemove && n > 0 && (
            <button type="button" onClick={pick(onRemove)} className={MENU_ROW}>
              <X className="h-3.5 w-3.5 flex-none text-black/55" strokeWidth={2.4} />
              Remove from Skills
            </button>
          )}
          <button type="button" onClick={pick(onKeep)} className={MENU_ROW}>
            <Check className="h-3.5 w-3.5 flex-none text-black/55" strokeWidth={2.4} />
            Keep as is
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
};

/** A row's own button: white, hairline, small. */
const ROW_BUTTON =
  "flex h-[30px] flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#222325]/22 bg-white px-2.5 text-xs font-extrabold text-primary disabled:cursor-default disabled:opacity-50";

/** "Show in resume": scrolls the page to what a row means and lights it leaf green for a moment. */
const ShowInResume: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    className="flex h-[30px] flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-1.5 text-xs font-bold text-[#55564f] hover:text-primary">
    <Eye className="h-3 w-3" strokeWidth={2.4} />
    Show in resume
  </button>
);

const MENU_ROW =
  "flex w-full cursor-pointer items-center gap-2.5 border-b border-black/8 px-3.5 py-2.5 text-left text-xs font-semibold text-primary last:border-b-0 hover:bg-[#fbfbf7]";

/** A row's answer box and its button: Enter sends it too, and a click inside never lights the row. */
const RowInput: FC<{ input: NonNullable<Suggestion["input"]>; disabled: boolean }> = ({ input, disabled }) => {
  const [value, setValue] = useState(input.initialValue ?? "");
  const send = () => {
    if (value.trim()) input.onSubmit(value.trim());
  };
  return (
    <span className="flex flex-none items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      <input
        type="text"
        inputMode={input.mode ?? "decimal"}
        maxLength={input.mode === "text" ? 500 : 30}
        value={value}
        disabled={disabled}
        placeholder={input.placeholder}
        aria-label={input.placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") send();
        }}
        style={input.mode === "text" ? { width: "min(240px, 45vw)" } : undefined}
        className="h-[30px] w-[72px] rounded-lg border border-[#222325]/22 bg-white px-2 text-xs font-bold text-primary outline-none placeholder:font-semibold placeholder:text-[#8a8b85] focus:border-[#222325]"
      />
      <button type="button" disabled={disabled || !value.trim()} onClick={send} className={ROW_BUTTON}>
        {input.label}
      </button>
    </span>
  );
};

// ---- Missing / Working ----------------------------------------------------------------------

export interface GapChip {
  id: string;
  label: string;
  /** What the posting asks, word for word: the chip's hover card. */
  wants: string;
  /**
   * Picks that answer it at once, in place of being picked for the AI (owner, 2026-10-19): a
   * language's level ("Native", "Fluent (C1)"), which no tool can know and the scorer needs.
   */
  choices?: { title: string; options: Array<{ label: string; onClick: () => void }> };
}

export interface Suggestion {
  id: string;
  title: string;
  detail?: string;
  action: string;
  icon: "quantify" | "tailor";
  onClick?: () => void;
  /** "Show in resume", and a click on the row: what it means, lit on the page. */
  onShow?: () => void;
  /** Small choices in place of the one action ("Native", "Fluent (C1)"…): the person picks what is true. */
  choices?: Array<{ label: string; onClick: () => void }>;
  /** A note in the list, not a fix: a dark row with no button ("You've reached your best match…"). */
  note?: boolean;
  /** A Yes/No ask (Tailor's, or a posting's example): four show, the rest behind "Show N more". */
  ask?: boolean;
  /**
   * A small box for the person's own answer, before any `choices` (owner, 2026-10-22, fix plan 1e:
   * "How many web funnels did you build?" takes their number, "Add" puts it in the line).
   */
  input?: { placeholder: string; label: string; mode?: "text" | "decimal"; initialValue?: string; onSubmit: (value: string) => void };
  /** A Yes/No ask that can be ticked with others and answered together: its term (owner, 2026-10-22). */
  batch?: string;
  placement?: { initialDetail?: string; entryId?: string; useSkills?: boolean; useExperience?: boolean; skillsAdded?: boolean; roles: Array<{ id: string; label: string }>; onApply: (skills: boolean, experience: boolean, detail: string, entryId: string) => void };
}

/** A small square tick box, the light-brutalism way: hairline when off, lime with a check when on. */
const TickBox: FC<{ on: boolean }> = ({ on }) => (
  <span
    aria-hidden
    className={cn(
      "grid h-4 w-4 flex-none place-content-center rounded-[4px] border-[1.5px] border-[#222325]",
      on ? "bg-[#e1f073]" : "bg-white",
    )}>
    {on && <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3.4} />}
  </span>
);

/** Choose destinations together before committing a single resume change. */
const ConfirmationRow: FC<{ row: Suggestion; disabled: boolean; selected: boolean; onSelect?: () => void }> = ({ row, disabled, selected, onSelect }) => {
  const [skills, setSkills] = useState(row.placement?.useSkills ?? !row.placement?.skillsAdded);
  const [experience, setExperience] = useState(row.placement?.useExperience ?? false);
  const [entryId, setEntryId] = useState(row.placement?.entryId ?? "");
  const [detail, setDetail] = useState(row.placement?.initialDetail ?? "");
  const detailRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = detailRef.current;
    if (!field) return;
    const resize = () => {
      field.style.height = "0px";
      // 20px per line, 12px vertical padding and 2px border: at most two lines.
      field.style.height = `${Math.min(54, Math.max(34, field.scrollHeight + 2))}px`;
    };
    resize();
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === width) return;
      width = field.clientWidth;
      resize();
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [detail, experience]);
  const destination = skills && experience ? "both" : experience ? "Experience" : "Skills";
  return (
    <div className="rounded-[10px] bg-[#f6f6f6] pl-3 pr-2 py-1.5">
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        {onSelect && <button type="button" role="checkbox" aria-checked={selected} aria-label={`Select: ${row.title}`} disabled={disabled} onClick={onSelect} className="cursor-pointer"><TickBox on={selected} /></button>}
        <strong className="min-w-0 flex-1 text-[13px]">{row.title}</strong>
        <span className="text-xs text-[#5f6062]">Use in:</span>
        {([{ label: "Skills", on: skills, toggle: () => setSkills(!skills) }, { label: "Experience", on: experience, toggle: () => setExperience(!experience) }]).map(option => (
          <button key={option.label} type="button" aria-pressed={option.on} aria-label={`${row.title}: ${option.label}`} disabled={disabled} onClick={option.toggle}
            className={cn("flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 text-[11px] font-semibold disabled:opacity-50", option.on ? "border-[#dce89c] bg-[#f2f9c9] text-[#343a18]" : "border-black/15 bg-white text-[#55564f]")}>
            {option.on && <Check aria-hidden className="h-2.5 w-2.5" />}{option.label}
          </button>
        ))}
        {row.placement?.skillsAdded && <span className="text-[11px] text-[#63761a]">In Skills</span>}
        <button type="button" disabled={disabled || (!skills && !experience) || (experience && (!detail.trim() || !entryId))}
          aria-label={`Add ${row.title} to ${destination}`}
          onClick={() => row.placement?.onApply(skills, experience, detail.trim(), entryId)}
          className="ml-2 flex h-6 cursor-pointer items-center gap-1 rounded-md bg-[#222325] px-2 text-[11px] font-bold text-white disabled:cursor-default disabled:opacity-40">
          Add <ArrowRight aria-hidden className="h-3 w-3" />
        </button>
        {row.choices?.filter(choice => choice.label === "No").map(choice => <span key={choice.label} className="ml-3 flex shrink-0 items-center border-l border-[#222325]/15 pl-3">
          <button type="button" disabled={disabled} aria-label={`Dismiss ${row.title} suggestion`} title={`Dismiss ${row.title} suggestion`} onClick={choice.onClick} className="grid h-6 w-6 cursor-pointer place-content-center rounded text-[#777870] hover:bg-black/5 hover:text-primary disabled:opacity-50"><X aria-hidden className="h-3.5 w-3.5" /></button>
        </span>)}
      </div>
      {experience && <div className="mt-2 border-t border-black/8 pt-2 pb-1 pr-1">
        <label className="mb-2 flex items-center gap-2 text-xs text-[#5f6062]">Role
          <select aria-label={`Role for ${row.title}`} value={entryId} onChange={event => setEntryId(event.target.value)} disabled={disabled} className="min-w-0 max-w-full rounded-md border border-black/15 bg-white px-2 py-1 text-xs text-primary">
            <option value="">Choose a role</option>
            {row.placement?.roles.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-primary">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span>How did you use {row.title}?</span>
            <span className="text-[11px] font-normal text-[#73746d]">Describe your work in the selected role. You can edit the result.</span>
          </span>
          <textarea ref={detailRef} aria-label={`How did you use ${row.title}?`} value={detail} onChange={event => setDetail(event.target.value)} disabled={disabled} rows={1} maxLength={500}
            placeholder={`For example: At Acme, I used ${row.title} to…`}
            className="mt-1.5 block w-full resize-none overflow-y-auto rounded-lg border border-black/20 bg-white px-3 py-1.5 text-sm font-normal leading-5 text-primary outline-none focus:border-[#222325] focus:ring-1 focus:ring-[#222325] disabled:opacity-50" />
        </label>
      </div>}
    </div>
  );
};

const PLACE_LABELS: Record<ResumePlace, string> = { summary: "Summary", bullets: "Bullets", skills: "Skills" };
const PLACES: ResumePlace[] = ["summary", "bullets", "skills"];

/** A requirement's label short enough for a button: cut at a word, about 28 characters. */
const shortLabel = (label: string): string => {
  const clean = label.trim();
  if (clean.length <= 28) return clean;
  const cut = clean.slice(0, 28);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 12)).trim()}…`;
};

const TOOL_BUTTON =
  "flex h-[32px] flex-none cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:cursor-default";

export const FixesTabs: FC<{
  hasScoreDrop?: boolean;
  gaps: GapChip[];
  skillsOnly: GapChip[];
  picked: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  working: WorkingItem[];
  suggestions: Suggestion[];
  places: ResumePlace[];
  onPlaces: (places: ResumePlace[]) => void;
  busy: string | null;
  disabled: boolean;
  onAddPicked: () => void;
  onProve: () => void;
  error: string | null;
  creditsHref: string | null;
  /** The points-off row, under the keywords. */
  note?: ReactNode;
  /** Keywords a partly checked scan could not check: never read as matched. */
  unchecked?: number;
  onRescore?: () => void;
  /** Answers the ticked asks together: yes adds them all in one change, no marks them all answered. */
  onAnswerAsks?: (terms: string[], yes: boolean) => void;
}> = ({
  hasScoreDrop = false,
  gaps,
  skillsOnly,
  picked,
  onToggle,
  onClear,
  working,
  suggestions,
  places,
  onPlaces,
  busy,
  disabled,
  onAddPicked,
  onProve,
  error,
  creditsHref,
  note,
  unchecked = 0,
  onRescore,
  onAnswerAsks,
}) => {
  const [tab, setTab] = useState<"missing" | "working">("missing");
  const [asksOpen, setAsksOpen] = useState(false);
  const capped = capAsks(suggestions, (row) => row.ask === true, asksOpen);
  // Ticked asks (owner, 2026-10-22: "batch select this, not one by one"); an answered ask leaves the
  // list, so only terms still showing count.
  const batchTerms = onAnswerAsks ? suggestions.flatMap((row) => (row.batch ? [row.batch] : [])) : [];
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const tickedNow = batchTerms.filter((term) => ticked.has(term));
  const allTicked = batchTerms.length > 0 && tickedNow.length === batchTerms.length;
  const firstSelectableIndex = capped.rows.findIndex((row) => Boolean(row.batch));
  const tick = (term: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });
  const answerTicked = (yes: boolean) => {
    if (!onAnswerAsks || tickedNow.length === 0) return;
    onAnswerAsks(tickedNow, yes);
    setTicked(new Set());
  };
  const missingCount = new Set([...gaps.map(gap => gap.label.toLowerCase()), ...skillsOnly.map(gap => gap.label.toLowerCase()), ...suggestions.flatMap(row => row.id === "punctuation" ? ["fix:punctuation"] : [])]).size;
  const pickedCount = gaps.filter((gap) => picked.has(gap.id) && !gap.choices).length;
  const bulletsOn = places.includes("bullets");
  const prove = skillsOnly.length > 0;
  const togglePlace = (place: ResumePlace) =>
    onPlaces(places.includes(place) ? places.filter((p) => p !== place) : PLACES.filter((p) => p === place || places.includes(p)));

  return (
    <div className="flex flex-col gap-3 border-t border-[#222325]/10 pt-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="tablist" className="flex gap-0.5 self-start rounded-[10px] bg-[#f0f0ea] p-[3px]">
          {(["missing", "working"] as const).map((id) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(id)}
                className={cn(
                  "flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px]",
                  on ? "bg-white font-extrabold text-primary shadow-[0_0_0_1px_#222325]" : "font-bold text-[#5f6062]",
                )}>
                {id === "missing" ? "To improve" : "Working"}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px]",
                    id === "missing" && missingCount > 0 ? "bg-[#b23c26] text-white" : "bg-[#e4e4dd] text-primary",
                  )}>
                  {id === "missing" ? missingCount : working.length}
                </span>
                {id === "missing" && batchTerms.length > 0 && <span className="ml-1 text-[11px] font-normal text-[#73746d]">· {batchTerms.length} {batchTerms.length === 1 ? "question" : "questions"}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "missing" && busy && (
        <div className="flex h-10 items-center gap-2.5 rounded-[10px] bg-[#f6f6f6] px-3 text-[13px] font-bold text-[#55564f]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {busy}
        </div>
      )}

      {tab === "missing" && !busy && unchecked > 0 && (
        <div className="flex min-h-10 flex-wrap items-center gap-2.5 rounded-[10px] bg-[#fff7e6] px-3 py-1.5 text-[13px]">
          <AlertCircle className="h-3.5 w-3.5 flex-none text-[#a06f00]" strokeWidth={2.4} />
          <strong className="flex-1">{unchecked} couldn&apos;t be checked.</strong>
          {onRescore && (
            <button type="button" onClick={onRescore} className={ROW_BUTTON}>
              <RotateCw className="h-3 w-3" strokeWidth={2.6} />
              Rescore
            </button>
          )}
        </div>
      )}

      {/* Owner, 2026-10-19: "there should be a point where it's like, nothing left to add, move on". */}
      {tab === "missing" && !busy && missingCount === 0 && unchecked === 0 && suggestions.length === 0 && !note && (
        <div className={cn("flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-[13px]", hasScoreDrop ? "bg-[#f6f6f6]" : "bg-[#f4f9c9]")}>
          <span className={cn("grid h-[22px] w-[22px] flex-none place-content-center rounded-full", hasScoreDrop ? "text-[#73746d]" : "border-[1.5px] border-[#222325] bg-[#e1f073]")}>
            {hasScoreDrop ? <AlertCircle className="h-4 w-4" /> : <Check className="h-3 w-3 text-primary" strokeWidth={3} />}
          </span>
          <strong className="flex-1">{hasScoreDrop ? "No missing requirements. Review the score change above." : "Nothing left to add. You’re good to move on."}</strong>
        </div>
      )}

      {tab === "missing" && !busy && missingCount > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {skillsOnly.map((chip) => (
              <Chip key={chip.id} chip={chip} tone="proof" />
            ))}
            {gaps.map((chip) =>
              chip.choices ? (
                <ChoiceChip key={chip.id} chip={chip} disabled={disabled} />
              ) : (
                <Chip
                  key={chip.id}
                  chip={chip}
                  tone={picked.has(chip.id) ? "picked" : "open"}
                  onClick={disabled ? undefined : () => onToggle(chip.id)}
                />
              ),
            )}
          </div>
        </div>
      )}

      {tab === "missing" && !busy && note}

      {tab === "missing" && !busy && suggestions.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5">
          {capped.rows.map((row, index) => (
            <Fragment key={row.id}>
          {batchTerms.length > 1 && index === firstSelectableIndex && (
            <div className="flex min-h-9 flex-wrap items-center gap-2 px-3 text-xs">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setTicked(allTicked ? new Set() : new Set(batchTerms))}
                className="flex cursor-pointer items-center gap-2 font-bold text-[#5f6062] hover:text-primary disabled:cursor-default">
                <TickBox on={allTicked} />
                {allTicked ? "Clear" : "Select all"}
              </button>
              {tickedNow.length > 0 && (
                <>
                  <span className="flex-1 font-bold text-primary">{tickedNow.length} selected</span>
                  <button type="button" disabled={disabled} onClick={() => answerTicked(true)} className={ROW_BUTTON}>
                    Yes, add {tickedNow.length}
                  </button>
                  <button type="button" disabled={disabled} onClick={() => answerTicked(false)} className={ROW_BUTTON}>
                    No to {tickedNow.length}
                  </button>
                </>
              )}
            </div>
          )}
            {row.batch ? <ConfirmationRow row={row} disabled={disabled} selected={ticked.has(row.batch)} onSelect={onAnswerAsks ? () => tick(row.batch!) : undefined} /> : (
            <div
              onClick={row.onShow}
              className={cn(
                "flex min-h-10 flex-wrap items-center gap-2.5 rounded-[10px] px-3 py-1.5",
                row.note ? "mt-[10px] bg-[#222325] py-2.5 text-white" : "bg-[#f6f6f6]",
                row.onShow && "cursor-pointer hover:bg-[#f0f0ea]",
              )}>
              {row.note ? (
                <span className="grid h-[18px] w-[18px] flex-none place-content-center rounded-full bg-[#e1f073]">
                  <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3.4} />
                </span>
              ) : row.batch && onAnswerAsks ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={ticked.has(row.batch)}
                  aria-label={`Select: ${row.title}`}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (row.batch) tick(row.batch);
                  }}
                  className="flex-none cursor-pointer disabled:cursor-default">
                  <TickBox on={ticked.has(row.batch)} />
                </button>
              ) : (
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#d99a00]" />
              )}
              <span className="flex-1 text-[13px]">
                <strong>{row.title}</strong>
                {row.detail && <span className={row.note ? "text-[#d3d1c7]" : "text-[#5f6062]"}> {row.detail}</span>}
              </span>
              {row.onShow && <ShowInResume onClick={row.onShow} />}
              {row.input && <RowInput input={row.input} disabled={disabled} />}
              {row.choices?.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    choice.onClick();
                  }}
                  className={ROW_BUTTON}>
                  {choice.label}
                </button>
              ))}
              {!row.choices && !row.note && (
                <button
                  type="button"
                  disabled={disabled || !row.onClick}
                  onClick={(event) => {
                    event.stopPropagation();
                    row.onClick?.();
                  }}
                  className={ROW_BUTTON}>
                  {row.icon === "quantify" ? (
                    <Hash className="h-[13px] w-[13px]" strokeWidth={2.4} />
                  ) : (
                    <Crosshair className="h-[13px] w-[13px]" strokeWidth={2.4} />
                  )}
                  {row.action}
                </button>
              )}
            </div>
            )}
            {index === capped.toggleAfter && (
              <button
                type="button"
                aria-expanded={asksOpen}
                onClick={() => setAsksOpen((open) => !open)}
                className="cursor-pointer self-start px-3 py-0.5 text-xs font-bold text-[#5f6062] underline decoration-black/25 underline-offset-2 hover:text-primary hover:decoration-[#222325]">
                {asksOpen ? "Show less" : `Show ${capped.hidden} more`}
              </button>
            )}
            </Fragment>
          ))}
        </div>
      )}

      {tab === "working" && (
        <div className="flex flex-col gap-1.5">
          {working.length === 0 && <p className="text-[13px] text-[#5f6062]">Nothing yet.</p>}
          {working.map((row) => (
            <div key={row.title} className="flex min-h-10 flex-wrap items-center gap-2.5 rounded-[10px] bg-[#f6f6f6] px-3">
              <span className="grid h-[18px] w-[18px] flex-none place-content-center rounded-full bg-[#e1f073]">
                <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3.4} />
              </span>
              <span className="flex-1 text-[13px]">
                <strong>{row.title}</strong> <span className="text-[#5f6062]">{row.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-[#b23c26]">
          {error}{" "}
          {creditsHref && (
            <a
              href={creditsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline underline-offset-2">
              Get more credits
            </a>
          )}
        </p>
      )}

      {tab === "missing" && (gaps.some((gap) => !gap.choices) || prove) && (
        <div className="flex flex-wrap items-center gap-2.5 border-t border-[#222325]/10 pt-3">
          <span className="text-xs font-bold text-[#5f6062]">Add to</span>
          {PLACES.map((place) => {
            const on = places.includes(place);
            return (
              <button
                key={place}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => togglePlace(place)}
                className={cn(
                  "flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold disabled:cursor-default",
                  on ? "border-[#222325] bg-[#eef6ad] text-primary" : "border-[#222325]/20 bg-white text-[#8a8b85]",
                )}>
                {on ? <Check className="h-[11px] w-[11px]" strokeWidth={3} /> : <X className="h-2.5 w-2.5" strokeWidth={2.6} />}
                {PLACE_LABELS[place]}
              </button>
            );
          })}
          {(pickedCount > 0 || prove) && <span aria-hidden className="mx-1 h-6 w-px bg-[#222325]/15" />}
          {pickedCount > 0 ? (
            <>
              <button
                type="button"
                disabled={disabled || Boolean(busy) || places.length === 0}
                title={places.length > 0 ? undefined : "Turn on a part under Add to"}
                onClick={onAddPicked}
                className={cn(
                  TOOL_BUTTON,
                  "br-plain br-lime border-[1.5px] !border-[#222325] bg-[#e1f073] text-primary shadow-[2px_2px_0_0_#222325] disabled:opacity-50",
                )}>
                Add {pickedCount} {pickedCount === 1 ? "keyword" : "keywords"}
              </button>
              <button type="button" onClick={onClear} className={cn(TOOL_BUTTON, "px-1.5 text-[#55564f]")}>
                Clear
              </button>
            </>
          ) : null}
          {prove && (
            <button
              type="button"
              disabled={disabled || Boolean(busy) || !bulletsOn}
              title={bulletsOn ? undefined : "Turn on Bullets under Add to"}
              onClick={onProve}
              className={cn(TOOL_BUTTON, "border-[1.5px] border-[#222325] bg-[#222325] text-white disabled:opacity-50")}>
              <Plus className="h-[10px] w-[10px]" strokeWidth={2.6} />
              {/* What it does, said plainly (owner, 2026-10-21: "Add the 1 to resume." meant nothing): these are
                  shown only in Skills, and the button works them into a line of experience. */}
              {skillsOnly.length === 1 ? `Show ${shortLabel(skillsOnly[0].label)} in your experience` : `Show all ${skillsOnly.length} in your experience`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * A keyword answered by a pick of the person's own (a language's level): a click opens the choices
 * under it, and a choice puts it on the resume at once. Escape or a click elsewhere closes them.
 */
const ChoiceChip: FC<{ chip: GapChip; disabled: boolean }> = ({ chip, disabled }) => {
  const [open, setOpen] = useState(false);
  const choices = chip.choices;
  if (!choices) return null;
  return (
    <span
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}>
      <button
        type="button"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((was) => !was)}
        className={cn(
          "flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-dashed pl-[9px] pr-3 text-[13px] font-bold text-primary disabled:cursor-default",
          open ? "border-[#222325] bg-[#f4f9c9]" : "border-[#222325]/40 bg-white",
        )}>
        <Plus className="h-[11px] w-[11px] text-[#8a8b85]" strokeWidth={2.6} />
        {chip.label}
      </button>
      {open && (
        <span className="absolute left-0 top-full z-30 mt-2 flex w-[260px] flex-col gap-2 rounded-xl bg-[#222325] p-3 text-left text-white">
          <span className="text-xs font-extrabold text-[#e1f073]">{choices.title}</span>
          <span className="text-xs leading-[1.45] text-white/80">{chip.wants}</span>
          <span className="flex flex-wrap gap-1.5">
            {choices.options.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  option.onClick();
                }}
                className="h-7 cursor-pointer rounded-full bg-white px-2.5 text-xs font-bold text-primary hover:bg-[#e1f073]">
                {option.label}
              </button>
            ))}
          </span>
        </span>
      )}
    </span>
  );
};

/** One keyword: open (dashed, plus), picked (ink, lime check), or only in Skills (amber dot). */
const Chip: FC<{ chip: GapChip; tone: "open" | "picked" | "proof"; onClick?: () => void }> = ({ chip, tone, onClick }) => (
  <span className="group relative">
    <button
      type="button"
      aria-pressed={tone === "proof" ? undefined : tone === "picked"}
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border pl-[9px] pr-3 text-[13px] font-bold",
        onClick ? "cursor-pointer" : "cursor-default",
        tone === "open" && "border-dashed border-[#222325]/40 bg-white text-primary",
        tone === "picked" && "border-[#222325] bg-[#222325] text-white",
        tone === "proof" && "border-[#f1d7a2] bg-[#fff7e6] text-[#8a5a00]",
      )}>
      {tone === "open" && <Plus className="h-[11px] w-[11px] text-[#8a8b85]" strokeWidth={2.6} />}
      {tone === "picked" && <Check className="h-[11px] w-[11px] text-[#e1f073]" strokeWidth={3} />}
      {tone === "proof" && <span className="h-1.5 w-1.5 rounded-full bg-[#d99a00]" />}
      {chip.label}
    </button>
    <span
      role="tooltip"
      className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-[260px] flex-col gap-1.5 rounded-xl bg-[#222325] p-3 text-left font-medium text-white group-focus-within:flex group-hover:flex">
      <span className="text-xs font-extrabold text-[#e1f073]">
        {tone === "proof" ? "Only in your Skills list" : "What the posting wants"}
      </span>
      <span className="text-xs leading-[1.45] text-white/80">{chip.wants}</span>
    </span>
  </span>
);
