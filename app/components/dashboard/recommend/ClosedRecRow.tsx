import { FC } from "react";
import Link from "next/link";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import type { IntroPipelineEntry } from "@/app/lib/dashboard/types";

/**
 * A recommendation that closed — connected, passed or expired. Deliberately a
 * single muted row, not a card: it carries no action and shouldn't compete with
 * the live pipeline above it. The word "rejected" never appears. The row links
 * to the recommendation's page, where what you told them is still readable.
 */
export interface ClosedRecRowProps {
  entry: IntroPipelineEntry;
}

const ClosedRecRow: FC<ClosedRecRowProps> = ({ entry }) => {
  const company = <span className="font-semibold text-black/70">{entry.company}</span>;
  const hadQuestions = (entry.questions?.length ?? 0) > 0;
  return (
    <Link
      href={`/dashboard/recommend/${entry.id}`}
      className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white/70 px-4 py-3 transition-colors hover:border-black/20">
      <Avatar name={entry.company} size="sm" src={null} className={entry.outcome === "connected" ? undefined : "opacity-55"} />
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-black/55">
        {entry.outcome === "connected" ? (
          <>You and {company} are connected — they took it from here.</>
        ) : entry.outcome === "passed" ? (
          <>{company} went another direction — reviewers keep looking for your next fit.</>
        ) : hadQuestions ? (
          <>{company} — this one timed out, no answer sent.</>
        ) : (
          <>{company} — this one closed before they sent questions.</>
        )}
      </p>
      <span className="flex-none text-[11px] text-black/40">
        {entry.outcomeAgoDays === undefined ? "" : entry.outcomeAgoDays === 0 ? "today" : `${entry.outcomeAgoDays}d ago`}
      </span>
    </Link>
  );
};

export default ClosedRecRow;
