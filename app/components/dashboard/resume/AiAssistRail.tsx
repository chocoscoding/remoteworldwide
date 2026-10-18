"use client";

// The ATS check as a rail: the docked right column (see `AtsDockedRail`) and the floating dock's
// panel (see `AtsFloatingDock`) both show it. The look is the owner's 2026-10-17 design ("D"):
//
// - a dark score card: the ring with the number, what it was scored against with "Change", and a
//   row under it saying how current it is ("Edited since this check · Check again");
// - before any check, the same card asks "against a job / general score" and runs it;
// - "Fixes · N to review", one white card of rows that open one at a time;
// - "Ask for a rewrite…" pinned to the foot of the column (docked only: the dock has its own).
//
// ── The score is a real scan ───────────────────────────────────────────────
// "General score" and "Against a job" run the same scorer `/dashboard/ats` does, on the document
// as it stands, and cost what a scan costs. Everything shown is read out of that one report.
// A check describes the text it scored: once the resume reads differently the ring fades and the
// card says so, with the same check again beside it.
//
// ── The fix rows are the check's findings ──────────────────────────────────
// Derived from the standing scan by `check-suggestions.ts`, each wired to the tool that acts on
// it. No check, no rows. A rewrite row carries the number the preview pins beside its line, and
// pointing at any row frames what it is about on the page (`onPointAt`).
//
// ── "Ask for a rewrite…" is real ────────────────────────────────────────────
// The instruction goes to the AI service's `ask` tool (1 credit, charged only for a usable result).

import { useEffect, useRef, useState, type FC, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Hash,
  Loader2,
  Scissors,
  TrendingDown,
  Sparkle,
  Info,
  Tag,
  TriangleAlert,
  X,
} from "lucide-react";
import TimeAgo from "timeago-react";
import { cn } from "@/lib/utils";
import {
  ATS_BILLING_HREF,
  SCAN_CREDITS,
  type ScanFailure,
} from "@/app/lib/ats/api";
import { scoreColor, scoreTrackColor } from "@/app/lib/apply/score";
import {
  MAX_ASK_INSTRUCTION_CHARS,
  SUGGESTION_CREDITS,
  type SuggestionTool,
} from "@/app/lib/resume/ai";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import Collapse from "./controls/Collapse";
import type { CheckStatus } from "@/hooks/mutations/useCheckResume";
import type { ResumeCheck } from "./resume-document";
import type { CheckSuggestion, RailCard } from "./check-suggestions";

/** The tool a card runs, when it runs one — for its busy state. A rewrite is applied locally and has none. */
const SUGGESTION_TOOL: Record<CheckSuggestion["kind"], SuggestionTool | null> =
  {
    keywords: "keywords",
    quantify: "quantify",
    shorten: "shorten",
    rewrite: null,
    stuffing: null,
  };

/** A row's button. */
const SUGGESTION_ACTION: Record<
  CheckSuggestion["kind"],
  (s: CheckSuggestion) => string
> = {
  keywords: (s) => ((s.terms?.length ?? 0) === 1 ? "Add it" : "Add them"),
  rewrite: () => "Use this line",
  quantify: () => "Suggest numbers",
  shorten: () => "Shorten",
  stuffing: () => "Ask AI to trim it",
};

/** The badge a row that isn't a numbered rewrite wears. */
const SUGGESTION_ICON: Record<
  Exclude<CheckSuggestion["kind"], "rewrite">,
  typeof Tag
> = {
  keywords: Tag,
  quantify: Hash,
  shorten: Scissors,
  stuffing: TrendingDown,
};

const PHASE_COPY: Partial<Record<CheckStatus, string>> = {
  preparing: "Reading your resume…",
  scoring: "Scoring…",
};

const STALE_NOTE =
  "You've edited this resume since it was scanned, so this is the score of an earlier draft.";

export interface AiAssistRailProps {
  isBlank: boolean;
  /** The fix rows to show — the standing check's findings, numbered (see `railCards`). Empty with no check. */
  cards: RailCard[];
  /** How many of this check's cards were dismissed, so an empty list doesn't claim the check found nothing. */
  dismissedCount?: number;
  /** The standing check; null shows the two ways to run one instead. */
  check: ResumeCheck | null;
  /** The resume has been edited since `check` ran. */
  stale: boolean;
  checkStatus: CheckStatus;
  checkFailure: ScanFailure | null;
  onRemoveCheck: () => void;
  onCheckGeneral: () => void;
  onCheckAgainstJob: () => void;
  /** Runs the standing check again — same posting, current text. */
  onRecheck: () => void;
  onDismissCheckFailure: () => void;
  /** What acting on a card came to, by card id — shown in place of its button. */
  suggestionOutcomes: Record<string, string>;
  onRunSuggestion: (suggestion: CheckSuggestion) => void;
  /** Sets a card aside. Undo brings it back. */
  onDismissSuggestion: (suggestion: CheckSuggestion) => void;
  /** The card the pointer or focus is on, so the preview can frame what it is about; null when it leaves. */
  onPointAt?: (suggestion: CheckSuggestion | null) => void;
  /** The AI tool out right now, if any. One at a time: every paid action here waits for it. */
  aiRunning: SuggestionTool | null;
  askInput: string;
  onAskInputChange: (value: string) => void;
  onAskSubmit: () => void;
  askStatus: string | null;
  onDismissAskStatus: () => void;
  /** Why the last ask failed, shown in red in the chat itself rather than as a toast (owner, 2026-10-18). */
  askError?: string | null;
  onDismissAskError?: () => void;
  /** The job a check "against a job" would use now, as "Role at Company"; null opens the picker. */
  jobLabel?: string | null;
  /**
   * "rail" (docked in the right column) or "float" (inside the floating dock's panel over the
   * preview). Floating, the dock carries its own ask box, so the rail's is left out, and the list
   * is held to the panel's height rather than the window's.
   */
  variant?: "rail" | "float";
  /** A row above the score card: the docked rail's title and its undock and collapse buttons. */
  header?: ReactNode;
}

/** A radio row on the dark card, as the design has it: a ring that fills lime when picked. */
const PickRow: FC<{
  picked: boolean;
  title: string;
  detail: string;
  onPick: () => void;
}> = ({ picked, title, detail, onPick }) => (
  <button
    type="button"
    role="radio"
    aria-checked={picked}
    onClick={onPick}
    className={cn(
      "flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-left text-white outline outline-[1.5px] transition-colors",
      picked
        ? "bg-white/[0.08] outline-[#e1f073]"
        : "outline-transparent hover:bg-white/[0.04]",
    )}
  >
    <span
      aria-hidden
      className={cn(
        "h-3.5 w-3.5 flex-none rounded-full",
        picked ? "border-4 border-[#e1f073]" : "border-[1.5px] border-white/50",
      )}
    />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-[13px] font-extrabold">{title}</span>
      <span className="truncate text-xs text-white/60">{detail}</span>
    </span>
  </button>
);

const AiAssistRail: FC<AiAssistRailProps> = ({
  isBlank,
  cards,
  dismissedCount = 0,
  check,
  stale,
  checkStatus,
  checkFailure,
  onCheckGeneral,
  onCheckAgainstJob,
  onRecheck,
  onDismissCheckFailure,
  suggestionOutcomes,
  onRunSuggestion,
  onDismissSuggestion,
  onPointAt,
  aiRunning,
  askInput,
  onAskInputChange,
  onAskSubmit,
  askStatus,
  onDismissAskStatus,
  askError = null,
  onDismissAskError,
  jobLabel = null,
  variant = "rail",
  header,
}) => {
  const floating = variant === "float";
  // Docked, the rail ends level with the foot of the resume page, so the ask box sits beside the
  // paper (owner, 2026-10-17), and never past the foot of the window, so it is always in view.
  const railRef = useRef<HTMLDivElement>(null);
  const [railHeight, setRailHeight] = useState<number | null>(null);
  useEffect(() => {
    if (floating) return;
    const mat = document.querySelector<HTMLElement>("[data-resume-mat]");
    const fit = () => {
      const el = railRef.current;
      if (!el) return;
      const windowFoot = window.innerHeight - 16;
      const paperFoot = mat ? mat.getBoundingClientRect().bottom : windowFoot;
      const next = Math.max(320, Math.round(Math.min(windowFoot, paperFoot) - el.getBoundingClientRect().top));
      setRailHeight((prev) => (prev === next ? prev : next));
    };
    fit();
    // The paper grows and shrinks with its pages and the zoom.
    const resize = new ResizeObserver(fit);
    if (mat) resize.observe(mat);
    window.addEventListener("scroll", fit, { passive: true });
    window.addEventListener("resize", fit);
    return () => {
      resize.disconnect();
      window.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
    };
  }, [floating]);
  const [fixesOpen, setFixesOpen] = useState(true);
  // One row open at a time, the first by default, as in the design. Null: the first.
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [pick, setPick] = useState<"job" | "general">("job");
  const checking = checkStatus === "preparing" || checkStatus === "scoring";
  const report = check?.report ?? null;
  const asking = aiRunning === "ask";
  const toReview = cards.filter((card) => !suggestionOutcomes[card.id]).length;
  const shownRow = openRow ?? cards[0]?.id ?? null;

  // ── The dark card ──────────────────────────────────────────────────────────
  const darkCard =
    "flex flex-col gap-3 rounded-[14px] bg-[#222325] p-4 text-white";

  const failure = checkFailure && !checking && !isBlank && (
    <div className="flex items-start gap-2 rounded-[9px] bg-white/[0.08] px-2.5 py-2">
      <p className="flex-1 text-xs leading-relaxed text-white/80">
        {checkFailure.message}{" "}
        {checkFailure.kind === "credits" && (
          <Link
            href={ATS_BILLING_HREF}
            className="font-bold text-white underline decoration-[#e1f073] decoration-2 underline-offset-2"
          >
            Get more credits
          </Link>
        )}
      </p>
      <button
        type="button"
        onClick={onDismissCheckFailure}
        className="flex-none cursor-pointer text-white/50 hover:text-white"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  let scoreCard: ReactNode;
  if (isBlank) {
    scoreCard = (
      <section aria-label="ATS score" className={darkCard}>
        <span className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="grid h-14 w-14 flex-none place-content-center rounded-full border-4 border-dashed border-[#55564f] text-lg font-extrabold text-white/50"
          >
            –
          </span>
          <span className="text-[13px] leading-snug text-white/80">
            Add a summary, experience, or skills to see an ATS score here.
          </span>
        </span>
      </section>
    );
  } else if (checking) {
    scoreCard = (
      <section
        aria-label="ATS score"
        className={cn(darkCard, "flex-row items-center gap-3.5")}
      >
        <Loader2
          aria-hidden
          className="h-14 w-14 flex-none animate-spin text-[#e1f073]"
          strokeWidth={1.6}
        />
        <span className="flex flex-col">
          <span className="text-sm font-extrabold">
            {PHASE_COPY[checkStatus]}
          </span>
          <span className="text-xs text-white/60">
            {pick === "job" && jobLabel
              ? `Against ${jobLabel}`
              : "General score"}
          </span>
        </span>
      </section>
    );
  } else if (report && check) {
    const score = report.score;
    scoreCard = (
      <section aria-label="ATS score" className={darkCard}>
        <span className="flex items-center gap-3">
          <span
            role="img"
            aria-label={`${score} out of 100`}
            className={cn(
              "flex-none transition-opacity",
              stale && "opacity-45",
            )}
          >
            <ScoreRing
              value={score}
              size={56}
              tone="dark"
              fillColor={scoreColor(score)}
              trackColor={scoreTrackColor(score)}
              label={
                <span className="text-lg font-extrabold text-white">
                  {score}
                </span>
              }
            />
          </span>
          <span className="flex min-w-0 flex-col">
            {check.posting ? (
              <>
                <span className="text-[13px] text-white/70">
                  <em>Against</em>{" "}
                  <strong className="font-bold not-italic text-white">
                    {check.posting.company}
                  </strong>
                </span>
                <span className="text-xs text-white/60">
                  <span className="line-clamp-2">
                    {check.posting.role}
                    {" · "}
                    <button
                      type="button"
                      onClick={onCheckAgainstJob}
                      disabled={checking}
                      title={`Check against another job · ${SCAN_CREDITS} credit`}
                      className="cursor-pointer font-bold text-[#e1f073] underline underline-offset-2 hover:text-white"
                    >
                      Change
                    </button>
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="text-[13px] font-extrabold">
                  General score
                </span>
                <span className="text-xs text-white/60">Not tied to a job</span>
              </>
            )}
          </span>
        </span>

        {stale ? (
          <span
            title={STALE_NOTE}
            className="flex items-center justify-between gap-2 rounded-[9px] bg-white/[0.08] py-[7px] pl-2.5 pr-2 text-xs text-white/75"
          >
            Edited since this check
            <button
              type="button"
              onClick={onRecheck}
              title={`Check again · ${SCAN_CREDITS} credit`}
              className="h-7 flex-none cursor-pointer rounded-[7px] border-[1.5px] border-[#222325] bg-[#e1f073] px-2.5 text-xs font-extrabold text-primary"
            >
              Check again
            </button>
          </span>
        ) : (
          <span className="flex items-center justify-between gap-2 rounded-[9px] bg-white/[0.08] py-[7px] pl-2.5 pr-2 text-xs text-white/75">
            <span>
              Checked <TimeAgo datetime={check.at} opts={{ minInterval: 10 }} />
            </span>
            <button
              type="button"
              onClick={check.job ? onCheckGeneral : onCheckAgainstJob}
              title={`${SCAN_CREDITS} credit`}
              className="h-[26px] cursor-pointer px-1 text-xs font-bold text-[#e1f073] underline underline-offset-2 hover:text-white"
            >
              {check.job ? "General score instead" : "Against a job instead"}
            </button>
          </span>
        )}

        {/* Scored on the reduced path when a provider was down. Still a real score. */}
        {report.degraded && (
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-white/60">
            <TriangleAlert className="mt-px h-3 w-3 flex-none" />
            {report.degradedReason ??
              "Scored on a reduced path. Part of the scorer was unavailable."}
          </p>
        )}
        {failure}
      </section>
    );
  } else {
    // No check yet: the design's chooser. A failed check lands here too, with why.
    scoreCard = (
      <section aria-label="ATS score" className={cn(darkCard, "gap-3.5")}>
        <span className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="grid h-14 w-14 flex-none place-content-center rounded-full border-4 border-dashed border-[#55564f] text-lg font-extrabold text-white/50"
          >
            –
          </span>
          <span className="text-[13px] leading-snug text-white/80">
            See how this resume reads to applicant tracking systems.
          </span>
        </span>
        <div
          role="radiogroup"
          aria-label="Check against"
          className="flex flex-col gap-1.5"
        >
          <PickRow
            picked={pick === "job"}
            title="Against a job"
            detail={jobLabel ?? "Pick a saved job or paste a posting"}
            onPick={() => setPick("job")}
          />
          <PickRow
            picked={pick === "general"}
            title="General score"
            detail="Not tied to a job"
            onPick={() => setPick("general")}
          />
        </div>
        {failure}
        <button
          type="button"
          onClick={pick === "job" ? onCheckAgainstJob : onCheckGeneral}
          title={`${SCAN_CREDITS} credit`}
          className="h-10 cursor-pointer rounded-[10px] border-[1.5px] border-[#222325] bg-[#e1f073] text-sm font-extrabold text-primary"
        >
          Score resume
        </button>
      </section>
    );
  }

  // ── Fixes ──────────────────────────────────────────────────────────────────
  const fixesLabel =
    cards.length > 0 && toReview > 0
      ? `Fixes · ${toReview} to review`
      : "Fixes";

  const fixes = check ? (
    <section
      aria-label="Fixes from this check"
      className="flex min-h-0 flex-col rounded-[14px] border border-black/10 bg-white p-2"
    >
      <button
        type="button"
        aria-expanded={fixesOpen}
        onClick={() => setFixesOpen((open) => !open)}
        className="flex min-h-8 w-full cursor-pointer items-center gap-2 px-1.5 text-left"
      >
        <span className="flex-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f6062]">
          {fixesLabel}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 text-primary transition-transform duration-200",
            fixesOpen && "rotate-180",
          )}
        />
      </button>

      <Collapse open={fixesOpen}>
        <div className="flex flex-col gap-1 pt-1">
          {cards.length === 0 ? (
            checkStatus === "explaining" ? (
              <p className="flex items-center gap-2 px-1.5 py-2 text-xs text-black/55">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading through this check for what to fix…
              </p>
            ) : (
              <div className="flex items-center gap-2.5 rounded-[10px] bg-[#f4f9c9] px-2 py-2.5 text-[13px] font-bold text-primary">
                <Check
                  className="h-4 w-4 flex-none text-[#6c7a1e]"
                  strokeWidth={3}
                />
                {dismissedCount > 0
                  ? "Every fix dismissed. Undo brings the last one back."
                  : "Nothing to fix from this check"}
              </div>
            )
          ) : (
            <>
              {stale && (
                <p className="px-1.5 pb-1 text-[11px] leading-snug text-black/50">
                  From the check of an earlier draft. Each one is re-read
                  against your resume as it is now.
                </p>
              )}
              {cards.map((card) => {
                const outcome = suggestionOutcomes[card.id];
                const tool = SUGGESTION_TOOL[card.kind];
                const running = tool !== null && aiRunning === tool;
                const open = shownRow === card.id;
                const Icon =
                  card.kind === "rewrite" ? null : SUGGESTION_ICON[card.kind];
                return (
                  <div
                    key={card.id}
                    onMouseEnter={() => onPointAt?.(card)}
                    onMouseLeave={() => onPointAt?.(null)}
                    onFocusCapture={() => onPointAt?.(card)}
                    onBlurCapture={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node | null,
                        )
                      )
                        onPointAt?.(null);
                    }}
                    className={cn(
                      "flex flex-col rounded-[10px]",
                      open &&
                        "bg-[#fbfbf7] outline outline-1 outline-[#222325]/[0.12]",
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenRow(open ? "" : card.id)}
                      className="flex min-h-10 w-full cursor-pointer items-center gap-2 px-1.5 text-left"
                    >
                      {card.n !== null ? (
                        <span className="grid h-5 w-5 flex-none place-content-center rounded-full bg-[#222325] text-[10.5px] font-extrabold text-white">
                          {card.n}
                        </span>
                      ) : (
                        Icon && (
                          <span
                            className={cn(
                              "grid h-5 w-5 flex-none place-content-center rounded-full",
                              card.kind === "keywords"
                                ? "bg-[#e1f073]"
                                : "bg-[#f0f0ea]",
                            )}
                          >
                            <Icon
                              aria-hidden
                              className="h-2.5 w-2.5 text-primary"
                              strokeWidth={2.6}
                            />
                          </span>
                        )
                      )}
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-primary">
                        {card.title}
                        {card.where && (
                          <em className="ml-1 font-semibold text-[#5f6062]">
                            {card.where}
                          </em>
                        )}
                      </span>
                      {outcome && (
                        <Check
                          aria-label="Done"
                          className="h-3.5 w-3.5 flex-none text-[#6c7a1e]"
                          strokeWidth={3}
                        />
                      )}
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "h-3.5 w-3.5 flex-none text-primary transition-transform duration-200",
                          open && "rotate-180",
                        )}
                      />
                    </button>

                    {/* pb: room for the button's hard shadow, which the fold clips. */}
                    <Collapse open={open}>
                      <div className="flex flex-col gap-2 px-2.5 pb-3">
                        {card.terms && card.terms.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {card.terms.map((term) => (
                              <span
                                key={term}
                                className="rounded-full border border-dashed border-[#222325]/40 px-2.5 py-0.5 text-xs font-semibold text-primary"
                              >
                                {term}
                              </span>
                            ))}
                          </div>
                        )}
                        {card.rewrite ? (
                          <div
                            title={card.rewrite.why || undefined}
                            className="flex flex-col gap-2 text-[12.5px] leading-snug"
                          >
                            <span className="text-xs text-[#5f6062] line-through">
                              {card.rewrite.before}
                            </span>
                            <span className="font-bold text-primary">
                              {card.rewrite.after}
                            </span>
                          </div>
                        ) : (
                          card.detail && (
                            <p className="text-xs leading-relaxed text-[#5f6062]">
                              {card.detail}
                            </p>
                          )
                        )}

                        {outcome ? (
                          <p className="flex items-start gap-1.5 text-xs font-semibold text-[#6c7a1e]">
                            <Check className="mt-px h-3.5 w-3.5 flex-none" />
                            {outcome}
                          </p>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              // One AI run at a time, whoever started it.
                              disabled={aiRunning !== null}
                              onClick={() => onRunSuggestion(card)}
                              className={cn(
                                "inline-flex h-7 items-center gap-1.5 rounded-[7px] border-[1.5px] border-[#222325] px-2.5 text-xs font-extrabold text-primary br-shadow-press disabled:cursor-default disabled:opacity-50",
                                card.kind === "rewrite"
                                  ? "bg-[#e1f073]"
                                  : "bg-white",
                              )}
                            >
                              {running ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Working…
                                </>
                              ) : (
                                SUGGESTION_ACTION[card.kind](card)
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDismissSuggestion(card)}
                              className="h-7 cursor-pointer px-1.5 text-xs font-bold text-[#55564f] transition-colors hover:text-primary"
                            >
                              Dismiss
                            </button>
                            {tool !== null && (
                              <span className="ml-auto text-[11px] font-semibold text-[#8a8b85]">
                                {SUGGESTION_CREDITS} credit
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Collapse>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </Collapse>
    </section>
  ) : (
    // Before a check: where the fixes will be, said in words. No grey bars: nothing is loading (owner, 2026-10-17).
    !isBlank && (
      <div className="flex flex-col gap-2.5 rounded-[14px] border border-dashed border-[#222325]/25 px-4 py-3.5">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#8a8b85]">
          Fixes
        </span>
        <span className="text-xs text-[#8a8b85]">
          Missing keywords and lines to sharpen show up here after a check.
        </span>
      </div>
    )
  );

  // ── Ask for a rewrite (docked only) ─────────────────────────────────────────
  const ask = !floating && !isBlank && (
    <div className="flex flex-none flex-col gap-1.5 pb-1 pr-1">
      {askError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#b23c26]/30 bg-[#fdf4f2] px-3.5 py-2.5">
          <p className="flex-1 text-xs font-semibold leading-relaxed text-[#b23c26]">{askError}</p>
          {onDismissAskError && (
            <button type="button" onClick={onDismissAskError} aria-label="Dismiss" className="flex-none cursor-pointer text-[#b23c26]/60 hover:text-[#b23c26]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {askStatus && (
        <div className="flex items-start gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2.5">
          <p className="flex-1 text-xs leading-relaxed text-black/65">
            {askStatus}
          </p>
          <button
            type="button"
            onClick={onDismissAskStatus}
            aria-label="Dismiss"
            className="flex-none cursor-pointer text-black/35 hover:text-black/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex h-11 items-center gap-2 rounded-xl border-[1.5px] border-[#222325] bg-white pl-3 pr-[5px] br-shadow">
        {asking ? (
          <Loader2
            aria-hidden
            className="h-[15px] w-[15px] flex-none animate-spin text-primary"
          />
        ) : (
          <Sparkle
            aria-hidden
            className="h-[15px] w-[15px] flex-none text-primary"
            strokeWidth={2}
          />
        )}
        <input
          type="text"
          value={askInput}
          onChange={(e) => onAskInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAskSubmit();
          }}
          maxLength={MAX_ASK_INSTRUCTION_CHARS}
          disabled={asking}
          aria-label="Ask for a rewrite"
          placeholder={asking ? "Rewriting your resume…" : "Ask AI"}
          className="h-8 min-w-0 flex-1 bg-transparent text-[13px] text-primary outline-none placeholder:text-[#8a8b85]"
        />
        {/* An icon with its label on hover (owner, 2026-10-18), not a line of text under the box. */}
        <span
          tabIndex={0}
          aria-label="Uses what's on your resume. Numbers it adds for you are marked on the page to check."
          title="Uses what's on your resume. Numbers it adds for you are marked on the page to check."
          className="grid h-6 w-6 flex-none cursor-help place-content-center text-[#8a8b85] hover:text-primary"
        >
          <Info className="h-3.5 w-3.5" />
        </span>
        <button
          type="button"
          onClick={onAskSubmit}
          disabled={!askInput.trim() || aiRunning !== null}
          aria-label={`Send · ${SUGGESTION_CREDITS} credit`}
          title={`Send · ${SUGGESTION_CREDITS} credit`}
          className={cn(
            "grid h-8 w-8 flex-none cursor-pointer place-content-center rounded-lg transition-colors disabled:cursor-default",
            askInput.trim()
              ? "bg-[#222325] text-[#e1f073]"
              : "bg-[#e4e4dd] text-white",
          )}
        >
          {asking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.6} />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={railRef}
      style={!floating && railHeight ? { height: railHeight } : undefined}
      className={cn(
        "flex flex-col gap-3",
        floating
          ? "max-h-[min(560px,calc(100vh-220px))]"
          : "h-[calc(100vh-112px)]",
      )}
    >
      {header}
      <div className="scrollbar-hover flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden pr-1">
        {scoreCard}
        {fixes}
      </div>
      {ask}
    </div>
  );
};

export default AiAssistRail;
