"use client";

// AI Tools tab's left column. Every Run is wired to the AI service through
// `lib/resume/ai`, and the paper preview changes the moment one lands. Two
// tools open inline pickers — Rewrite offers three takes to choose from,
// Quantify lists per-bullet upgrades to apply one by one.
//
// The owner's 2026-10-04 layout: one card in two groups. "Match the job" leads
// with Tailor, featured, and the posting it will use; "Polish the writing"
// holds the rest as rows with a Run button. Every tool costs the same credit,
// so the price is said once, beside the heading. Pointing at a tool, a take or
// a proposed bullet frames what it would change on the paper (`onPointAt`).

import type { FC, FocusEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Hash, Loader2, PenLine, Scissors, SpellCheck2, Tag, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUGGESTION_CREDITS, type SuggestionTool } from "@/app/lib/resume/ai";
import type { QuantifySuggestion, RewriteVariant } from "@/app/lib/dashboard/resume/ai-tools";

/** What a control in this column is about, for the preview's frame. */
export type AiToolPointer = { tool: SuggestionTool } | { quantify: number } | { take: true } | null;

interface AiToolAction {
  id: Exclude<SuggestionTool, "ask">;
  icon: LucideIcon;
  label: string;
  description: string;
}

const MATCH_ROWS: AiToolAction[] = [
  { id: "keywords", icon: Tag, label: "Add missing keywords", description: "Work in what the posting asks for." },
];

const POLISH_ROWS: AiToolAction[] = [
  { id: "rewrite", icon: PenLine, label: "Rewrite a section", description: "3 fresh phrasings to choose from." },
  { id: "quantify", icon: Hash, label: "Quantify my bullets", description: "Turn tasks into measurable results." },
  { id: "shorten", icon: Scissors, label: "Shorten to one page", description: "Tighten wording and trim lower-impact lines." },
  { id: "tone", icon: SpellCheck2, label: "Fix tone & grammar", description: "Typos, awkward phrasing, mixed tense." },
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
  /** Missing keywords the standing job check found, when there is one — said on the keywords row. */
  keywordsFound?: number | null;
  /** The page count the preview measures — said on the shorten row when it runs long. */
  pageCount?: number;
  /** What the pointer or focus is on, so the preview can frame it; null when it leaves. */
  onPointAt?: (pointer: AiToolPointer) => void;
}

const GROUP_LABEL_CLASS = "px-2.5 pb-1.5 pt-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f6062]";

const RUN_BUTTON_CLASS =
  "inline-flex h-10 flex-none cursor-pointer items-center gap-1.5 rounded-[10px] border border-black/[0.22] bg-white px-4 text-[13px] font-bold text-primary transition-colors hover:border-[#222325] disabled:cursor-default disabled:opacity-50";

/** Pointer handlers for one block: enter or focus points at it, leaving (pointer and focus both) lets go. */
const pointing = (onPointAt: AiToolsListProps["onPointAt"], pointer: AiToolPointer) => ({
  onMouseEnter: () => onPointAt?.(pointer),
  onMouseLeave: () => onPointAt?.(null),
  onFocusCapture: () => onPointAt?.(pointer),
  onBlurCapture: (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onPointAt?.(null);
  },
});

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
  keywordsFound = null,
  pageCount = 1,
  onPointAt,
}) => {
  const tailorRunning = aiRunning === "tailor";
  const tailorCaption = captions.tailor;

  /** A row's own line under its name, with what this resume's numbers say where they say something. */
  const describe = (action: AiToolAction) => {
    if (action.id === "keywords" && keywordsFound) return `${keywordsFound} found by your last check.`;
    if (action.id === "shorten" && pageCount > 1) return `It runs to ${pageCount} pages now.`;
    return action.description;
  };

  const row = (action: AiToolAction) => {
    const running = aiRunning === action.id;
    const done = aiDone.has(action.id);
    const caption = captions[action.id];
    return (
      <div key={action.id} data-tool={action.id} {...pointing(onPointAt, { tool: action.id })} className="flex flex-col gap-2.5 p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 flex-none place-content-center rounded-[10px] bg-[#f0f0ea]">
            <action.icon className="h-[17px] w-[17px] text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-primary">{action.label}</p>
            <p className="text-xs leading-snug text-[#5f6062]">{describe(action)}</p>
          </div>
          <button type="button" onClick={() => onRun(action.id)} disabled={running} className={RUN_BUTTON_CLASS}>
            {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {running ? "Running…" : done ? "Run again" : "Run"}
          </button>
        </div>
        {caption && !running && <p className="pl-12 text-xs font-medium leading-snug text-[#6c7a1e]">{caption}</p>}

        {/* Rewrite — the three takes, choose one. */}
        {action.id === "rewrite" && rewriteVariants && !running && (
          <div className="flex flex-col gap-2 pl-12" {...pointing(onPointAt, { take: true })}>
            {rewriteVariants.map((v, i) => (
              <div key={v.style} className="rounded-[10px] bg-[#f6f6f6] p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#5f6062]">{v.style}</p>
                <p className="mt-1 text-xs leading-snug text-black/75">{v.text}</p>
                <button
                  type="button"
                  onClick={() => onUseRewrite(i)}
                  className="mt-1.5 cursor-pointer text-xs font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
                  Use this one
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quantify — per-bullet upgrades, each pointing at its line. */}
        {action.id === "quantify" && quantify && quantify.length > 0 && !running && (
          <div className="flex flex-col gap-2 pl-12">
            {quantify.map((q, i) => {
              const applied = quantifyApplied.has(i);
              return (
                <div key={`${q.entryIndex}-${q.bulletIndex}`} {...pointing(onPointAt, { quantify: i })} className="rounded-[10px] bg-[#f6f6f6] p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#5f6062]">{q.role}</p>
                  <p className="mt-1 text-xs leading-snug text-[#5f6062] line-through">{q.before}</p>
                  <p className="mt-0.5 text-xs font-semibold leading-snug text-primary">{q.after}</p>
                  <button
                    type="button"
                    disabled={applied}
                    onClick={() => onApplyQuantify(i)}
                    className={cn(
                      "mt-1.5 inline-flex items-center gap-1 text-xs font-bold",
                      applied
                        ? "cursor-default text-[#6c7a1e]"
                        : "cursor-pointer text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]",
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
                className="h-9 cursor-pointer rounded-[10px] border border-black/[0.22] text-xs font-bold text-primary transition-colors hover:border-[#222325]">
                Apply all
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section aria-label="AI tools" className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-lg font-extrabold tracking-[-0.01em] text-primary">AI tools</h2>
        <span className="text-xs font-semibold text-[#5f6062]">
          {SUGGESTION_CREDITS} credit per run
        </span>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-2">
        <p className={GROUP_LABEL_CLASS}>Match the job</p>

        {/* Tailor, featured: the posting it will use, and one button. */}
        <div data-tool="tailor" {...pointing(onPointAt, { tool: "tailor" })} className="flex flex-col gap-2.5 rounded-xl bg-white p-3 br-shadow br-lime">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 flex-none place-content-center rounded-[10px] bg-[#e1f073]">
              <Target className="h-[17px] w-[17px] text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold leading-snug text-primary">Tailor to a job</p>
              <p className="text-xs leading-snug text-[#5f6062]">Rewrite key phrases to match the posting.</p>
            </div>
          </div>
          {tailorFor && (
            <div className="rounded-lg bg-[#f6f6f6] px-2.5 py-2 text-xs leading-snug text-[#55564f]">
              {tailorFor.status === "loading" ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading {tailorFor.label}…
                </span>
              ) : tailorFor.status === "failed" ? (
                <>We couldn&apos;t load {tailorFor.label}. Run to pick the job instead.</>
              ) : (
                <>
                  For <strong className="text-primary">{tailorFor.label}</strong>
                  {onPickTailorJob && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        onClick={onPickTailorJob}
                        disabled={tailorRunning}
                        className="cursor-pointer font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e] disabled:cursor-default disabled:opacity-40">
                        Change job
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => onRun("tailor")}
            disabled={tailorRunning || tailorFor?.status === "loading"}
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#222325] text-[13px] font-bold text-white transition-colors hover:bg-black disabled:cursor-default disabled:opacity-60">
            {tailorRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {tailorRunning
              ? "Tailoring…"
              : tailorFor?.status === "ready"
                ? aiDone.has("tailor")
                  ? "Tailor again"
                  : "Tailor to this job"
                : "Pick a job to tailor to"}
          </button>
          {tailorCaption && !tailorRunning && <p className="text-xs font-medium leading-snug text-[#6c7a1e]">{tailorCaption}</p>}
        </div>

        {MATCH_ROWS.map(row)}

        <div className="mx-2.5 my-1.5 h-px bg-black/10" />
        <p className={cn(GROUP_LABEL_CLASS, "pb-0.5")}>Polish the writing</p>
        {POLISH_ROWS.map(row)}
      </div>
    </section>
  );
};

export default AiToolsList;
