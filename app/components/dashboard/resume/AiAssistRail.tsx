"use client";

// The match-score / fix-cards / ask-for-rewrite right rail, shown on the
// Overview, Content and AI Tools tabs (Customize gets the settings rail
// instead — see ResumeScreenBody). The look is the owner's 2026-10-04 design:
// a dark score card, "Fixes from this check" as one collapsible list of
// collapsible cards, and the ask box pinned to the bottom of the rail.
//
// ── The score is a real scan ───────────────────────────────────────────────
// "General score" and "Against a job" run the same scorer `/dashboard/ats`
// does, on the document as it stands, and cost what a scan costs — which the
// card says on the buttons rather than after. Everything the card shows is
// read out of that one report: the number, its band, the keywords the posting
// wanted. Nothing adds to it. The editor used to add 13 after a tailor and 4
// per keyword chip, which is the difference between a score and a claim.
//
// A check describes the text it scored. Once the resume reads differently —
// any edit, any AI tool — the card greys the number and says so, and offers
// the same check again, rather than presenting an old score as this resume's.
//
// ── The fix cards are the check's findings ─────────────────────────────────
// Derived from the standing scan by `check-suggestions.ts` — the keywords it
// found missing, the bullet rewrites its write-up proposed, a metric in the
// "needs work" band with the evidence for it — each wired to the tool that
// acts on it. No check, no cards. A rewrite card carries the number the
// preview pins beside its line, and pointing at any card frames what it is
// about on the page (`onPointAt`).
//
// ── "Ask for a rewrite…" is real ────────────────────────────────────────────
// The instruction goes to the AI service's `ask` tool (1 credit, charged only
// for a usable result); the screen merges the narrow diff that comes back and
// writes the caption from the service's counts. The box sticks to the bottom
// of the rail while the cards scroll under it, faded out over its top edge.

import { useState, type FC } from "react";
import Link from "next/link";
import { ArrowUp, Check, ChevronDown, Hash, Loader2, Scissors, Sparkle, Tag, TriangleAlert, X } from "lucide-react";
import TimeAgo from "timeago-react";
import { cn } from "@/lib/utils";
import { ATS_BILLING_HREF, SCAN_CREDITS, keywordLabel, missingGaps, scanTier, type ScanFailure } from "@/app/lib/ats/api";
import { SCORE_SCALE_RING, scoreColor, scoreTrackColor } from "@/app/lib/apply/score";
import { MAX_ASK_INSTRUCTION_CHARS, SUGGESTION_CREDITS, type SuggestionTool } from "@/app/lib/resume/ai";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import Collapse from "./controls/Collapse";
import type { CheckStatus } from "@/hooks/mutations/useCheckResume";
import type { ResumeCheck } from "./resume-document";
import type { CheckSuggestion, RailCard } from "./check-suggestions";

/** The tool a card runs, when it runs one — for its busy state. A rewrite is applied locally and has none. */
const SUGGESTION_TOOL: Record<CheckSuggestion["kind"], SuggestionTool | null> = {
  keywords: "keywords",
  quantify: "quantify",
  shorten: "shorten",
  rewrite: null,
};

/** A card's button. The paid ones say their price beside it; the scan's own rewrites were paid for with the check. */
const SUGGESTION_ACTION: Record<CheckSuggestion["kind"], (s: CheckSuggestion) => string> = {
  keywords: (s) => ((s.terms?.length ?? 0) === 1 ? "Add it" : "Add them"),
  rewrite: () => "Use this line",
  quantify: () => "Suggest numbers",
  shorten: () => "Shorten",
};

/** The lime badge a card that isn't a numbered rewrite wears. */
const SUGGESTION_ICON: Record<Exclude<CheckSuggestion["kind"], "rewrite">, typeof Tag> = {
  keywords: Tag,
  quantify: Hash,
  shorten: Scissors,
};

/** More chips than this is a list, not a glance. The ATS screen has the whole report. */
const MAX_GAP_CHIPS = 6;

const PHASE_COPY: Partial<Record<CheckStatus, string>> = {
  preparing: "Reading your resume…",
  scoring: "Scoring…",
};

/** The score ring's diameter: small enough to sit beside the job it was scored against. */
const RING_SIZE = 84;

const STALE_NOTE = "You've edited this resume since it was scanned, so this is the score of an earlier draft.";

export interface AiAssistRailProps {
  isBlank: boolean;
  /** The fix cards to show — the standing check's findings, numbered (see `railCards`). Empty with no check. */
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
}

/** A text button on the dark card, carrying its price when it has one. */
const CheckButton: FC<{ onClick: () => void; disabled?: boolean; children: string }> = ({ onClick, disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="cursor-pointer font-bold text-white underline decoration-[#e1f073] decoration-2 underline-offset-2 transition-colors hover:text-[#e1f073] disabled:cursor-default disabled:opacity-40">
    {children}
  </button>
);

/** A collapse chevron: up while open, as in the design. */
const Chevron: FC<{ open: boolean; className?: string }> = ({ open, className }) => (
  <ChevronDown aria-hidden className={cn("h-3.5 w-3.5 flex-none transition-transform duration-200", open && "rotate-180", className)} />
);

const AiAssistRail: FC<AiAssistRailProps> = ({
  isBlank,
  cards,
  dismissedCount = 0,
  check,
  stale,
  checkStatus,
  checkFailure,
  // onRemoveCheck, (the Remove button is commented out below)
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
}) => {
  const [fixesOpen, setFixesOpen] = useState(true);
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const checking = checkStatus === "preparing" || checkStatus === "scoring";
  const report = check?.report ?? null;
  const tier = report ? scanTier(report.score) : null;
  const gaps = report ? missingGaps(report).slice(0, MAX_GAP_CHIPS) : [];
  const asking = aiRunning === "ask";
  const toReview = cards.filter((card) => !suggestionOutcomes[card.id]).length;

  const toggleFold = (id: string) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // The score as the apply flow's resume step shows it: a ring with the number
  // in the hole and no "/ 100", since a ring already says out of what. Never
  // grey (owner, 2026-10-08): the whole ring is the score's red, yellow or
  // green, the unfilled part faint; before a score it is the faint scale; a
  // stale check keeps its colour, faded, number and all.
  const scoreRing = (score: number | null) =>
    score === null ? (
      <ScoreRing
        value={0}
        size={RING_SIZE}
        tone="dark"
        ringBackground={SCORE_SCALE_RING}
        label={<span aria-hidden className="h-[3px] w-5 rounded-full bg-white/30" />}
      />
    ) : (
      <div role="img" aria-label={`${score} out of 100`} className="flex-none">
        <ScoreRing
          value={score}
          size={RING_SIZE}
          tone="dark"
          fillColor={scoreColor(score)}
          trackColor={scoreTrackColor(score)}
          className={cn("transition-opacity", stale && "opacity-50")}
        />
      </div>
    );

  // What the check was scored against: "Against" light and italic, the
  // company bold, the role under it. A general check names itself the same way.
  const scoredAgainst = check?.posting ? (
    <p className="text-[13px] leading-snug">
      <span className="font-light italic text-white/75">Against</span> <span className="font-bold">{check.posting.company}</span>
      <span className="mt-0.5 line-clamp-2 block text-xs text-white/75">{check.posting.role}</span>
    </p>
  ) : (
    <p className="text-[13px] leading-snug">
      <span className="font-bold">General score</span>
      <span className="mt-0.5 block text-xs text-white/75">How it reads for your niche</span>
    </p>
  );

  const scoreCard = (
    <section aria-label="ATS score" className="rounded-2xl bg-[#222325] p-[18px] text-white">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-bold text-white/75">ATS score</span>
        {/* Remove is off for now (owner, 2026-10-04). onRemoveCheck is still passed in, so this can come back as is.
        {check && !checking && !isBlank && (
          <button
            type="button"
            onClick={onRemoveCheck}
            className="h-7 cursor-pointer text-xs font-bold text-white/75 underline underline-offset-2 transition-colors hover:text-white">
            Remove
          </button>
        )} */}
      </div>

      {isBlank ? (
        <div className="mt-3 flex items-center gap-3.5">
          {scoreRing(null)}
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-white/75">
            Add a summary, experience, or skills to see an ATS score here.
          </p>
        </div>
      ) : report && check && tier ? (
        <>
          <div className="mt-3 flex items-center gap-3.5">
            {scoreRing(report.score)}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
              {!stale && <span className="rounded-full bg-white/[0.12] px-2.5 py-[5px] text-xs font-bold">{tier.label}</span>}
              {scoredAgainst}
              {!stale && (
                <p className="text-xs text-white/60">
                  scanned <TimeAgo datetime={check.at} opts={{ minInterval: 10 }} />
                </p>
              )}
            </div>
          </div>

          {/* Stale: said in two words, with the check again beside it. The
              full reason is the row's tooltip. */}
          {stale && (
            <div title={STALE_NOTE} className="mt-3 flex min-h-10 items-center gap-2 rounded-lg bg-white/[0.08] py-1.5 pl-2.5 pr-1.5">
              <span className="flex-1 text-xs font-semibold text-white/75">
                Stale result<span className="sr-only">. {STALE_NOTE}</span>
              </span>
              {checking ? (
                <span className="inline-flex items-center gap-1 pr-1 text-xs font-semibold text-white">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {PHASE_COPY[checkStatus]}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onRecheck}
                  className="inline-flex h-7 flex-none items-center rounded-md bg-[#e1f073] px-2.5 text-xs font-extrabold text-primary br-shadow-press br-white">
                  Check again · {SCAN_CREDITS} credit
                </button>
              )}
            </div>
          )}

          {/* Scored on the reduced path when a provider was down. Still a
              real score — the service says which part it could not run. */}
          {report.degraded && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-white/60">
              <TriangleAlert className="mt-px h-3 w-3 flex-none" />
              {report.degradedReason ?? "Scored on a reduced path. Part of the scorer was unavailable."}
            </p>
          )}

          <div className="mt-4 border-t border-white/[0.16] pt-3.5">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/75">Missing from this posting</p>
            {!check.job ? (
              // A general check has no posting, so there is nothing to be
              // missing from — said, rather than shown as an empty list.
              <p className="text-xs leading-relaxed text-white/75">Check it against a job to see which keywords that posting wants.</p>
            ) : gaps.length === 0 ? (
              <p className="text-xs leading-relaxed text-white/75">None. This resume covers what the posting asked for.</p>
            ) : (
              // Read-only: what the scan found missing. Adding them is the fix
              // card's job — it works each one in, in your own voice.
              <div className="flex flex-wrap gap-1.5">
                {gaps.map((gap) => (
                  <span key={gap.id} className="rounded-full border border-dashed border-white/45 px-2.5 py-1 text-xs font-normal">
                    {keywordLabel(gap.label)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      ) : checking ? (
        <div className="mt-3 flex items-center gap-3.5">
          {scoreRing(null)}
          <p className="flex items-center gap-2 text-sm text-white/75">
            <Loader2 className="h-4 w-4 animate-spin text-[#e1f073]" />
            {PHASE_COPY[checkStatus]}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3.5">
            {scoreRing(null)}
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-white/75">
              No check standing. See how this resume reads to applicant tracking systems:
            </p>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <CheckButton onClick={onCheckGeneral}>General score</CheckButton>
            <span className="text-white/45">or</span>
            <CheckButton onClick={onCheckAgainstJob}>Against a job</CheckButton>
            <span className="ml-auto flex-none rounded-full border border-dashed border-white/45 px-2 py-0.5 text-[11px] font-semibold text-white/75">
              {SCAN_CREDITS} credit
            </span>
          </div>
        </>
      )}

      {/* A refusal, where the score would have been. Inline rather than a
          toast: the way forward depends on why, and it belongs to this card. */}
      {checkFailure && !checking && !isBlank && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/15 bg-white/[0.08] px-2.5 py-2">
          <p className="flex-1 text-xs leading-relaxed text-white">
            {checkFailure.message}{" "}
            {checkFailure.kind === "credits" && (
              <Link href={ATS_BILLING_HREF} className="font-bold underline decoration-[#e1f073] decoration-2 underline-offset-2">
                Top up credits
              </Link>
            )}
          </p>
          <button
            type="button"
            onClick={onDismissCheckFailure}
            className="flex-none cursor-pointer text-white/50 hover:text-white"
            aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </section>
  );

  if (isBlank) return <div className="flex flex-col gap-3.5">{scoreCard}</div>;

  return (
    <div className="scrollbar-hover flex max-h-[calc(100vh-112px)] flex-col gap-3.5 overflow-y-auto overflow-x-hidden pr-1">
      {scoreCard}

      {/* Fixes from this check — the standing check's findings. Without one
          there is nothing to claim about this resume, so nothing is shown. */}
      {check && (
        <div className="flex flex-col">
          <button
            type="button"
            aria-expanded={fixesOpen}
            onClick={() => setFixesOpen((open) => !open)}
            className="flex min-h-9 w-full cursor-pointer items-center gap-2.5 px-1 pt-1 text-left text-primary">
            <span className="flex-1 text-[15px] font-extrabold">Fixes from this check</span>
            {cards.length > 0 && <span className="text-xs font-semibold text-[#5f6062]">{toReview} to review</span>}
            <Chevron open={fixesOpen} />
          </button>

          <Collapse open={fixesOpen}>
            <div className="mt-2.5 rounded-2xl border border-black/10 bg-white">
              {cards.length === 0 ? (
                <div className="p-4">
                  {/* The write-up — and the rewrites that come with it — lands
                      after the score, so "nothing found" waits until it has. */}
                  {checkStatus === "explaining" ? (
                    <p className="flex items-center gap-2 text-xs text-black/55">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Reading through this check for what to fix…
                    </p>
                  ) : dismissedCount > 0 ? (
                    <>
                      <p className="text-sm font-extrabold text-primary">Every fix dismissed</p>
                      <p className="mt-1 text-xs leading-relaxed text-[#5f6062]">Undo brings the last one back.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-extrabold text-primary">Nothing to fix from this check</p>
                      <p className="mt-1 text-xs leading-relaxed text-[#5f6062]">
                        {check.job
                          ? "It found no missing keywords, bullet rewrites or weak spots to act on."
                          : "A general check found no weak spots to act on. Check it against a job to see what a posting wants."}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {stale && (
                    <p className="border-b border-black/10 px-4 py-2.5 text-[11px] leading-snug text-black/50">
                      From the check of an earlier draft. Each one is re-read against your resume as it is now.
                    </p>
                  )}
                  {cards.map((card, i) => {
                    const outcome = suggestionOutcomes[card.id];
                    const tool = SUGGESTION_TOOL[card.kind];
                    const running = tool !== null && aiRunning === tool;
                    const open = !folded.has(card.id);
                    const Icon = card.kind === "rewrite" ? null : SUGGESTION_ICON[card.kind];
                    return (
                      <div
                        key={card.id}
                        onMouseEnter={() => onPointAt?.(card)}
                        onMouseLeave={() => onPointAt?.(null)}
                        onFocusCapture={() => onPointAt?.(card)}
                        onBlurCapture={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onPointAt?.(null);
                        }}
                        className={cn("flex flex-col p-4 pb-3.5", i > 0 && "border-t border-black/10")}>
                        <div className="flex items-center gap-2.5">
                          {card.n !== null ? (
                            <span className="grid h-[22px] w-[22px] flex-none place-content-center rounded-full bg-[#222325] text-[11px] font-extrabold text-white">
                              {card.n}
                            </span>
                          ) : (
                            Icon && (
                              <span className="grid h-[22px] w-[22px] flex-none place-content-center rounded-full bg-[#e1f073]">
                                <Icon aria-hidden className="h-3 w-3 text-primary" strokeWidth={2.4} />
                              </span>
                            )
                          )}
                          <span className="min-w-0 flex-1 text-sm font-extrabold leading-snug text-primary">{card.title}</span>
                          {card.where && <em className="max-w-[40%] flex-none truncate text-xs text-[#5f6062]">{card.where}</em>}
                          <button
                            type="button"
                            aria-label={open ? "Collapse" : "Expand"}
                            aria-expanded={open}
                            onClick={() => toggleFold(card.id)}
                            className="grid h-7 w-7 flex-none cursor-pointer place-content-center rounded-md text-primary transition-colors hover:bg-[#f6f6f6]">
                            <Chevron open={open} />
                          </button>
                        </div>

                        {/* pb-0.5: room for the button's hard shadow, which the fold clips. */}
                        <Collapse open={open}>
                          <div className="flex flex-col gap-2.5 pt-2.5 pb-0.5">
                            {card.terms && card.terms.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {card.terms.map((term) => (
                                  <span key={term} className="rounded-full bg-[#f0f0ea] px-2.5 py-1 text-xs font-semibold text-primary">
                                    {term}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* A rewrite is shown whole before it is used: the line it
                                replaces, and the line it would become. */}
                            {card.rewrite ? (
                              <div
                                title={card.rewrite.why || undefined}
                                className="flex flex-col gap-1.5 rounded-[10px] bg-[#f6f6f6] p-3 text-[12.5px] leading-normal">
                                <span className="text-[#5f6062] line-through">{card.rewrite.before}</span>
                                <span className="font-bold text-primary">{card.rewrite.after}</span>
                              </div>
                            ) : (
                              <p className="text-xs leading-relaxed text-[#5f6062]">{card.detail}</p>
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
                                  // One AI run at a time, whoever started it: a second one
                                  // would supersede the first after its credit was spent.
                                  disabled={aiRunning !== null}
                                  onClick={() => onRunSuggestion(card)}
                                  className={cn(
                                    "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-extrabold br-shadow-press disabled:cursor-default disabled:opacity-50",
                                    card.kind === "rewrite" ? "bg-[#e1f073] text-primary" : "bg-[#222325] text-white br-lime",
                                  )}>
                                  {running ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Working…
                                    </>
                                  ) : (
                                    SUGGESTION_ACTION[card.kind](card)
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDismissSuggestion(card)}
                                  className="h-9 cursor-pointer rounded-lg px-3 text-[13px] font-bold text-[#5f6062] transition-colors hover:text-primary">
                                  Dismiss
                                </button>
                                {tool !== null && (
                                  <span className="ml-auto text-[11px] font-semibold text-[#5f6062]">{SUGGESTION_CREDITS} credit</span>
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
        </div>
      )}

      {/* Ask for a rewrite — the AI service's `ask` tool, on the text as it
          stands. Pinned to the bottom of the rail (owner, 2026-10-04): the
          cards scroll under it, and a backdrop of the page's own colour hides
          them there. The backdrop reaches 10px below the box and is solid up
          to 80% of its height, fading out over the top 20%, so cards run soft
          into it instead of being cut off at an edge. Scrolled to the bottom,
          it simply sits after the last card. */}
      <div className="sticky bottom-0 z-10 mt-auto pt-7 pb-2.5">
        {/* #f6f6f6 is the page's own background, so the fade runs into it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,#f6f6f6_0%,#f6f6f6_80%,transparent_100%)]"
        />
        <div className="relative flex flex-col gap-1.5">
          {askStatus && (
            <div className="mb-1 flex items-start gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2.5">
              <p className="flex-1 text-xs leading-relaxed text-black/65">{askStatus}</p>
              <button
                type="button"
                onClick={onDismissAskStatus}
                aria-label="Dismiss"
                className="flex-none cursor-pointer text-black/35 hover:text-black/60">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <p className="px-1 text-xs text-[#5f6062]">Summary and bullets only, from facts on your resume</p>
          <div className="flex items-center gap-2 rounded-xl bg-white py-1.5 pl-3.5 pr-1.5 br-shadow">
            {asking ? (
              <Loader2 aria-hidden className="h-[15px] w-[15px] flex-none animate-spin text-primary" />
            ) : (
              <Sparkle aria-hidden className="h-[15px] w-[15px] flex-none text-primary" />
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
              placeholder={asking ? "Rewriting your resume…" : "Ask for a rewrite…"}
              className="h-8 min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-black/45"
            />
            <button
              type="button"
              onClick={onAskSubmit}
              disabled={!askInput.trim() || aiRunning !== null}
              aria-label={`Send · ${SUGGESTION_CREDITS} credit`}
              title={`Send · ${SUGGESTION_CREDITS} credit`}
              className="grid h-8 w-8 flex-none cursor-pointer place-content-center rounded-[9px] bg-[#222325] transition-opacity disabled:cursor-default disabled:opacity-40">
              {asking ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#e1f073]" />
              ) : (
                <ArrowUp className="h-4 w-4 text-[#e1f073]" strokeWidth={2.2} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiAssistRail;
