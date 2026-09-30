"use client";

// AI Tools tab's left-sidebar action list. Every Run is wired to the AI
// service through `lib/resume/ai`, and the paper preview changes the moment one
// lands. Two tools open inline pickers — Rewrite offers three takes to choose
// from, Quantify lists per-bullet upgrades to apply one by one.
//
// Each tool that spends a credit says so on its own card rather than once in a
// footnote — a button that quietly charges for a click is the thing worth
// avoiding here. All six do now; `costsCredit` decides, so a free tool would
// lose its pill without a change to this file.

import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Hash, Loader2, PenLine, Scissors, SpellCheck2, Tag, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import Pill from "@/app/components/dashboard/ui/Pill";
import { SUGGESTION_CREDITS, costsCredit, type SuggestionTool } from "@/app/lib/resume/ai";
import type { QuantifySuggestion, RewriteVariant } from "@/app/lib/dashboard/resume/ai-tools";

interface AiToolAction {
  id: SuggestionTool;
  icon: LucideIcon;
  label: string;
  description: string;
}

const AI_TOOLS_ACTIONS: AiToolAction[] = [
  { id: "tailor", icon: Target, label: "Tailor to a job", description: "Rewrite key phrases to match a specific job description." },
  { id: "rewrite", icon: PenLine, label: "Rewrite a section", description: "Pick a section and get 3 fresh phrasings to choose from." },
  { id: "keywords", icon: Tag, label: "Add missing keywords", description: "Insert keywords the JD wants that your resume is missing." },
  { id: "quantify", icon: Hash, label: "Quantify my bullets", description: "Turn task-shaped bullets into ones with a measurable result." },
  { id: "shorten", icon: Scissors, label: "Shorten to one page", description: "Tighten wording and trim lower-impact lines to fit one page." },
  { id: "tone", icon: SpellCheck2, label: "Fix tone & grammar", description: "Catch typos, awkward phrasing, and inconsistent tense." },
];

export interface AiToolsListProps {
  aiRunning: string | null;
  aiDone: Set<string>;
  /** Live per-tool result captions — what actually happened, not canned copy. */
  captions: Record<string, string | undefined>;
  onRun: (id: string) => void;
  /** A job Tailor already has from a link. Run tailors to it; the picker is still one click away. */
  tailorFor?: { status: "loading" | "ready" | "failed"; label: string } | null;
  onPickTailorJob?: () => void;
  /** Rewrite's three takes, once generated; choosing applies to the Summary. */
  rewriteVariants: RewriteVariant[] | null;
  onUseRewrite: (index: number) => void;
  /** Quantify's per-bullet upgrades and which have been applied. */
  quantify: QuantifySuggestion[] | null;
  quantifyApplied: Set<number>;
  onApplyQuantify: (index: number) => void;
  onApplyAllQuantify: () => void;
}

const AiToolsList: FC<AiToolsListProps> = ({
  aiRunning,
  aiDone,
  captions,
  onRun,
  tailorFor = null,
  onPickTailorJob,
  rewriteVariants,
  onUseRewrite,
  quantify,
  quantifyApplied,
  onApplyQuantify,
  onApplyAllQuantify,
}) => (
  <div className="flex flex-col gap-2.5">
    {AI_TOOLS_ACTIONS.map((action) => {
      const running = aiRunning === action.id;
      const done = aiDone.has(action.id);
      const caption = captions[action.id];
      const preset = action.id === "tailor" ? tailorFor : null;
      return (
        <div
          key={action.id}
          data-tool={action.id}
          className={cn("rounded-xl border border-black/8 p-3", preset && "border-[#222325] shadow-[3px_3px_0_0_#e1f073]")}>
          <div className="flex items-start gap-2.5">
            <div className="h-8 w-8 flex-none rounded-lg bg-[#f0f0ea] flex items-center justify-center">
              <action.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-bold text-primary leading-tight">{action.label}</p>
                {costsCredit(action.id) && (
                  <Pill variant="outline-dashed" className="flex-none">
                    {SUGGESTION_CREDITS} credit
                  </Pill>
                )}
              </div>
              <p className="text-[11px] text-black/45 leading-snug mt-0.5">{action.description}</p>
            </div>
          </div>
          {preset && (
            <div className="mt-2.5 rounded-lg bg-[#f6f6f6] px-2.5 py-2 text-[11px] leading-snug text-black/60">
              {preset.status === "loading" ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading {preset.label}…
                </span>
              ) : preset.status === "failed" ? (
                <>We couldn&apos;t load {preset.label}. Run to pick the job instead.</>
              ) : (
                <>
                  For <span className="font-bold text-primary">{preset.label}</span>
                  {onPickTailorJob && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        onClick={onPickTailorJob}
                        disabled={running}
                        className="cursor-pointer font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e] disabled:cursor-default disabled:opacity-40">
                        Tailor to a different job
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => onRun(action.id)}
            disabled={running || preset?.status === "loading"}
            className={cn(
              "mt-2.5 w-full rounded-lg py-1.5 text-xs font-semibold cursor-pointer transition-colors disabled:cursor-default",
              done ? "bg-[#f0f0ea] text-black/45" : "bg-primary text-white hover:bg-black"
            )}>
            {running ? "Running…" : done ? "Run again" : "Run"}
          </button>
          {caption && !running && <p className="mt-1.5 text-[11px] font-medium text-[#6c7a1e]">{caption}</p>}

          {/* Rewrite — the three takes, choose one. */}
          {action.id === "rewrite" && rewriteVariants && !running && (
            <div className="mt-2.5 flex flex-col gap-2">
              {rewriteVariants.map((v, i) => (
                <div key={v.style} className="rounded-lg border border-black/10 bg-[#fbfbf7] p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-black/45">{v.style}</p>
                  <p className="mt-1 text-[11px] leading-snug text-black/70">{v.text}</p>
                  <button
                    type="button"
                    onClick={() => onUseRewrite(i)}
                    className="mt-1.5 cursor-pointer text-[11px] font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
                    Use this one
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quantify — per-bullet upgrades. */}
          {action.id === "quantify" && quantify && quantify.length > 0 && !running && (
            <div className="mt-2.5 flex flex-col gap-2">
              {quantify.map((q, i) => {
                const applied = quantifyApplied.has(i);
                return (
                  <div key={`${q.entryIndex}-${q.bulletIndex}`} className="rounded-lg border border-black/10 bg-[#fbfbf7] p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-black/45">{q.role}</p>
                    <p className="mt-1 text-[11px] leading-snug text-black/45 line-through">{q.before}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-black/75">{q.after}</p>
                    <button
                      type="button"
                      disabled={applied}
                      onClick={() => onApplyQuantify(i)}
                      className={cn(
                        "mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold",
                        applied
                          ? "cursor-default text-[#6c7a1e]"
                          : "cursor-pointer text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]"
                      )}>
                      {applied ? (
                        <>
                          <Check className="h-3 w-3" /> Applied
                        </>
                      ) : (
                        "Apply"
                      )}
                    </button>
                  </div>
                );
              })}
              {quantify.some((_, i) => !quantifyApplied.has(i)) && (
                <button
                  type="button"
                  onClick={onApplyAllQuantify}
                  className="cursor-pointer rounded-lg border border-black/15 py-1.5 text-[11px] font-bold text-primary transition-colors hover:border-[#222325]">
                  Apply all
                </button>
              )}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export default AiToolsList;
