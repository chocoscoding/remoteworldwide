"use client";

import { useRef, useState, useTransition, type FC } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { getMailTable } from "@/libs/mail-admin";
import type { TableRow } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import { METRIC } from "../charts/palette";
import { Empty, ErrorBox, Segmented } from "../ui";
import { money, n, pct, ratio } from "../format";
import { WORKING_BYS, barMeasure, hrefFor, rankRows, type WorkingBy } from "./metrics";

// "What's working": the mails, playbook steps or campaigns of the range, ranked by upgrades credited
// with clicks as the tiebreak, each with a thin bar on one scale. The first view comes from the
// server; the other two are asked for when picked and kept, so switching back is instant. While a
// view loads, the last one stays on screen, faded, so nothing jumps.

const TOP = 5;

const num = (value: unknown) => {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
};

const plural = (count: number, one: string, many: string) => `${n(count)} ${count === 1 ? one : many}`;

const WhatsWorking: FC<{ days: number; initialBy: WorkingBy; initialRows: TableRow[] | null; initialError?: string | null }> = ({ days, initialBy, initialRows, initialError }) => {
  const [by, setBy] = useState<WorkingBy>(initialBy);
  const [shownBy, setShownBy] = useState<WorkingBy>(initialBy);
  const [rowsBy, setRowsBy] = useState<Partial<Record<WorkingBy, TableRow[]>>>(() => (initialRows ? { [initialBy]: initialRows } : {}));
  const [errors, setErrors] = useState<Partial<Record<WorkingBy, string>>>(() => (initialError ? { [initialBy]: initialError } : {}));
  const [all, setAll] = useState(false);
  const [loading, start] = useTransition();
  const wanted = useRef<WorkingBy>(initialBy);

  const pick = (next: WorkingBy) => {
    setBy(next);
    setAll(false);
    wanted.current = next;
    if (rowsBy[next]) {
      setShownBy(next);
      return;
    }
    start(async () => {
      const res = await getMailTable(next, days);
      const message = res.error;
      const answer = res.data ?? [];
      if (message) setErrors((e) => ({ ...e, [next]: message }));
      else {
        setRowsBy((r) => ({ ...r, [next]: answer }));
        setErrors((e) => ({ ...e, [next]: undefined }));
      }
      // A slower answer for a view the admin already left must not take the screen back.
      if (wanted.current === next) setShownBy(next);
    });
  };

  const rows = rankRows(rowsBy[shownBy] ?? []);
  const error = errors[shownBy];
  const stale = shownBy !== by;
  const measure = barMeasure(rows);
  const top = Math.max(0, ...rows.map((r) => num(r[measure])));
  const visible = all ? rows : rows.slice(0, TOP);
  const color = measure === "converted" ? METRIC.converted : METRIC.clicked;

  return (
    <section aria-labelledby="whats-working" className="rounded-md border border-gray-300 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 id="whats-working" className="text-sm font-bold">
            What&apos;s working
          </h2>
          <span className="text-xs text-gray-500">{measure === "converted" ? "By upgrades, then clicks" : "By clicks"}</span>
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin self-center text-gray-500" aria-label="Loading" /> : null}
        </div>
        <Segmented label="What to rank" value={by} options={WORKING_BYS} onChange={pick} />
      </div>

      <div className={cn("transition-opacity", stale && "opacity-50")} aria-busy={stale || undefined}>
        {error ? (
          <ErrorBox className="mt-2">This list couldn&apos;t be loaded: {error}</ErrorBox>
        ) : !rows.length ? (
          <Empty>Nothing sent in this range.</Empty>
        ) : (
          <ol className="flex flex-col">
            {visible.map((row, i) => {
              const href = row.id ? hrefFor(shownBy, row.id) : null;
              const v = num(row[measure]);
              const name = row.label || row.id || "(none)";
              const lead = measure === "converted" ? plural(num(row.converted), "upgrade", "upgrades") : plural(num(row.clicked), "click", "clicks");
              const rest =
                measure === "converted"
                  ? [plural(num(row.clicked), "click", "clicks"), num(row.revenueCents) > 0 ? money(row.revenueCents) : null]
                  : [`${pct(ratio(row.clicked, row.delivered), 1)} click rate`, `${n(row.sent)} sent`];
              return (
                <li key={row.id || `${name}-${i}`} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-gray-100 py-2.5 first:border-t-0">
                  <span className="text-xs tabular-nums text-gray-400">{i + 1}</span>
                  <div className="min-w-0">
                    {href ? (
                      <Link href={href} className="block truncate text-sm font-semibold hover:underline" title={name}>
                        {name}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-semibold" title={name}>
                        {name}
                      </span>
                    )}
                    <div className="mt-1.5 h-1" aria-hidden>
                      <span className="block h-full rounded-r-full" style={{ width: `${top > 0 ? (v / top) * 100 : 0}%`, minWidth: v > 0 ? 2 : 0, background: color }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums">{lead}</p>
                    <p className="text-xs tabular-nums text-gray-500">{rest.filter(Boolean).join(" · ")}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {rows.length > TOP && !error ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-semibold text-gray-600 hover:text-black hover:underline">
            {all ? `Show top ${TOP}` : `Show all ${n(rows.length)}`}
          </button>
        ) : null}
      </div>
    </section>
  );
};

export default WhatsWorking;
