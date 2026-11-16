"use client";

import { useMemo, useState, type FC } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { PlaybookStatus } from "@/app/lib/mail/types";
import { BTN, BTN_LINK, Chip, INPUT, INPUT_SM } from "@/app/components/mail/ui";
import { n, pct, ratio } from "@/app/components/mail/format";
import Sparkline from "@/app/components/mail/playbook/Sparkline";
import { cn } from "@/lib/utils";

/** One playbook as the list needs it, worked out on the server (sentences, sort keys). */
export type PlaybookRow = {
  id: string;
  name: string;
  description: string;
  status: PlaybookStatus;
  group: string | null;
  trigger: string;
  steps: string;
  hasGoal: boolean;
  active: number;
  /** People entering a day, the last 30 days, oldest first; null when the backend doesn't send it. */
  trend: number[] | null;
  stats30: { entered: number; converted: number } | null;
};

type StatusFilter = "all" | PlaybookStatus;
const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Draft" },
  { value: "paused", label: "Paused" },
];
const STATUS_WORD: Record<PlaybookStatus, string> = { live: "Live", draft: "Draft", paused: "Paused" };
const EMPTY_WORD: Record<PlaybookStatus, string> = { live: "No live playbooks", draft: "No drafts", paused: "No paused playbooks" };
const NO_GROUP = "\u0000none";
const PAGE = 25;

const StatusDot: FC<{ status: PlaybookStatus }> = ({ status }) => (
  <span
    title={STATUS_WORD[status]}
    className={cn(
      "inline-block h-2.5 w-2.5 flex-none rounded-full",
      status === "live" ? "border border-black bg-[#e1f073]" : status === "paused" ? "bg-[#fab219]" : "border border-gray-400 bg-white",
    )}>
    <span className="sr-only">{STATUS_WORD[status]}</span>
  </span>
);

/** The playbooks: search, status chips with counts, a group select, compact rows, 25 at a time. Rows arrive sorted live first, then by last change. */
const PlaybookList: FC<{ rows: PlaybookRow[] }> = ({ rows }) => {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [group, setGroup] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const groups = useMemo(() => Array.from(new Set(rows.map((r) => r.group).filter((g): g is string => Boolean(g)))).sort((a, b) => a.localeCompare(b)), [rows]);
  const someUngrouped = rows.some((r) => !r.group);

  const q = query.trim().toLowerCase();
  const narrowed = rows.filter(
    (r) => (!q || `${r.name} ${r.description}`.toLowerCase().includes(q)) && (!group || (group === NO_GROUP ? !r.group : r.group === group)),
  );
  const counts: Record<StatusFilter, number> = { all: narrowed.length, live: 0, draft: 0, paused: 0 };
  for (const r of narrowed) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const matching = status === "all" ? narrowed : narrowed.filter((r) => r.status === status);
  const shown = matching.slice(0, limit);

  // Every filter change starts the list again from the top 25.
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setLimit(PAGE);
  };
  const clear = () => {
    setQuery("");
    setStatus("all");
    setGroup("");
    setLimit(PAGE);
  };

  let empty = "";
  if (!matching.length) {
    const where = group ? (group === NO_GROUP ? " without a group" : ` in ${group}`) : "";
    if (q) empty = `No playbook${status === "all" ? "" : ` (${STATUS_WORD[status].toLowerCase()})`}${where} matches "${query.trim()}".`;
    else if (status !== "all") empty = `${EMPTY_WORD[status]}${where}.`;
    else empty = `No playbooks${where}.`;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Search playbooks</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
          <input type="search" className={cn(INPUT, "pl-8")} value={query} onChange={(e) => filter(setQuery)(e.target.value)} placeholder="Search name or description" />
        </label>
        <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => {
            const on = status === s.value;
            return (
              <button
                key={s.value}
                type="button"
                aria-pressed={on}
                onClick={() => filter(setStatus)(s.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                  on ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black",
                )}>
                {s.label}
                <span className={cn("tabular-nums", on ? "text-[#e1f073]/80" : "text-gray-400")}>{counts[s.value]}</span>
              </button>
            );
          })}
        </div>
        {groups.length ? (
          <select aria-label="Group" className={INPUT_SM} value={group} onChange={(e) => filter(setGroup)(e.target.value)}>
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
            {someUngrouped ? <option value={NO_GROUP}>No group</option> : null}
          </select>
        ) : null}
      </div>

      <div className="rounded-md border border-gray-300 bg-white">
        <div className="hidden grid-cols-[10px_minmax(0,1fr)_170px_76px] gap-x-4 border-b border-gray-200 px-4 py-2 text-xs font-semibold text-gray-500 md:grid">
          <span />
          <span>Playbook</span>
          <span>Entered, last 30 days</span>
          <span className="text-right" title="Of the people who entered in the last 30 days, the share who reached the goal">
            Goal rate
          </span>
        </div>
        {!shown.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-gray-500">
            <p>{empty}</p>
            <button type="button" onClick={clear} className={BTN_LINK}>
              Clear filters
            </button>
          </div>
        ) : (
          <ul>
            {shown.map((r) => {
              const entered = r.stats30?.entered ?? 0;
              // "-" when nobody entered, and when there is no goal (converted is always 0 there, so 0% would mislead).
              const rate = r.hasGoal && r.stats30 && entered > 0 ? pct(ratio(r.stats30.converted, entered), 0) : null;
              const rateTitle = !r.hasGoal ? "No goal set" : rate === null ? "Nobody entered in the last 30 days" : `${n(r.stats30?.converted)} of ${n(entered)} reached the goal`;
              return (
                <li key={r.id} className="border-t border-gray-200 first:border-t-0">
                  <Link
                    href={`/heroshima/outreach/playbooks/${r.id}`}
                    title={r.description || undefined}
                    className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none md:grid-cols-[10px_minmax(0,1fr)_170px_76px]">
                    <StatusDot status={r.status} />
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold">{r.name || "Untitled"}</span>
                        {r.group ? <Chip tone="outline">{r.group}</Chip> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500">
                        {r.trigger} · {r.steps}
                        {r.active > 0 ? ` · ${n(r.active)} in it now` : ""}
                      </span>
                    </span>
                    <span className="hidden items-center gap-2 md:flex">
                      {r.trend ? <Sparkline values={r.trend} label="People entering a day" /> : <span className="text-xs text-gray-400">-</span>}
                      <span className="text-xs font-semibold tabular-nums text-gray-700">{r.stats30 ? n(entered) : ""}</span>
                    </span>
                    <span title={rateTitle} className={cn("text-right text-sm tabular-nums", rate === null ? "text-gray-400" : "font-semibold")}>
                      {rate ?? "-"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {matching.length > shown.length ? (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className={BTN}>
            Show more
          </button>
          <span className="text-xs text-gray-500">
            {n(shown.length)} of {n(matching.length)}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default PlaybookList;
