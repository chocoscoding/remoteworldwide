"use client";

// The resume step's score and fixes in one card (owner's design, 2026-10-19, "AI apply resume
// step"): the ring and where the score stands, the two stages with a bar per check, what the last
// change did (with the points stuffing took off), then the Missing / Working tabs and what to do
// next. Everything here is drawn from props; ResumeStep decides what the buttons do.

import { useState, type FC, type ReactNode } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Check, Crosshair, Eye, Hash, Loader2, MoreHorizontal, Plus, RotateCw, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { METRIC_GROUPS, fixFirstId, scoreColorOf, type WorkingItem } from "@/app/lib/apply/fixes";
import { isCurrentScore, scoreRecipe } from "@/app/lib/ats/api";
import type { ScanReport } from "@/app/lib/ats/types";
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
  | { kind: "partial"; checked: number; total: number }
  | { kind: "failed"; message: string; retryable: boolean; credits: boolean };

const C = 94.2;
const arc = (score: number) => ((Math.max(0, Math.min(100, score)) / 100) * C).toFixed(1);

/** The ring: a gain shows bright over the old score, a loss leaves the old score faint behind. */
const Ring: FC<{ score: number | null; previous: number | null; state: ScoreState["kind"] }> = ({ score, previous, state }) => {
  if (state === "scoring") {
    return (
      <span className="h-[88px] w-[88px] flex-none">
        <svg width="88" height="88" viewBox="0 0 36 36" className="animate-spin" aria-hidden>
          <circle cx="18" cy="18" r="15" fill="none" stroke="#ecece6" strokeWidth="3.2" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="#222325" strokeWidth="3.2" strokeLinecap="round" strokeDasharray={`20 ${C}`} />
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

/** The left of the score row: the ring, "ATS score", where it stands, and the job it is against. */
const ScoreSide: FC<{
  state: ScoreState;
  score: number | null;
  previous: number | null;
  company: string;
  onRescore?: () => void;
  creditsHref: string;
}> = ({ state, score, previous, company, onRescore, creditsHref }) => {
  const shown = state.kind === "ready" || state.kind === "stale" || state.kind === "partial" ? score : null;
  const delta = state.kind === "ready" && shown !== null && previous !== null ? Math.round(shown) - Math.round(previous) : 0;
  return (
    <div className="flex min-w-0 flex-none items-center gap-4 lg:w-[280px]">
      <Ring score={shown} previous={state.kind === "ready" ? previous : null} state={state.kind} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-base font-extrabold text-primary">ATS score</span>
        {state.kind === "none" && <span className="text-xs text-[#5f6062]">Pick a resume above to see how it reads to an ATS.</span>}
        {state.kind === "scoring" && (
          <>
            <span className="text-xs font-bold text-[#55564f]">Reading it like an ATS would…</span>
            <span className="text-xs text-[#8a8b85]">about 10 seconds</span>
          </>
        )}
        {state.kind === "ready" && delta === 0 && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#6c7a1e]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#6c7a1e]" />
            Up to date
          </span>
        )}
        {state.kind === "ready" && delta > 0 && (
          <>
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#6c7a1e]">
              <ArrowUp className="h-3 w-3" strokeWidth={3} />
              Up {delta} since last change
            </span>
            <span className="text-xs text-[#8a8b85]">was {Math.round(previous ?? 0)}</span>
          </>
        )}
        {state.kind === "ready" && delta < 0 && (
          <>
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#b23c26]">
              <ArrowDown className="h-3 w-3" strokeWidth={3} />
              Down {-delta} since last change
            </span>
            <span className="text-xs text-[#8a8b85]">was {Math.round(previous ?? 0)}</span>
          </>
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
              Partly checked
            </span>
            <span className="text-xs text-[#8a8b85]">
              {state.total > 0
                ? `Only ${state.checked} of ${state.total} ${state.total === 1 ? "keyword" : "keywords"} could be checked just now.`
                : "Part of this scan couldn't run just now."}
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
        <span className="text-xs text-[#5f6062]">
          Against <strong className="text-primary">{company}</strong>
        </span>
        {(state.kind === "stale" || state.kind === "partial") && onRescore && (
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
  const byId = new Map((report?.metrics ?? []).filter((metric) => !(partial && metric.id === "keyword-match")).map((metric) => [metric.id, metric]));
  const first = report && !partial ? fixFirstId(report) : null;
  return (
    <>
      {METRIC_GROUPS.map((group) => (
        <div key={group.title} className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl bg-[#f6f6f6] px-4 py-3.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f6062]">{group.title}</span>
            <span className="text-xs text-[#8a8b85]">{group.hint}</span>
          </div>
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
            const notChecked = (partial && id === "keyword-match") || metric?.checked === false || (metric !== undefined && metric.value === null);
            const value = metric && metric.value !== null && !notChecked ? Math.round(metric.value) : null;
            const was = previousMetrics?.[id];
            const moved = value !== null && was !== undefined ? value - was : 0;
            return (
              <div key={id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[13px] font-bold text-primary">{label}</span>
                  {first === id && <span className="rounded-full bg-[#fbe9e5] px-[7px] text-[11px] font-extrabold text-[#b23c26]">Fix first</span>}
                  <span className="text-[13px] font-extrabold text-primary">
                    {value ?? (notChecked ? <span className="text-xs font-bold text-[#a06f00]">not checked</span> : "–")}
                    {value !== null && <span className="text-[11px] font-semibold text-[#9a9b95]"> / 100</span>}
                    {moved !== 0 && (
                      <span
                        className={cn(
                          "ml-1.5 inline-flex items-center gap-px text-[11px] font-extrabold",
                          moved > 0 ? "text-[#6c7a1e]" : "text-[#b23c26]",
                        )}>
                        {moved > 0 ? <ArrowUp className="h-2.5 w-2.5" strokeWidth={3} /> : <ArrowDown className="h-2.5 w-2.5" strokeWidth={3} />}
                        {Math.abs(moved)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#ecece6]">
                  {value !== null && <div className="h-full rounded-full" style={{ width: `${value}%`, background: scoreColorOf(value) }} />}
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
  company: string;
  onRescore?: () => void;
  creditsHref: string;
}> = ({ state, report, previousScore, previousMetrics, company, onRescore, creditsHref }) => {
  // How the number is made, so the bars add up to it (owner, 2026-10-19: "the ATS is meant to be more
  // than a keyword matcher"). Never under a score an older formula made, which it would not explain.
  const recipe = report && (state.kind === "ready" || state.kind === "stale") && isCurrentScore(report) ? scoreRecipe(report) : null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col items-stretch gap-4 lg:flex-row">
        <ScoreSide
          state={state}
          score={report ? report.score : null}
          previous={previousScore}
          company={company}
          onRescore={onRescore}
          creditsHref={creditsHref}
        />
        <StagePanels
          report={state.kind === "ready" || state.kind === "stale" || state.kind === "partial" ? report : null}
          previousMetrics={state.kind === "ready" ? previousMetrics : undefined}
          partial={state.kind === "partial"}
        />
      </div>
      {/* Under the bars it sums up: past the score side (280px and the row's gap) on a wide screen. */}
      {recipe && <p className="m-0 text-xs text-[#8a8b85] lg:pl-[296px]">{recipe}</p>}
    </div>
  );
};

// ---- Points taken off ----------------------------------------------------------------------

export interface StuffingNoteView {
  points: number;
  /** The posting's skills in the Skills list that no role or project mentions. */
  unbacked: string[];
  /** Anything else the scorer took points off for, in its words: a keyword twice in one bullet, numbers on every line. */
  others: string[];
}

const listOf = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

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
    <div className="flex min-h-10 items-center gap-2.5 rounded-[10px] bg-[#fff7e6] px-3 py-1.5">
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
              <strong className="text-primary">{someOf(note.unbacked)}</strong> {n === 1 ? "is" : "are"} in Skills, but no job or project mentions{" "}
              {n === 1 ? "it" : "them"}.{note.others.length > 0 ? ` Also: ${note.others.join("; ")}.` : ""}
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
  detail: string;
  action: string;
  icon: "quantify" | "tailor";
  onClick?: () => void;
  /** "Show in resume", and a click on the row: what it means, lit on the page. */
  onShow?: () => void;
  /** Small choices in place of the one action ("Native", "Fluent (C1)"…): the person picks what is true. */
  choices?: Array<{ label: string; onClick: () => void }>;
}

const PLACE_LABELS: Record<ResumePlace, string> = { summary: "Summary", bullets: "Bullets", skills: "Skills" };
const PLACES: ResumePlace[] = ["summary", "bullets", "skills"];

/** "Bullets & Skills", "Summary, Bullets & Skills": where "Add N keywords" puts them. */
export const placesText = (places: ResumePlace[]): string => {
  const names = PLACES.filter((place) => places.includes(place)).map((place) => PLACE_LABELS[place]);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
};

const TOOL_BUTTON =
  "flex h-[38px] flex-none cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-extrabold disabled:cursor-default";

export const FixesTabs: FC<{
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
}> = ({
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
}) => {
  const [tab, setTab] = useState<"missing" | "working">("missing");
  const missingCount = gaps.length + skillsOnly.length;
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
                {id === "missing" ? "Missing" : "Working"}
                <span className={cn("rounded-full px-1.5 text-[11px]", id === "missing" ? "bg-[#b23c26] text-white" : "bg-[#e4e4dd] text-primary")}>
                  {id === "missing" ? missingCount : working.length}
                </span>
              </button>
            );
          })}
        </div>
        {tab === "missing" && !busy && missingCount > 0 && skillsOnly.length === 0 && (
          <span className="flex-1 text-xs text-[#5f6062]">Hover a keyword to see what it needs. Pick only what your work really shows.</span>
        )}
        {tab === "missing" && !busy && skillsOnly.length > 0 && (
          <>
            <span className="flex-1" />
            <span className="flex flex-wrap items-center gap-3.5 text-xs text-[#5f6062]">
              <span className="flex items-center gap-[5px]">
                <span className="grid h-3 w-3 place-content-center rounded-full border border-dashed border-black/40" />
                not on resume
              </span>
              <span className="flex items-center gap-[5px]">
                <span className="grid h-3 w-3 place-content-center rounded-full bg-[#222325]">
                  <Check className="h-2 w-2 text-[#e1f073]" strokeWidth={4} />
                </span>
                picked to add
              </span>
              <span className="flex items-center gap-[5px]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#d99a00]" />
                only in Skills, needs proof
              </span>
            </span>
          </>
        )}
      </div>

      {tab === "missing" && busy && (
        <div className="flex h-10 items-center gap-2.5 rounded-[10px] bg-[#f6f6f6] px-3 text-[13px] font-bold text-[#55564f]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {busy}
        </div>
      )}

      {tab === "missing" && !busy && unchecked > 0 && (
        <div className="flex min-h-10 items-center gap-2.5 rounded-[10px] bg-[#fff7e6] px-3 py-1.5 text-[13px]">
          <AlertCircle className="h-3.5 w-3.5 flex-none text-[#a06f00]" strokeWidth={2.4} />
          <span className="flex-1">
            <strong>
              {unchecked} {unchecked === 1 ? "keyword" : "keywords"} couldn&apos;t be checked this time.
            </strong>{" "}
            <span className="text-[#55564f]">Rescore to see which are missing.</span>
          </span>
          {onRescore && (
            <button type="button" onClick={onRescore} className={ROW_BUTTON}>
              <RotateCw className="h-3 w-3" strokeWidth={2.6} />
              Rescore
            </button>
          )}
        </div>
      )}

      {tab === "missing" && !busy && missingCount === 0 && unchecked === 0 && (
        <div className="flex items-center gap-2.5 rounded-xl bg-[#f4f9c9] px-3.5 py-3 text-[13px]">
          <span className="grid h-[22px] w-[22px] flex-none place-content-center rounded-full border-[1.5px] border-[#222325] bg-[#e1f073]">
            <Check className="h-3 w-3 text-primary" strokeWidth={3} />
          </span>
          <span className="flex-1">
            <strong>Every keyword is matched in your experience.</strong>{" "}
            <span className="text-[#55564f]">Nothing left to add for this posting.</span>
          </span>
        </div>
      )}

      {tab === "missing" && !busy && missingCount > 0 && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-[13px] font-extrabold">
            {missingCount} {missingCount === 1 ? "keyword" : "keywords"} from the posting
            {pickedCount > 0 && <span className="text-xs font-semibold text-[#5f6062]">· {pickedCount} picked</span>}
          </span>
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
          {suggestions.map((row) => (
            <div
              key={row.id}
              onClick={row.onShow}
              className={cn(
                "flex min-h-10 items-center gap-2.5 rounded-[10px] bg-[#f6f6f6] px-3 py-1.5",
                row.onShow && "cursor-pointer hover:bg-[#f0f0ea]",
              )}>
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#d99a00]" />
              <span className="flex-1 text-[13px]">
                <strong>{row.title}</strong> <span className="text-[#5f6062]">{row.detail}</span>
              </span>
              {row.onShow && <ShowInResume onClick={row.onShow} />}
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
              {!row.choices && (
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
          ))}
        </div>
      )}

      {tab === "working" && (
        <div className="flex flex-col gap-1.5">
          {working.length === 0 && <p className="text-[13px] text-[#5f6062]">Nothing stands out yet. The fixes on Missing are where to start.</p>}
          {working.map((row) => (
            <div key={row.title} className="flex min-h-10 items-center gap-2.5 rounded-[10px] bg-[#f6f6f6] px-3">
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
            <a href={creditsHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
              Get more credits
            </a>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5 border-t border-[#222325]/10 pt-3">
        <span className="text-xs font-bold text-[#5f6062]">Apply changes to</span>
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
        <span aria-hidden className="mx-1 h-6 w-px bg-[#222325]/15" />
        {pickedCount > 0 ? (
          <>
            <button
              type="button"
              disabled={disabled || Boolean(busy) || places.length === 0}
              title={places.length > 0 ? undefined : "Turn on a part under Apply changes to"}
              onClick={onAddPicked}
              className={cn(
                TOOL_BUTTON,
                "br-plain br-lime border-[1.5px] !border-[#222325] bg-[#e1f073] text-primary shadow-[2px_2px_0_0_#222325] disabled:opacity-50",
              )}>
              Add {pickedCount} {pickedCount === 1 ? "keyword" : "keywords"}
              {places.length > 0 && ` to ${placesText(places)}`}
            </button>
            <button type="button" onClick={onClear} className={cn(TOOL_BUTTON, "px-1.5 text-[#55564f]")}>
              Clear
            </button>
          </>
        ) : (
          missingCount > 0 &&
          gaps.length > 0 && (
            <button type="button" disabled className={cn(TOOL_BUTTON, "border border-[#222325]/22 bg-white text-primary opacity-50")}>
              Pick keywords to add
            </button>
          )
        )}
        {prove && (
          <button
            type="button"
            disabled={disabled || Boolean(busy) || !bulletsOn}
            title={bulletsOn ? undefined : "Turn on Bullets under Apply changes to"}
            onClick={onProve}
            className={cn(TOOL_BUTTON, "border-[1.5px] border-[#222325] bg-[#222325] text-white disabled:opacity-50")}>
            <Plus className="h-[13px] w-[13px]" strokeWidth={2.6} />
            Prove the {skillsOnly.length} in a bullet
          </button>
        )}
      </div>
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
      <span className="text-xs font-extrabold text-[#e1f073]">{tone === "proof" ? "Only in your Skills list" : "What the posting wants"}</span>
      <span className="text-xs leading-[1.45] text-white/80">{chip.wants}</span>
      <span className="text-[11px] text-white/55">
        {tone === "proof" ? "Say it once in the role where you did the work." : "Pick it only if your work really shows it."}
      </span>
    </span>
  </span>
);
