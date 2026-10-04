import { FC } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import type { IntroPipelineEntry } from "@/app/lib/dashboard/types";

/** "closes in 2 days": a whole word here, where the card's clock is the headline. */
const closesIn = (days: number) => (days === 0 ? "closes today" : `closes in ${days} day${days === 1 ? "" : "s"}`);

/**
 * The top of the screen while a company's questions are waiting on you: the
 * one thing here that has a clock. Picks the soonest to close when several are
 * waiting; the rest say so on their own cards below.
 */
const WaitingOnYouBanner: FC<{ entry: IntroPipelineEntry }> = ({ entry }) => {
  const count = (entry.questions ?? []).filter((q) => !q.answer).length;
  const days = entry.expiresInDays;
  return (
    <Link
      href={`/dashboard/recommend/${entry.id}`}
      className="br-bold-press flex flex-wrap items-center gap-4 rounded-2xl bg-[#e1f073] px-[22px] py-5 text-primary">
      <Avatar name={entry.company} tone="dark" size="lg" className="text-lg font-extrabold" />
      <span className="flex min-w-0 flex-[999_1_320px] flex-col gap-0.5">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]">Waiting on you</span>
        <span className="text-xl font-extrabold leading-tight tracking-[-0.01em]">
          {entry.company} asked you {count} question{count === 1 ? "" : "s"}
        </span>
        <span className="text-[13px] text-[#3a3b36]">
          {entry.role} · answer {count === 1 ? "it" : "them"} and you&apos;re talking to their hiring team
        </span>
      </span>
      <span className="flex flex-none flex-col items-end gap-1.5">
        <span className="flex h-10 items-center rounded-[9px] bg-[#222325] px-[18px] text-sm font-extrabold text-white">Answer now</span>
        {days !== undefined && (
          <span className={cn("text-xs font-extrabold", days <= 2 ? "text-[#8a2a17]" : "text-[#3a3b36]")}>{closesIn(days)}</span>
        )}
      </span>
    </Link>
  );
};

export default WaitingOnYouBanner;
