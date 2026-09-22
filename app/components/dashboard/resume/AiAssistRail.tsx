"use client";

// The match-score / suggestion-cards / ask-for-rewrite right rail, shown on
// the Overview, Content and AI Tools tabs (Customize gets the settings rail
// instead — see ResumeScreenBody).
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
// ── The suggestion cards are the check's findings ──────────────────────────
// Derived from the standing scan by `check-suggestions.ts` — the keywords it
// found missing, the bullet rewrites its write-up proposed, a metric in the
// "needs work" band with the evidence for it — each wired to the tool that
// acts on it. No check, no cards: they used to be fixed mock findings shown on
// any checked resume, whatever the check had actually said.
//
// ── "Ask for a rewrite…" is real ────────────────────────────────────────────
// The instruction goes to the AI service's `ask` tool (1 credit, charged only
// for a usable result); the screen merges the narrow diff that comes back and
// writes the caption from the service's counts.

import type { FC } from "react";
import Link from "next/link";
import { Check, Loader2, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import TimeAgo from "timeago-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { ATS_BILLING_HREF, SCAN_CREDITS, keywordLabel, missingGaps, scanTier, type ScanFailure } from "@/app/lib/ats/api";
import { MAX_ASK_INSTRUCTION_CHARS, SUGGESTION_CREDITS, type SuggestionTool } from "@/app/lib/resume/ai";
import type { CheckStatus } from "@/hooks/mutations/useCheckResume";
import type { ResumeCheck } from "./resume-document";
import type { CheckSuggestion } from "./check-suggestions";

/** The tool a card runs, when it runs one — for its busy state. A rewrite is applied locally and has none. */
const SUGGESTION_TOOL: Record<CheckSuggestion["kind"], SuggestionTool | null> = {
  keywords: "keywords",
  quantify: "quantify",
  shorten: "shorten",
  rewrite: null,
};

/** A card's button, its price on it when it spends one. The scan's own rewrites were paid for with the check. */
const SUGGESTION_ACTION: Record<CheckSuggestion["kind"], (s: CheckSuggestion) => string> = {
  keywords: (s) => `${(s.terms?.length ?? 0) === 1 ? "Add it" : "Add them"} · ${SUGGESTION_CREDITS} credit`,
  rewrite: () => "Use this line",
  quantify: () => `Suggest numbers · ${SUGGESTION_CREDITS} credit`,
  shorten: () => `Shorten · ${SUGGESTION_CREDITS} credit`,
};

/** More chips than this is a list, not a glance. The ATS screen has the whole report. */
const MAX_GAP_CHIPS = 6;

const TIER_CLASS: Record<ReturnType<typeof scanTier>["tone"], string> = {
  positive: "text-[#6c7a1e]",
  neutral: "text-primary",
  urgent: "text-[#b23c26]",
};

const PHASE_COPY: Partial<Record<CheckStatus, string>> = {
  preparing: "Reading your resume…",
  scoring: "Scoring…",
};

export interface AiAssistRailProps {
  isBlank: boolean;
  /** What the standing check found worth acting on — its findings, never a default. Empty with no check. */
  suggestions: CheckSuggestion[];
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
  /** The AI tool out right now, if any. One at a time: every paid action here waits for it. */
  aiRunning: SuggestionTool | null;
  askInput: string;
  onAskInputChange: (value: string) => void;
  onAskSubmit: () => void;
  askStatus: string | null;
  onDismissAskStatus: () => void;
}

/** A text button in the card's house style, carrying its price when it has one. */
const CheckButton: FC<{ onClick: () => void; disabled?: boolean; children: string }> = ({ onClick, disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="cursor-pointer font-bold text-primary underline decoration-2 underline-offset-2 transition-colors hover:decoration-[#6c7a1e] disabled:cursor-default disabled:opacity-40">
    {children}
  </button>
);

const AiAssistRail: FC<AiAssistRailProps> = ({
  isBlank,
  suggestions,
  check,
  stale,
  checkStatus,
  checkFailure,
  onRemoveCheck,
  onCheckGeneral,
  onCheckAgainstJob,
  onRecheck,
  onDismissCheckFailure,
  suggestionOutcomes,
  onRunSuggestion,
  aiRunning,
  askInput,
  onAskInputChange,
  onAskSubmit,
  askStatus,
  onDismissAskStatus,
}) => {
  const checking = checkStatus === "preparing" || checkStatus === "scoring";
  const report = check?.report ?? null;
  const tier = report ? scanTier(report.score) : null;
  const gaps = report ? missingGaps(report).slice(0, MAX_GAP_CHIPS) : [];
  const asking = aiRunning === "ask";
  // A rewrite whose line has been edited away can no longer be applied; it
  // stays only to show it was, if it was.
  const cards = suggestions.filter((s) => s.kind !== "rewrite" || s.rewrite?.at || suggestionOutcomes[s.id]);

  if (isBlank) {
    return (
      <div className="flex flex-col gap-4">
        <DashCard className="border-2 border-[#222325] p-4">
          <p className="text-[13px] font-bold text-primary">ATS score</p>
          <div className="flex items-baseline gap-2 mt-3 mb-2.5">
            <span className="text-[32px] font-bold text-black/30 leading-none">—</span>
            <span className="text-sm text-black/50">/ 100</span>
          </div>
          <p className="text-xs text-black/55 mt-2">Add a summary, experience, or skills to see an ATS score here.</p>
        </DashCard>

        <DashCard className="border-2 border-[#222325] p-3.5">
          <p className="text-sm font-bold text-primary">Nothing to suggest yet</p>
          <p className="text-xs text-black/60 leading-relaxed mt-1">
            Once you&apos;ve added some content, we&apos;ll surface suggestions to strengthen this resume — and you can tailor it to a specific job from
            the AI Tools tab.
          </p>
        </DashCard>
      </div>
    );
  }

  return (
    <div className="scrollbar-neo flex flex-col gap-4 max-h-[calc(100vh-112px)] overflow-y-auto pr-1">
      {/* ATS score — a standing check, or the two ways to run one. The card
          names the JOB it was scored against, never the document's own label. */}
      <DashCard className="border-2 border-[#222325] p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[13px] font-bold text-primary">ATS score</p>
          {check && !checking && (
            <button
              type="button"
              onClick={onRemoveCheck}
              className="cursor-pointer text-[11px] font-bold text-black/45 underline decoration-2 underline-offset-2 transition-colors hover:text-[#b23c26]">
              Remove
            </button>
          )}
        </div>

        {report && check && tier ? (
          <>
            <div className="flex items-baseline gap-2 mt-3 mb-2.5">
              <span className={cn("text-[32px] font-bold leading-none tabular-nums", stale ? "text-black/30" : "text-primary")}>{report.score}</span>
              <span className="text-sm text-black/50">/ 100</span>
              {!stale && <span className={cn("ml-auto text-xs font-bold", TIER_CLASS[tier.tone])}>{tier.label}</span>}
            </div>
            <ProgressBar value={report.score} />
            <p className="mt-2 text-xs font-semibold text-primary">{check.job ? `Against ${check.job}` : "General score — how it reads for your niche"}</p>

            {stale ? (
              <div className="mt-1.5 rounded-lg bg-[#f6f6f6] px-2.5 py-2 text-xs leading-relaxed text-black/60">
                You&apos;ve edited this resume since it was scanned, so this is the score of an earlier draft.{" "}
                {checking ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {PHASE_COPY[checkStatus]}
                  </span>
                ) : (
                  <CheckButton onClick={onRecheck}>{`Check again · ${SCAN_CREDITS} credit`}</CheckButton>
                )}
              </div>
            ) : (
              <p className="mt-0.5 text-xs text-black/50">
                scanned <TimeAgo datetime={check.at} opts={{ minInterval: 10 }} />
              </p>
            )}

            {/* Scored on the reduced path when a provider was down. Still a
                real score — the service says which part it could not run. */}
            {report.degraded && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-black/50">
                <TriangleAlert className="mt-px h-3 w-3 flex-none" />
                {report.degradedReason ?? "Scored on a reduced path — part of the scorer was unavailable."}
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-black/15">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/50 mb-2">Missing keywords</p>
              {!check.job ? (
                // A general check has no posting, so there is nothing to be
                // missing from — said, rather than shown as an empty list.
                <p className="text-xs leading-relaxed text-black/55">Check it against a job to see which keywords that posting wants.</p>
              ) : gaps.length === 0 ? (
                <p className="text-xs leading-relaxed text-black/55">None — this resume covers what the posting asked for.</p>
              ) : (
                <>
                  {/* Read-only: what the scan found missing. Adding them is the
                      AI rail's job — it works each one into your summary in
                      your own voice, where a chip could only append a word. */}
                  <div className="flex flex-wrap gap-1.5">
                    {gaps.map((gap) => (
                      <span
                        key={gap.id}
                        className="inline-flex items-center rounded-full border border-dashed border-black/25 px-2.5 py-1 text-xs font-semibold text-black/55">
                        {keywordLabel(gap.label)}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-black/45">
                    Work them in with <span className="font-semibold text-black/60">Add missing keywords</span> in AI Tools.
                  </p>
                </>
              )}
            </div>
          </>
        ) : checking ? (
          <div className="flex items-center gap-2 mt-3 mb-1 text-sm text-black/55">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {PHASE_COPY[checkStatus]}
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mt-3 mb-2.5">
              <span className="text-[32px] font-bold text-black/30 leading-none">—</span>
              <span className="text-sm text-black/50">/ 100</span>
            </div>
            <p className="text-xs leading-relaxed text-black/55">No check standing. See how this resume reads to applicant tracking systems:</p>
            <div className="mt-2.5 flex items-center gap-3 text-xs">
              <CheckButton onClick={onCheckGeneral}>General score</CheckButton>
              <span className="text-black/40">or</span>
              <CheckButton onClick={onCheckAgainstJob}>Against a job</CheckButton>
              <Pill variant="outline-dashed" className="ml-auto flex-none">
                {SCAN_CREDITS} credit
              </Pill>
            </div>
          </>
        )}

        {/* A refusal, where the score would have been. Inline rather than a
            toast: the way forward depends on why, and it belongs to this card. */}
        {checkFailure && !checking && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-black/15 bg-[#fbfbf7] px-2.5 py-2">
            <p className="flex-1 text-xs leading-relaxed text-primary">
              {checkFailure.message}{" "}
              {checkFailure.kind === "credits" && (
                <Link href={ATS_BILLING_HREF} className="font-bold underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
                  Top up credits
                </Link>
              )}
            </p>
            <button type="button" onClick={onDismissCheckFailure} className="flex-none cursor-pointer text-black/35 hover:text-black/60" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </DashCard>

      {/* Suggestion cards — the standing check's findings. Without one there
          is nothing to claim about this resume, so the rail says how to get some. */}
      {cards.length > 0 ? (
        <div className="flex flex-col gap-3">
          {stale && (
            <p className="px-1 text-[11px] leading-snug text-black/45">From the check of an earlier draft — each one is re-read against your resume as it is now.</p>
          )}
          {cards.map((suggestion) => {
            const outcome = suggestionOutcomes[suggestion.id];
            const tool = SUGGESTION_TOOL[suggestion.kind];
            const running = tool !== null && aiRunning === tool;
            return (
              <DashCard key={suggestion.id} className="border-2 border-[#222325] p-3.5">
                <p className="text-sm font-bold text-primary">{suggestion.title}</p>
                <p className="text-xs text-black/60 leading-relaxed mt-1">{suggestion.detail}</p>
                {/* A rewrite is shown whole before it is used: the line it
                    replaces, and the line it would become. */}
                {suggestion.rewrite && (
                  <div className="mt-2.5 rounded-lg bg-[#f6f6f6] px-3 py-2.5 text-xs leading-relaxed">
                    <p className="text-black/45 line-through">{suggestion.rewrite.before}</p>
                    <p className="mt-1 font-semibold text-primary">{suggestion.rewrite.after}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 mt-3">
                  {outcome ? (
                    <p className="flex items-start gap-1.5 text-xs font-semibold text-[#6c7a1e]">
                      <Check className="mt-px h-3.5 w-3.5 flex-none" />
                      {outcome}
                    </p>
                  ) : (
                    <StickerButton
                      type="button"
                      variant="primary"
                      size="sm"
                      // One AI run at a time, whoever started it: a second one
                      // would supersede the first after its credit was spent.
                      disabled={aiRunning !== null}
                      onClick={() => onRunSuggestion(suggestion)}>
                      {running ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Working…
                        </>
                      ) : (
                        SUGGESTION_ACTION[suggestion.kind](suggestion)
                      )}
                    </StickerButton>
                  )}
                </div>
              </DashCard>
            );
          })}
        </div>
      ) : (
        <DashCard className="border-2 border-[#222325] p-3.5">
          {/* The write-up — and the rewrites that come with it — lands after
              the score, so "nothing found" waits until it has. */}
          {check && checkStatus === "explaining" ? (
            <p className="flex items-center gap-2 text-xs text-black/55">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Reading through this check for what to fix…
            </p>
          ) : (
            <>
              <p className="text-sm font-bold text-primary">{check ? "Nothing to fix from this check" : "Nothing to suggest yet"}</p>
              <p className="text-xs text-black/60 leading-relaxed mt-1">
                {check
                  ? check.job
                    ? "It found no missing keywords, bullet rewrites or weak spots to act on."
                    : "A general check found no weak spots to act on. Check it against a job to see what a posting wants."
                  : "Check this resume against a job and we'll surface what to strengthen for it here."}
              </p>
            </>
          )}
        </DashCard>
      )}

      {/* Ask for a rewrite — the AI service's `ask` tool, on the text as it
          stands. The price is on the box, before it is spent. */}
      <DashCard className="border-2 border-[#222325] p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-black/20 bg-[#fbfbf7] px-3.5 py-2.5">
            {asking ? <Loader2 className="h-4 w-4 flex-none animate-spin text-black/50" /> : <Sparkles className="h-4 w-4 flex-none text-black/50" />}
            <input
              type="text"
              value={askInput}
              onChange={(e) => onAskInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAskSubmit();
              }}
              maxLength={MAX_ASK_INSTRUCTION_CHARS}
              disabled={asking}
              aria-label="Tell the AI how to rewrite your resume"
              placeholder={asking ? "Rewriting your resume…" : "Ask for a rewrite…"}
              className="flex-1 min-w-0 bg-transparent text-sm text-primary placeholder:text-black/45 outline-none"
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-black/45">
          Summary and bullets only, from facts already on your resume · {SUGGESTION_CREDITS} credit
        </p>
        <button
          type="button"
          onClick={onAskSubmit}
          disabled={!askInput.trim() || aiRunning !== null}
          className="mt-2.5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-white text-xs font-semibold py-2 disabled:opacity-40 disabled:cursor-default cursor-pointer hover:bg-black transition-colors">
          {asking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {asking ? "Rewriting…" : "Send"}
        </button>
        {askStatus && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f0f0ea] px-3.5 py-2.5">
            <p className="text-xs text-black/60 leading-relaxed flex-1">{askStatus}</p>
            <button type="button" onClick={onDismissAskStatus} className="flex-none text-black/35 hover:text-black/60 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </DashCard>
    </div>
  );
};

export default AiAssistRail;
