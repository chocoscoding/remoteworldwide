import { FC } from "react";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import type { IntroPipelineEntry } from "@/app/lib/dashboard/types";

/**
 * A recommendation that closed — passed or expired. Deliberately a single
 * muted row, not a card: it carries no action and shouldn't compete with the
 * live pipeline above it. The word "rejected" never appears.
 */
export interface ClosedRecRowProps {
  entry: IntroPipelineEntry;
  /** How many watchlists the talent is still on — softens a pass. */
  watchlists: number;
}

const ClosedRecRow: FC<ClosedRecRowProps> = ({ entry, watchlists }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white/70 px-4 py-3">
    <Avatar name={entry.company} size="sm" src={null} className="opacity-55" />
    <p className="min-w-0 flex-1 text-sm leading-relaxed text-black/55">
      {entry.outcome === "passed" ? (
        <>
          <span className="font-semibold text-black/70">{entry.company}</span> went another direction — you&apos;re still
          on {watchlists} watchlists.
        </>
      ) : (
        <>
          <span className="font-semibold text-black/70">{entry.company}</span> — this one timed out, no answer sent.
        </>
      )}
    </p>
    <span className="flex-none text-[11px] text-black/40">
      {entry.outcomeAgoDays === 0 ? "today" : `${entry.outcomeAgoDays}d ago`}
    </span>
  </div>
);

export default ClosedRecRow;
