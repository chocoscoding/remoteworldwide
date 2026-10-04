import { FC } from "react";
import Link from "next/link";
import type { IntroPipelineEntry } from "@/app/lib/dashboard/types";

/**
 * A recommendation that closed — connected, passed or expired. Deliberately a
 * single dashed row, not a card: it carries no action and shouldn't compete
 * with the live list above it. The word "rejected" never appears. The row
 * links to the recommendation's page, where what you told them is still
 * readable.
 */
export interface ClosedRecRowProps {
  entry: IntroPipelineEntry;
}

const ClosedRecRow: FC<ClosedRecRowProps> = ({ entry }) => {
  const company = <strong className="font-bold text-[#44453f]">{entry.company}</strong>;
  const hadQuestions = (entry.questions?.length ?? 0) > 0;
  return (
    <Link
      href={`/dashboard/recommend/${entry.id}`}
      className="flex items-center gap-3 rounded-[14px] border border-dashed border-black/25 px-4 py-3 text-[13px] text-[#5f6062] transition-colors hover:border-black/50">
      <span className="min-w-0 flex-1">
        {entry.outcome === "connected" ? (
          <>You and {company} are connected.</>
        ) : entry.outcome === "passed" ? (
          <>{company} went another direction.</>
        ) : hadQuestions ? (
          <>{company} closed before you answered.</>
        ) : (
          <>{company} closed before sending questions.</>
        )}
      </span>
      <span className="flex-none text-xs">
        {entry.outcomeAgoDays === undefined ? "" : entry.outcomeAgoDays === 0 ? "today" : `${entry.outcomeAgoDays}d ago`}
      </span>
    </Link>
  );
};

export default ClosedRecRow;
