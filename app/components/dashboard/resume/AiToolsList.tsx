"use client";

// AI Tools tab's left-sidebar action list. No longer theater: every Run is
// wired to a real transform in `lib/dashboard/resume/ai-tools` and the paper
// preview changes the moment one lands. Two tools open inline pickers —
// Rewrite offers three takes to choose from, Quantify lists per-bullet
// upgrades to apply one by one.

import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Hash, PenLine, Scissors, SpellCheck2, Tag, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuantifySuggestion, RewriteVariant } from "@/app/lib/dashboard/resume/ai-tools";

interface AiToolAction {
  id: string;
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
      return (
        <div key={action.id} data-tool={action.id} className="rounded-xl border border-black/8 p-3">
          <div className="flex items-start gap-2.5">
            <div className="h-8 w-8 flex-none rounded-lg bg-[#f0f0ea] flex items-center justify-center">
              <action.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-primary leading-tight">{action.label}</p>
              <p className="text-[11px] text-black/45 leading-snug mt-0.5">{action.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRun(action.id)}
            disabled={running}
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
