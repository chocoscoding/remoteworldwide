"use client";

// AI Tools tab's left column, the owner's 2026-10-17 design ("Resume editor — AI Tools"):
//
// - one card: the job set once at the top ("For Role · Company · Change"), then one line per tool
//   with what it already knows before you run it ("12 found", "4 lines lack a number", "Fits ✓");
// - a running tool shows a thin progress line; Rewrite, Quantify and Tone wait for a click on the
//   resume, and their row says so (Esc cancels);
// - only one result card is open at a time, and every one ends in the same footer: the main
//   action, then back/next where there is more than one, then Run again.
//
// Every Run is wired to the AI service through `lib/resume/ai`, and the paper preview changes the
// moment one lands. Pointing at a tool, a take or a proposal frames what it would change on the
// paper (`onPointAt`). Every tool costs the same credit, so the price is said once, in the header.

import {
  useEffect,
  useRef,
  useState,
  type FC,
  type FocusEvent,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Hash,
  Info,
  PenLine,
  Plus,
  RotateCw,
  Scissors,
  SpellCheck2,
  Tag,
  Target,
  X,
} from "lucide-react";
import FreeUsesNote from "@/app/components/dashboard/billing/FreeUsesNote";
import { cn } from "@/lib/utils";
import { SUGGESTION_CREDITS, type SuggestionTool } from "@/app/lib/resume/ai";
import type {
  QuantifySuggestion,
  RewriteVariant,
} from "@/app/lib/dashboard/resume/ai-tools";

/** What a control in this column is about, for the preview's frame. */
export type AiToolPointer =
  | { tool: SuggestionTool }
  | { quantify: number }
  | { keyword: number }
  | { fix: string }
  | { take: true }
  | null;

/** One "Fix tone & grammar" proposal as its card shows it, and what became of it. */
export interface ToneFixRow {
  key: string;
  /** Where it is: "Summary", a role's title, "Skills"… */
  label: string;
  kind: string;
  before: string;
  after: string;
  /** What it would change in `before`, underlined in red on the paper. */
  ranges: [number, number][];
  state: "pending" | "applied" | "dismissed" | "gone";
}

/** One "Add missing keywords" proposal and what was done about it: still waiting, ticked into Skills, or set aside. */
export interface KeywordProposalRow {
  term: string;
  state: "pending" | "added" | "rejected";
}

type ToolId = Exclude<SuggestionTool, "ask">;

interface ToolDef {
  id: ToolId;
  icon: LucideIcon;
  label: string;
  /** The line under the name while it runs. */
  working: string;
}

const TOOLS: Record<ToolId, ToolDef> = {
  tailor: {
    id: "tailor",
    icon: Target,
    label: "Tailor to this job",
    working: "Weaving in the posting's words…",
  },
  keywords: {
    id: "keywords",
    icon: Tag,
    label: "Add missing keywords",
    working: "Reading the posting…",
  },
  rewrite: {
    id: "rewrite",
    icon: PenLine,
    label: "Rewrite",
    working: "Writing three takes…",
  },
  quantify: {
    id: "quantify",
    icon: Hash,
    label: "Quantify",
    working: "Finding where a number fits…",
  },
  shorten: {
    id: "shorten",
    icon: Scissors,
    label: "Shorten to one page",
    working: "Tightening the wording…",
  },
  tone: {
    id: "tone",
    icon: SpellCheck2,
    label: "Fix tone & grammar",
    working: "Reading every line…",
  },
};

export interface AiToolsListProps {
  aiRunning: string | null;
  aiDone: Set<string>;
  /** Live per-tool result captions — what actually happened, not canned copy. */
  captions: Record<string, string | undefined>;
  onRun: (id: string) => void;
  /** A job Tailor already has from a link. Run tailors to it; the picker is still one click away. */
  tailorFor?: { status: "loading" | "ready" | "failed"; label: string } | null;
  /** The job in context, set once at the top for Tailor and Add missing keywords. */
  job?: { role: string; company: string } | null;
  /** Picks the job in context without running anything. */
  onPickJob?: () => void;
  onPickTailorJob?: () => void;
  /** The job "Add missing keywords" will use without asking ("Role at Company"), or null when it will ask. */
  keywordsFor?: string | null;
  onPickKeywordsJob?: () => void;
  /** Rewrite's three takes, once generated. */
  rewriteVariants: RewriteVariant[] | null;
  onUseRewrite: (index: number) => void;
  /** Quantify's per-bullet upgrades and which have been applied. */
  quantify: QuantifySuggestion[] | null;
  quantifyApplied: Set<number>;
  onApplyQuantify: (index: number) => void;
  onApplyAllQuantify: () => void;
  /** Missing keywords the standing job check found, when there is one — said on the keywords row. */
  keywordsFound?: number | null;
  /** Bullets on the resume that carry no number — said on the Quantify row. */
  linesWithoutNumber?: number;
  keywordProposals?: KeywordProposalRow[] | null;
  onAcceptKeyword?: (term: string) => void;
  onRejectKeyword?: (term: string) => void;
  onAcceptAllKeywords?: () => void;
  /** Rewrite, Quantify or Tone waiting for a pick on the page: its row says so and offers Cancel. */
  picking?: "rewrite" | "quantify" | "tone" | null;
  onCancelPick?: () => void;
  toneFixes?: ToneFixRow[] | null;
  onApplyFix?: (key: string) => void;
  onDismissFix?: (key: string) => void;
  onApplyAllFixes?: () => void;
  /** The page count the preview measures — said on the shorten row. */
  pageCount?: number;
  /** What the pointer or focus is on, so the preview can frame it; null when it leaves. */
  onPointAt?: (pointer: AiToolPointer) => void;
  /** Frames a proposal on the paper and scrolls the window to its line (Quantify, as it steps through). */
  onShowOnPaper?: (pointer: AiToolPointer) => void;
}

/** Pointer handlers for one block: enter or focus points at it, leaving (pointer and focus both) lets go. */
const pointing = (
  onPointAt: AiToolsListProps["onPointAt"],
  pointer: AiToolPointer,
) => ({
  onMouseEnter: () => onPointAt?.(pointer),
  onMouseLeave: () => onPointAt?.(null),
  onFocusCapture: () => onPointAt?.(pointer),
  onBlurCapture: (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      onPointAt?.(null);
  },
});

/**
 * A word-level diff of a tone fix, as the design shows it: what goes out struck in red, what comes
 * in on lime, the rest as it was. Longest common subsequence over words, the spaces between and
 * punctuation on its own, so an added full stop shows as just "." rather than the whole last word.
 */
const DIFF_TOKENS = /(\s+|[.,;:!?()[\]"'“”])/;
function wordDiff(before: string, after: string): ReactNode[] {
  const a = before.split(DIFF_TOKENS).filter(Boolean);
  const b = after.split(DIFF_TOKENS).filter(Boolean);
  const n = a.length;
  const m = b.length;
  // Long lines are rare here; past this size the full table isn't worth it, so show before → after.
  if (n * m > 40000)
    return [
      <span
        key="o"
        className="rounded-[3px] bg-[#fbe9e5] px-0.5 text-[#b23c26] line-through"
      >
        {before}
      </span>,
      " ",
      <span
        key="n"
        className="rounded-[3px] bg-[#eef6ad] px-0.5 font-extrabold"
      >
        {after}
      </span>,
    ];
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: ReactNode[] = [];
  let i = 0;
  let j = 0;
  let k = 0;
  const gone = (text: string) =>
    out.push(
      <span
        key={k++}
        className="rounded-[3px] bg-[#fbe9e5] px-0.5 text-[#b23c26] line-through"
      >
        {text}
      </span>,
    );
  const came = (text: string) =>
    out.push(
      <span
        key={k++}
        className="rounded-[3px] bg-[#eef6ad] px-0.5 font-extrabold"
      >
        {text}
      </span>,
    );
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push(a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      if (a[i].trim()) gone(a[i]);
      else out.push(a[i]);
      i++;
    } else {
      if (b[j].trim()) came(b[j]);
      else out.push(b[j]);
      j++;
    }
  }
  while (i < n) a[i].trim() ? gone(a[i++]) : out.push(a[i++]);
  while (j < m) b[j].trim() ? came(b[j++]) : out.push(b[j++]);
  return out;
}

// ── Shared pieces ────────────────────────────────────────────────────────────

const TILE = "grid h-[30px] w-[30px] flex-none place-content-center rounded-lg";

const RUN_BUTTON =
  "inline-flex h-[30px] flex-none cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#222325]/[0.22] bg-white px-2.5 text-xs font-extrabold text-primary transition-colors hover:border-[#222325] disabled:cursor-default disabled:opacity-50";

const MAIN_ACTION =
  "inline-flex h-[30px] flex-none cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-[1.5px] border-[#222325] bg-[#e1f073] px-2.5 text-xs font-extrabold text-primary br-shadow-press disabled:cursor-default disabled:opacity-50";

const QUIET_ACTION =
  "inline-flex h-[30px] flex-none cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-1.5 text-xs font-extrabold text-[#55564f] transition-colors hover:text-primary disabled:cursor-default disabled:opacity-40";

const ICON_ACTION =
  "grid h-[30px] w-[30px] flex-none cursor-pointer place-content-center rounded-lg border border-[#222325]/[0.18] bg-white text-primary transition-colors hover:border-[#222325] disabled:cursor-default disabled:opacity-40";

const GROUP_LABEL =
  "px-2 pb-1.5 pt-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f6062]";

/** A result card: the tool's tile and title, a meta line, collapse, the body and the shared footer. */
const ResultCard: FC<{
  icon: LucideIcon;
  title: ReactNode;
  meta?: ReactNode;
  metaTone?: "muted" | "good";
  onCollapse: () => void;
  footer: ReactNode;
  children?: ReactNode;
}> = ({
  icon: Icon,
  title,
  meta,
  metaTone = "muted",
  onCollapse,
  footer,
  children,
}) => (
  <div className="my-0.5 mb-1.5 flex flex-col gap-2.5 rounded-xl border-[1.5px] border-[#222325] bg-white p-3 br-shadow br-lime">
    <div className="flex items-center gap-2.5">
      <span className="grid h-7 w-7 flex-none place-content-center rounded-lg bg-[#e1f073]">
        <Icon
          aria-hidden
          className="h-3.5 w-3.5 text-primary"
          strokeWidth={2.2}
        />
      </span>
      <span className="min-w-0 flex-1 text-[13px] font-extrabold text-primary">
        {title}
      </span>
      {meta && (
        <span
          className={cn(
            "flex-none text-xs font-bold",
            metaTone === "good" ? "text-[#6c7a1e]" : "text-[#5f6062]",
          )}
        >
          {meta}
        </span>
      )}
      <button
        type="button"
        aria-label="Collapse"
        title="Collapse"
        onClick={onCollapse}
        className="grid h-[26px] w-[26px] flex-none cursor-pointer place-content-center rounded-lg text-primary hover:bg-[#f6f6f6]"
      >
        <ChevronDown className="h-3.5 w-3.5 rotate-180" strokeWidth={2.4} />
      </button>
    </div>
    {children}
    <div className="flex items-center gap-2 border-t border-[#222325]/10 pt-2.5">
      {footer}
    </div>
  </div>
);

const AiToolsList: FC<AiToolsListProps> = ({
  aiRunning,
  aiDone,
  captions,
  onRun,
  tailorFor = null,
  job = null,
  onPickJob,
  onPickTailorJob,
  rewriteVariants,
  onUseRewrite,
  quantify,
  quantifyApplied,
  onApplyQuantify,
  onApplyAllQuantify,
  keywordsFound = null,
  linesWithoutNumber = 0,
  keywordProposals = null,
  onAcceptKeyword,
  onRejectKeyword,
  onAcceptAllKeywords,
  picking = null,
  onCancelPick,
  toneFixes = null,
  onApplyFix,
  onDismissFix,
  onApplyAllFixes,
  pageCount = 1,
  onPointAt,
  onShowOnPaper,
}) => {
  // Only one result card open at a time: the tool that last finished, until it is collapsed.
  const [openTool, setOpenTool] = useState<ToolId | null>(null);
  const lastRunning = useRef<string | null>(aiRunning);
  useEffect(() => {
    const was = lastRunning.current;
    lastRunning.current = aiRunning;
    if (was && was !== "ask" && was !== aiRunning && was in TOOLS)
      setOpenTool(was as ToolId);
  }, [aiRunning]);

  // Per-card navigation.
  const [take, setTake] = useState(0);
  const [qAt, setQAt] = useState(0);
  const [leftOut, setLeftOut] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => setTake(0), [rewriteVariants]);
  useEffect(() => setQAt(0), [quantify]);
  // Quantify steps through its lines one at a time: each one it lands on is framed and scrolled to
  // on the paper (owner, 2026-10-18).
  const quantifyShown = openTool === "quantify" && quantify && quantify.length > 0 ? Math.min(qAt, quantify.length - 1) : null;
  useEffect(() => {
    if (quantifyShown !== null) onShowOnPaper?.({ quantify: quantifyShown });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantifyShown, quantify]);
  useEffect(() => setLeftOut(new Set()), [keywordProposals?.length]);

  // A card closes once its last item is dealt with (owner, 2026-10-18: "once I'm done, it should
  // close"), after a beat for its "Done ✓" to be seen. Only on that change: a finished card opened
  // again stays open, and Undo bringing an item back leaves it for the row to reopen.
  const finished =
    openTool === "tone"
      ? !!toneFixes && toneFixes.length > 0 && !toneFixes.some((row) => row.state === "pending")
      : openTool === "keywords"
        ? !!keywordProposals && keywordProposals.length > 0 && !keywordProposals.some((row) => row.state === "pending")
        : openTool === "quantify"
          ? !!quantify && quantify.length > 0 && quantify.every((_, i) => quantifyApplied.has(i))
          : openTool === "rewrite"
            ? !!captions.rewrite
            : false;
  const wasFinished = useRef({ tool: openTool, done: finished });
  useEffect(() => {
    const was = wasFinished.current;
    wasFinished.current = { tool: openTool, done: finished };
    // Another card just opened, or this one was already done: nothing finished just now.
    if (!openTool || !finished || was.tool !== openTool || was.done) return;
    const tool = openTool;
    const timer = window.setTimeout(() => setOpenTool((now) => (now === tool ? null : now)), 900);
    return () => window.clearTimeout(timer);
  }, [finished, openTool]);

  const busy = aiRunning !== null;
  const hasJob = job !== null || tailorFor?.status === "ready";
  const jobLoading = tailorFor?.status === "loading";

  // ── What each row says before it runs ──────────────────────────────────────
  const hint = (
    id: ToolId,
  ): { text: string; tone: "muted" | "bad" | "good" } | null => {
    switch (id) {
      case "tailor":
        return hasJob
          ? aiDone.has("tailor")
            ? { text: "Done ✓", tone: "good" }
            : null
          : { text: "pick a job", tone: "muted" };
      case "keywords":
        if (!hasJob && !keywordsFound)
          return { text: "pick a job", tone: "muted" };
        return keywordsFound
          ? { text: `${keywordsFound} found`, tone: "bad" }
          : null;
      case "rewrite":
        return { text: "3 takes", tone: "muted" };
      case "quantify":
        return linesWithoutNumber > 0
          ? {
              text: `${linesWithoutNumber} line${linesWithoutNumber === 1 ? " lacks" : "s lack"} a number`,
              tone: "bad",
            }
          : { text: "Every line has one ✓", tone: "good" };
      case "shorten":
        return pageCount > 1
          ? { text: `${pageCount} pages`, tone: "bad" }
          : { text: "Fits ✓", tone: "good" };
      case "tone": {
        const left = (toneFixes ?? []).filter(
          (row) => row.state === "pending",
        ).length;
        return left
          ? { text: `${left} issue${left === 1 ? "" : "s"}`, tone: "bad" }
          : null;
      }
    }
  };

  /** Rows the tool has nothing to do for are faded, as in the design, and still run. */
  const quiet = (id: ToolId) =>
    ((id === "tailor" || id === "keywords") &&
      !hasJob &&
      !(id === "keywords" && keywordsFound)) ||
    (id === "shorten" && pageCount <= 1);

  // ── Result cards ───────────────────────────────────────────────────────────
  const collapse = () => setOpenTool(null);
  const runAgain = (id: ToolId, label = "Run again") => (
    <button
      type="button"
      aria-label={label}
      title={`${label} · ${SUGGESTION_CREDITS} credit`}
      onClick={() => onRun(id)}
      disabled={busy}
      className={ICON_ACTION}
    >
      <RotateCw className="h-3.5 w-3.5" strokeWidth={2.4} />
    </button>
  );

  const card = (id: ToolId): ReactNode => {
    const def = TOOLS[id];
    const caption = captions[id];

    if (id === "keywords" && keywordProposals && keywordProposals.length > 0) {
      const pending = keywordProposals.filter((row) => row.state === "pending");
      const chosen = pending.filter((row) => !leftOut.has(row.term));
      const added = keywordProposals.filter(
        (row) => row.state === "added",
      ).length;
      const toggle = (term: string) =>
        setLeftOut((prev) => {
          const next = new Set(prev);
          if (next.has(term)) next.delete(term);
          else next.add(term);
          return next;
        });
      const addChosen = () => {
        // Left-out terms are set aside (a step Undo reverses); the rest go into Skills together.
        pending
          .filter((row) => leftOut.has(row.term))
          .forEach((row) => onRejectKeyword?.(row.term));
        if (chosen.length === 1) onAcceptKeyword?.(chosen[0].term);
        else if (chosen.length > 1) onAcceptAllKeywords?.();
        setLeftOut(new Set());
      };
      return (
        <ResultCard
          icon={def.icon}
          title={
            pending.length
              ? `${pending.length} missing from the posting`
              : `${added} added to Skills`
          }
          meta={!pending.length && added ? "Done ✓" : undefined}
          metaTone="good"
          onCollapse={collapse}
          footer={
            <>
              {pending.length > 0 && (
                <button
                  type="button"
                  onClick={addChosen}
                  disabled={chosen.length === 0}
                  className={MAIN_ACTION}
                >
                  Add {chosen.length} to Skills
                </button>
              )}
              <span className="flex-1" />
              {runAgain("keywords")}
            </>
          }
        >
          {pending.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-[#5f6062]">
              <span className="flex-1">
                Tap to leave one out. Only add what&apos;s true.
              </span>
              <button
                type="button"
                onClick={() => setLeftOut(new Set())}
                className="cursor-pointer font-extrabold text-primary underline underline-offset-2"
              >
                All
              </button>
              <button
                type="button"
                onClick={() =>
                  setLeftOut(new Set(pending.map((row) => row.term)))
                }
                className="cursor-pointer font-extrabold text-primary underline underline-offset-2"
              >
                None
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {keywordProposals.map((row, i) => {
              if (row.state === "rejected") return null;
              if (row.state === "added")
                return (
                  <span
                    key={row.term}
                    {...pointing(onPointAt, { keyword: i })}
                    className="inline-flex h-7 items-center gap-1 rounded-full bg-[#eef6ad] pl-2 pr-2.5 text-xs font-bold text-primary"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                    {row.term}
                  </span>
                );
              const on = !leftOut.has(row.term);
              return (
                <button
                  key={row.term}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(row.term)}
                  {...pointing(onPointAt, { keyword: i })}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center gap-1 rounded-full text-xs font-bold transition-colors",
                    on
                      ? "border border-[#222325] bg-[#222325] pl-[7px] pr-2.5 text-white"
                      : "border border-dashed border-[#222325]/35 bg-white px-2.5 text-[#8a8b85]",
                  )}
                >
                  {on && (
                    <Check className="h-3 w-3 text-[#e1f073]" strokeWidth={3} />
                  )}
                  {row.term}
                </button>
              );
            })}
          </div>
        </ResultCard>
      );
    }

    if (id === "rewrite" && rewriteVariants && rewriteVariants.length > 0) {
      const at = Math.min(take, rewriteVariants.length - 1);
      const v = rewriteVariants[at];
      return (
        <ResultCard
          icon={def.icon}
          title={`${rewriteVariants.length} takes`}
          meta={caption ? "Applied ✓" : undefined}
          metaTone="good"
          onCollapse={collapse}
          footer={
            <>
              <button
                type="button"
                onClick={() => onUseRewrite(at)}
                className={MAIN_ACTION}
              >
                Use {v.style}
              </button>
              <button
                type="button"
                aria-label="Previous take"
                title="Previous take"
                disabled={at === 0}
                onClick={() => setTake(at - 1)}
                className={ICON_ACTION}
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
              <button
                type="button"
                aria-label="Next take"
                title="Next take"
                disabled={at === rewriteVariants.length - 1}
                onClick={() => setTake(at + 1)}
                className={ICON_ACTION}
              >
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
              <span className="flex-1" />
              {runAgain("rewrite")}
            </>
          }
        >
          <div
            role="tablist"
            className="flex gap-0.5 rounded-[9px] bg-[#f0f0ea] p-[3px]"
          >
            {rewriteVariants.map((variant, i) => (
              <button
                key={variant.style}
                type="button"
                role="tab"
                aria-selected={i === at}
                onClick={() => setTake(i)}
                className={cn(
                  "h-7 flex-1 cursor-pointer truncate rounded-[7px] px-1 text-xs font-extrabold capitalize transition-colors",
                  i === at
                    ? "bg-white text-primary shadow-[0_0_0_1px_#222325]"
                    : "text-[#5f6062] hover:text-primary",
                )}
              >
                {variant.style}
              </button>
            ))}
          </div>
          <div
            {...pointing(onPointAt, { take: true })}
            className="rounded-lg bg-[#f6f6f6] px-2.5 py-2"
          >
            {/* A role's take is its bullets, line for line; the summary's is one paragraph. */}
            {v.bullets ? (
              <ul className="flex list-disc flex-col gap-1 pl-4 text-[12.5px] font-bold leading-snug text-primary">
                {v.bullets.map((bullet, j) => (
                  <li key={j}>{bullet}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] font-bold leading-snug text-primary">
                {v.text}
              </p>
            )}
          </div>
          {caption && (
            <p className="text-xs font-medium leading-snug text-[#6c7a1e]">
              {caption}
            </p>
          )}
        </ResultCard>
      );
    }

    if (id === "quantify" && quantify && quantify.length > 0) {
      const at = Math.min(qAt, quantify.length - 1);
      const q = quantify[at];
      const applied = quantifyApplied.has(at);
      const left = quantify.filter((_, i) => !quantifyApplied.has(i)).length;
      const nextOpen = () => {
        const after = quantify.findIndex(
          (_, i) => i > at && !quantifyApplied.has(i),
        );
        if (after !== -1) setQAt(after);
      };
      return (
        <ResultCard
          icon={def.icon}
          title={left ? "Add a number" : "Every line has a number"}
          meta={left ? `${at + 1} of ${quantify.length}` : "Done ✓"}
          metaTone={left ? "muted" : "good"}
          onCollapse={collapse}
          footer={
            <>
              {applied ? (
                <span className="inline-flex h-[30px] items-center gap-1 text-xs font-extrabold text-[#6c7a1e]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} /> Applied
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onApplyQuantify(at);
                    nextOpen();
                  }}
                  className={MAIN_ACTION}
                >
                  Apply
                </button>
              )}
              {!applied && at < quantify.length - 1 && (
                <button
                  type="button"
                  onClick={() => setQAt(at + 1)}
                  className={QUIET_ACTION}
                >
                  Skip
                </button>
              )}
              <span className="flex-1" />
              {left > 1 && (
                <button
                  type="button"
                  onClick={onApplyAllQuantify}
                  className={QUIET_ACTION}
                >
                  Apply all {left}
                </button>
              )}
              <button
                type="button"
                aria-label="Previous"
                title="Previous"
                disabled={at === 0}
                onClick={() => setQAt(at - 1)}
                className={ICON_ACTION}
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
              <button
                type="button"
                aria-label="Next"
                title="Next"
                disabled={at === quantify.length - 1}
                onClick={() => setQAt(at + 1)}
                className={ICON_ACTION}
              >
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            </>
          }
        >
          <div
            {...pointing(onPointAt, { quantify: at })}
            className="flex flex-col gap-1"
          >
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f6062]">
                {q.role}
              </span>
              {/* The caution, as an icon with its words on hover or focus (owner, 2026-10-18). */}
              <span className="group/info relative flex-none">
                <button
                  type="button"
                  aria-label="Check the number is real before you apply it, or edit it on the Content tab."
                  className="grid h-5 w-5 cursor-help place-content-center rounded-full text-[#5f6062] hover:text-primary focus-visible:text-primary"
                >
                  <Info className="h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-6 z-20 w-56 rounded-lg bg-[#222325] px-2.5 py-2 text-xs normal-case leading-snug tracking-normal text-white opacity-0 transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
                >
                  Check the number is real before you apply it, or edit it on the Content tab.
                </span>
              </span>
            </span>
            <span className="text-[11.5px] leading-snug text-[#8a8b85] line-through">
              {q.before}
            </span>
            <span className="text-[12.5px] font-bold leading-relaxed text-primary">
              {q.after}
            </span>
          </div>
        </ResultCard>
      );
    }

    if (
      id === "tone" &&
      toneFixes &&
      toneFixes.some((row) => row.state !== "gone")
    ) {
      const shown = toneFixes.filter((row) => row.state !== "gone");
      const pending = shown.filter((row) => row.state === "pending");
      const fixed = shown.filter((row) => row.state === "applied").length;
      const kinds = Array.from(
        new Set(shown.map((row) => row.kind.toLowerCase())),
      ).join(" · ");
      return (
        <ResultCard
          icon={def.icon}
          title={
            pending.length
              ? `${pending.length} fix${pending.length === 1 ? "" : "es"}`
              : `${fixed} fixed · ${shown.length - fixed} left`
          }
          meta={pending.length ? kinds : "Done ✓"}
          metaTone={pending.length ? "muted" : "good"}
          onCollapse={collapse}
          footer={
            <>
              {pending.length > 1 && (
                <button
                  type="button"
                  onClick={onApplyAllFixes}
                  className={MAIN_ACTION}
                >
                  Apply all {pending.length}
                </button>
              )}
              <span className="flex-1" />
              {runAgain("tone", "Check again")}
            </>
          }
        >
          {shown.map((row) => {
            const open = row.state === "pending";
            return (
              <div
                key={row.key}
                {...pointing(onPointAt, { fix: row.key })}
                className={cn(
                  "flex flex-col gap-1.5 rounded-[10px] px-2.5 py-[9px]",
                  open
                    ? "border border-[#222325]/[0.12] bg-[#fbfbf7] hover:border-[#222325]"
                    : "border border-[#222325]/[0.12] bg-[#fbfbf7] opacity-60",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="flex-none rounded-full bg-[#f0f0ea] px-[7px] py-px text-[11px] font-extrabold capitalize text-primary">
                    {row.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#5f6062]">
                    {row.label}
                  </span>
                  {open ? (
                    <>
                      <button
                        type="button"
                        aria-label="Apply this fix"
                        title="Apply this fix"
                        onClick={() => onApplyFix?.(row.key)}
                        className="grid h-7 w-7 flex-none cursor-pointer place-content-center rounded-lg bg-[#222325] text-[#e1f073]"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </button>
                      <button
                        type="button"
                        aria-label="Leave it"
                        title="Leave it"
                        onClick={() => onDismissFix?.(row.key)}
                        className="grid h-7 w-7 flex-none cursor-pointer place-content-center rounded-lg border border-[#222325]/[0.18] bg-white text-primary hover:border-[#222325]"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.6} />
                      </button>
                    </>
                  ) : row.state === "applied" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#6c7a1e]">
                      <Check className="h-3 w-3" strokeWidth={3} /> Fixed
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-[#8a8b85]">
                      Left as is
                    </span>
                  )}
                </div>
                <span className="text-[12.5px] leading-relaxed text-primary">
                  {wordDiff(row.before, row.after)}
                </span>
              </div>
            );
          })}
        </ResultCard>
      );
    }

    // Tailor and Shorten land straight on the resume: their card says what changed.
    if (caption) {
      const title =
        id === "tailor"
          ? job
            ? `Tailored to ${job.company}`
            : "Tailored"
          : id === "shorten"
            ? "Fit on one page"
            : def.label;
      return (
        <ResultCard
          icon={def.icon}
          title={title}
          meta={
            id === "shorten"
              ? pageCount > 1
                ? `${pageCount} pages`
                : "1 page ✓"
              : "Done ✓"
          }
          metaTone={id === "shorten" && pageCount > 1 ? "muted" : "good"}
          onCollapse={collapse}
          footer={
            <>
              <span className="text-xs text-[#5f6062]">
                Undo above the resume takes it back.
              </span>
              <span className="flex-1" />
              {runAgain(id, id === "tailor" ? "Tailor again" : "Run again")}
            </>
          }
        >
          <p className="text-xs leading-relaxed text-[#55564f]">{caption}</p>
        </ResultCard>
      );
    }
    return null;
  };

  // ── A tool's line ──────────────────────────────────────────────────────────
  const row = (id: ToolId) => {
    const def = TOOLS[id];
    const running = aiRunning === id;
    const isPicking = picking === id;

    if (running)
      return (
        <div
          key={id}
          data-tool={id}
          className="relative flex min-h-11 items-center gap-2.5 overflow-hidden rounded-[10px] bg-[#f6f6f6] px-2"
        >
          <span className={cn(TILE, "bg-[#e1f073]")}>
            <def.icon
              aria-hidden
              className="h-3.5 w-3.5 text-primary"
              strokeWidth={2.2}
            />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[13px] font-bold text-primary">
              {def.label}
            </span>
            <span className="text-xs text-[#55564f]">{def.working}</span>
          </span>
          {/* A thin line that keeps moving: the run is out, with no fake percentage. */}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
          >
            <span className="absolute inset-y-0 w-2/5 animate-[ai-tool-progress_1.4s_ease-in-out_infinite] bg-[#6c7a1e]" />
          </span>
        </div>
      );

    if (isPicking)
      return (
        <div
          key={id}
          data-tool={id}
          className="my-0.5 flex min-h-11 items-center gap-2.5 rounded-[10px] border-[1.5px] border-[#222325] pl-2 pr-1.5 br-shadow br-lime"
        >
          <span className={cn(TILE, "bg-[#e1f073]")}>
            <def.icon
              aria-hidden
              className="h-3.5 w-3.5 text-primary"
              strokeWidth={2.2}
            />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[13px] font-extrabold text-primary">
              {def.label}
            </span>
            <span className="text-xs text-[#55564f]">
              {id === "rewrite"
                ? "Click your summary, a role or a section"
                : "Click a line, a role or a section"}
            </span>
          </span>
          <button
            type="button"
            onClick={onCancelPick}
            title="Cancel"
            className="flex-none cursor-pointer rounded-[5px] border border-[#222325]/30 px-1.5 py-px text-[11px] font-bold text-primary hover:border-[#222325]"
          >
            Esc
          </button>
        </div>
      );

    const h = hint(id);
    const result = openTool === id ? card(id) : null;
    return (
      <div key={id} data-tool={id}>
        <div
          {...pointing(onPointAt, { tool: id })}
          className={cn(
            "flex min-h-11 items-center gap-2.5 rounded-[10px] px-2 transition-colors hover:bg-[#f6f6f6]",
            quiet(id) && !result && "opacity-45 hover:opacity-100",
          )}
        >
          <span className={cn(TILE, "bg-[#f0f0ea]")}>
            <def.icon
              aria-hidden
              className="h-3.5 w-3.5 text-primary"
              strokeWidth={2.2}
            />
          </span>
          <button
            type="button"
            onClick={() => card(id) && setOpenTool(openTool === id ? null : id)}
            className={cn(
              "min-w-0 flex-1 truncate text-left text-[13px] font-bold text-primary",
              card(id) ? "cursor-pointer" : "cursor-default",
            )}
          >
            {def.label}
          </button>
          {h && (
            <span
              className={cn(
                "flex-none text-xs font-bold",
                h.tone === "bad"
                  ? "text-[#b23c26]"
                  : h.tone === "good"
                    ? "text-[#6c7a1e]"
                    : "text-[#5f6062]",
              )}
            >
              {h.text}
            </span>
          )}
          <button
            type="button"
            onClick={() => onRun(id)}
            disabled={busy || (id === "tailor" && jobLoading)}
            className={RUN_BUTTON}
          >
            {/* Always "Run" (owner, 2026-10-18); the result card has its own Run again. */}
            Run
          </button>
        </div>
        {result}
      </div>
    );
  };

  // ── The job, set once ──────────────────────────────────────────────────────
  const pick = onPickJob ?? onPickTailorJob;
  const jobRow = jobLoading ? (
    <div className="flex h-10 items-center gap-2 rounded-[10px] bg-[#f6f6f6] px-2.5 text-xs text-[#55564f]">
      <Briefcase
        aria-hidden
        className="h-3.5 w-3.5 flex-none"
        strokeWidth={2}
      />
      Loading {tailorFor?.label}…
    </div>
  ) : job ? (
    <div className="flex h-10 items-center gap-2 rounded-[10px] bg-[#f6f6f6] pl-2.5 pr-1.5">
      <Briefcase
        aria-hidden
        className="h-3.5 w-3.5 flex-none text-[#55564f]"
        strokeWidth={2}
      />
      <span className="min-w-0 flex-1 truncate text-xs text-[#55564f]">
        For <strong className="text-primary">{job.role}</strong> · {job.company}
      </span>
      {pick && (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="h-7 flex-none cursor-pointer px-2 text-xs font-extrabold text-primary underline underline-offset-2 disabled:cursor-default disabled:opacity-40"
        >
          Change
        </button>
      )}
    </div>
  ) : (
    <button
      type="button"
      onClick={pick}
      disabled={busy || !pick}
      className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] border border-dashed border-[#222325]/40 bg-white px-2.5 text-left text-xs font-extrabold text-primary transition-colors hover:border-[#222325] disabled:cursor-default disabled:opacity-50"
    >
      <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2.6} />
      {tailorFor?.status === "failed"
        ? `We couldn't load ${tailorFor.label}. Pick a job to match`
        : "Pick a job to match"}
      <span className="flex-1" />
      <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
    </button>
  );

  return (
    <section aria-label="AI tools" className="flex flex-col gap-2.5">
      <div className="flex h-9 items-center gap-3 px-1">
        <h2 className="flex-1 text-lg font-extrabold tracking-[-0.01em] text-primary">
          AI tools
        </h2>
        <span className="text-xs text-[#8a8b85]">
          {SUGGESTION_CREDITS} credit a run
        </span>
      </div>
      <FreeUsesNote
        feature="resumeHelp"
        noun="AI resume help"
        className="-mt-1.5 px-1"
      />

      <div className="flex flex-col gap-1 rounded-[14px] border border-[#222325]/10 bg-white p-2.5">
        <span className={GROUP_LABEL}>Match the job</span>
        {jobRow}
        <span aria-hidden className="h-1" />
        {row("tailor")}
        {row("keywords")}

        <span aria-hidden className="mx-1.5 my-2 h-px bg-[#222325]/10" />
        <span className={GROUP_LABEL}>Polish the writing</span>
        {row("rewrite")}
        {row("quantify")}
        {row("shorten")}
        {row("tone")}
      </div>
    </section>
  );
};

export default AiToolsList;
