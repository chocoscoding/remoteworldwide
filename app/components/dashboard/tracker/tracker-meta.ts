import type { TrackerColumnId } from "@/app/lib/dashboard/types";

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
