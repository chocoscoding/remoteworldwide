import type { LucideIcon } from "lucide-react";
import { CircleSlash, Ghost, LogOut, ThumbsDown } from "lucide-react";
import type { TrackerCard, TrackerClosedReason, TrackerColumnId, TrackerStatus } from "@/app/lib/dashboard/types";

/**
 * The tracker's color system, one lookup for every surface that renders a
 * column: header dot, card border, status pill. All literal Tailwind classes
 * (closed union) so the build-time scan finds every one.
 *
 * Pills are tints, not solid fills — five colored columns at solid strength
 * would all shout at once. Text tones are picked to clear 4.5:1 on the tint.
 */
export const COLUMN_META: Record<TrackerColumnId, { dot: string; cardBorder: string; pill: string }> = {
  saved: { dot: "bg-slate-400", cardBorder: "border-slate-400/60", pill: "bg-slate-400/15 text-slate-700" },
  applied: { dot: "bg-blue-500", cardBorder: "border-blue-500/60", pill: "bg-blue-500/10 text-blue-800" },
  conversation: { dot: "bg-[#cddd54]", cardBorder: "border-[#cddd54]", pill: "bg-[#cddd54]/30 text-[#4d5518]" },
  interviewing: { dot: "bg-[#e1f073]", cardBorder: "border-[#cddd54]", pill: "bg-[#e1f073]/40 text-[#4d5518]" },
  offer: { dot: "bg-amber-400", cardBorder: "border-amber-400/70", pill: "bg-amber-400/20 text-amber-800" },
};

/** Board order — also the Table view's Status sort order. */
export const STATUS_ORDER: TrackerColumnId[] = ["saved", "applied", "conversation", "interviewing", "offer"];

/** Static labels — matches TRACKER_COLUMNS but usable without the live state. */
export const COLUMN_LABELS: Record<TrackerColumnId, string> = {
  saved: "Saved",
  applied: "Applied",
  conversation: "In conversation",
  interviewing: "Interviewing",
  offer: "Offer",
};

/** Menu and summary order — worst-to-best is wrong here; this is frequency order. */
export const CLOSED_ORDER: TrackerClosedReason[] = ["rejected", "ghosted", "withdrawn", "declined"];

/**
 * The closed half of the system. Same literal-class discipline as
 * `COLUMN_META`, with one deliberate tonal choice: only `rejected` and
 * `declined` carry the destructive red. Ghosting is not a verdict anyone
 * delivered — painting it red would tell the user they were rejected when in
 * truth nobody ever replied — and withdrawing is the user's own decision, so
 * both read neutral. `menuLabel` is the imperative used in the status menu;
 * `label` is the noun used everywhere the outcome is reported back.
 */
export const CLOSED_META: Record<TrackerClosedReason, { label: string; menuLabel: string; icon: LucideIcon; pill: string; dot: string; cardBorder: string }> = {
  rejected: {
    label: "Rejected",
    menuLabel: "They said no",
    icon: ThumbsDown,
    pill: "bg-[#fdeae6] text-[#b23c26]",
    dot: "bg-[#b23c26]",
    cardBorder: "border-[#b23c26]/45",
  },
  ghosted: {
    label: "Ghosted",
    menuLabel: "Never heard back",
    icon: Ghost,
    pill: "bg-black/[0.06] text-black/55",
    dot: "bg-black/30",
    cardBorder: "border-black/25",
  },
  withdrawn: {
    label: "Withdrawn",
    menuLabel: "I pulled out",
    icon: LogOut,
    pill: "bg-black/[0.06] text-black/55",
    dot: "bg-black/30",
    cardBorder: "border-black/25",
  },
  declined: {
    label: "Declined",
    menuLabel: "I turned it down",
    icon: CircleSlash,
    pill: "bg-[#fdeae6] text-[#b23c26]",
    dot: "bg-[#b23c26]",
    cardBorder: "border-[#b23c26]/45",
  },
};

/**
 * Every column on the board, in order: the five stages, then the four ways an
 * application ends. The outcomes are columns rather than a strip below the
 * board because closing one is a move like any other — the same drag, the same
 * menu — and a search that never shows its rejections is telling a nicer story
 * than the truth.
 */
export const BOARD_ORDER: TrackerStatus[] = [...STATUS_ORDER, ...CLOSED_ORDER];

export const isClosedStatus = (status: TrackerStatus): status is TrackerClosedReason =>
  (CLOSED_ORDER as TrackerStatus[]).includes(status);

/** One lookup for any column, open or closed — header dot, card border, pill. */
export function statusMeta(status: TrackerStatus): { label: string; dot: string; cardBorder: string; pill: string } {
  if (isClosedStatus(status)) {
    const meta = CLOSED_META[status];
    return { label: meta.label, dot: meta.dot, cardBorder: meta.cardBorder, pill: meta.pill };
  }
  return { label: COLUMN_LABELS[status], ...COLUMN_META[status] };
}

/**
 * Days since anything happened on this application. `lastTouchedDaysAgo` wins
 * when present; otherwise nothing has happened since it was applied to, so
 * `daysAgo` IS the silence. Undefined only for cards with neither, which
 * can't be judged stale at all.
 */
export function daysSinceTouch(card: TrackerCard): number | null {
  return card.lastTouchedDaysAgo ?? card.daysAgo ?? null;
}

/**
 * Past this, an application with no reply is almost certainly dead. Not a
 * rule the app enforces — it only offers the close, because a user who knows
 * something we don't should never be overruled by a timer.
 */
export const GHOST_AFTER_DAYS = 30;

/**
 * Pure, derived in render — never written to state. A stale card in a stage
 * that's still waiting on the company earns the prompt; `saved` never does
 * (nobody owes you a reply to an application you haven't sent) and neither
 * does `offer` (silence there is the user's move to make).
 */
export function looksGhosted(card: TrackerCard, columnId: TrackerColumnId): boolean {
  if (columnId === "saved" || columnId === "offer") return false;
  const silent = daysSinceTouch(card);
  return silent !== null && silent >= GHOST_AFTER_DAYS;
}
