"use client";

// The match-score / suggestion-cards / ask-for-rewrite right rail, shown on
// the Overview, Content and AI Tools tabs (Customize gets the settings rail
// instead — see ResumeScreenBody). Unchanged in spirit from the old screen;
// only the data source moved from a single shared `docContent`/`currentRole`
// to explicit props off the active `ResumeDocument`.

import type { FC } from "react";
import { Check, Plus, Send, Sparkles, X } from "lucide-react";
import TimeAgo from "timeago-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { ATS_FIX_ITEMS, ATS_KEYWORDS } from "@/app/lib/dashboard/mock-data";

const SUGGESTION_ITEMS = ATS_FIX_ITEMS.filter((f) => f.id === "fix-keyword" || f.id === "fix-skills");

export interface AiAssistRailProps {
  docLabel: string;
  isBlank: boolean;
  displayScore: number;
  before: number | null;
  /** When the tailoring pass ran — shown as a live time-ago next to `before`. */
  tailoredAt: Date | null;
  /** Clears the tailoring result so another check can run clean. */
  onClearTailoring: () => void;
  keywordsAdded: Set<string>;
  onToggleKeyword: (id: string) => void;
  appliedSuggestions: Set<string>;
  expandedSuggestions: Set<string>;
  onApplySuggestion: (id: string) => void;
  onToggleExpandedSuggestion: (id: string) => void;
  askInput: string;
  onAskInputChange: (value: string) => void;
  onAskSubmit: () => void;
  askStatus: string | null;
  onDismissAskStatus: () => void;
}

const AiAssistRail: FC<AiAssistRailProps> = ({
  docLabel,
  isBlank,
  displayScore,
  before,
  tailoredAt,
  onClearTailoring,
  keywordsAdded,
  onToggleKeyword,
  appliedSuggestions,
  expandedSuggestions,
  onApplySuggestion,
  onToggleExpandedSuggestion,
  askInput,
  onAskInputChange,
  onAskSubmit,
  askStatus,
  onDismissAskStatus,
}) => {
  const missingKeywords = ATS_KEYWORDS.filter((k) => !k.present).slice(0, 2);

  if (isBlank) {
    return (
      <div className="flex flex-col gap-4">
        <DashCard className="border-2 border-[#222325] p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[13px] font-bold text-primary">Match score</p>
            <Pill variant="neutral">{docLabel}</Pill>
          </div>
          <div className="flex items-baseline gap-2 mt-3 mb-2.5">
            <span className="text-[32px] font-bold text-black/30 leading-none">—</span>
            <span className="text-sm text-black/50">/ 100</span>
          </div>
          <p className="text-xs text-black/55 mt-2">Add a summary, experience, or skills to see a match score here.</p>
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
      {/* Match score */}
      <DashCard className="border-2 border-[#222325] p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[13px] font-bold text-primary">Match score</p>
          <Pill variant="neutral">{docLabel}</Pill>
        </div>
        <div className="flex items-baseline gap-2 mt-3 mb-2.5">
          <span className="text-[32px] font-bold text-primary leading-none">{displayScore}</span>
          <span className="text-sm text-black/50">/ 100</span>
        </div>
        <ProgressBar value={displayScore} />
        {before !== null ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#6c7a1e]">
              up from {before} — tailored {tailoredAt ? <TimeAgo datetime={tailoredAt} opts={{ minInterval: 10 }} /> : "earlier"}
            </p>
            <button
              type="button"
              onClick={onClearTailoring}
              className="flex-none cursor-pointer text-[11px] font-bold text-black/45 underline decoration-2 underline-offset-2 transition-colors hover:text-[#b23c26]">
              Clear
            </button>
          </div>
        ) : (
          <p className="text-xs text-black/55 mt-2">General score — not yet tailored to a specific job</p>
        )}

        <div className="mt-4 pt-4 border-t border-black/15">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/50 mb-2">Missing keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {missingKeywords.map((kw) => {
              const added = keywordsAdded.has(kw.id);
              return (
                <button
                  key={kw.id}
                  type="button"
                  onClick={() => onToggleKeyword(kw.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors",
                    added ? "bg-secondary text-primary" : "border border-dashed border-black/25 text-black/50 hover:border-black/45"
                  )}>
                  {added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {kw.label}
                </button>
              );
            })}
          </div>
        </div>
      </DashCard>

      {/* Suggestion cards */}
      <div className="flex flex-col gap-3">
        {SUGGESTION_ITEMS.map((item) => {
          const applied = appliedSuggestions.has(item.id);
          const expanded = expandedSuggestions.has(item.id);
          return (
            <DashCard key={item.id} className="border-2 border-[#222325] p-3.5">
              <p className="text-sm font-bold text-primary">{item.label}</p>
              <p className="text-xs text-black/60 leading-relaxed mt-1">{item.detail}</p>
              {expanded && (
                <div className="mt-2.5 rounded-lg bg-[#f6f6f6] px-3 py-2.5 text-xs text-black/55 leading-relaxed">
                  Jump to the {item.id === "fix-keyword" ? "Summary" : "Skills"} section to see exactly what changes.
                </div>
              )}
              <div className="flex items-center gap-3 mt-3">
                <StickerButton
                  type="button"
                  variant={applied ? "outline" : "primary"}
                  size="sm"
                  disabled={applied}
                  onClick={() => onApplySuggestion(item.id)}>
                  {applied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Applied
                    </>
                  ) : (
                    item.action
                  )}
                </StickerButton>
                <button
                  type="button"
                  onClick={() => onToggleExpandedSuggestion(item.id)}
                  className="text-xs font-semibold text-black/60 hover:text-primary cursor-pointer">
                  Show me
                </button>
              </div>
            </DashCard>
          );
        })}
      </div>

      {/* Ask for a rewrite */}
      <DashCard className="border-2 border-[#222325] p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-black/20 bg-[#fbfbf7] px-3.5 py-2.5">
            <Sparkles className="h-4 w-4 flex-none text-black/50" />
            <input
              type="text"
              value={askInput}
              onChange={(e) => onAskInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAskSubmit();
              }}
              placeholder="Ask for a rewrite…"
              className="flex-1 min-w-0 bg-transparent text-sm text-primary placeholder:text-black/45 outline-none"
            />
          </div>
          <Pill variant="outline-dashed" className="flex-none">
            1 credit
          </Pill>
        </div>
        <button
          type="button"
          onClick={onAskSubmit}
          disabled={!askInput.trim()}
          className="mt-2.5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-white text-xs font-semibold py-2 disabled:opacity-40 disabled:cursor-default cursor-pointer hover:bg-black transition-colors">
          <Send className="h-3.5 w-3.5" />
          Send
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
