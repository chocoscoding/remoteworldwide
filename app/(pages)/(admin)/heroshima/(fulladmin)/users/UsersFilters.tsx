"use client";

import { useCallback, useRef, useState, type FC } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { USER_SORTS, USER_SORT_LABELS, type UserRange, type UserSort } from "@/app/lib/tracking/types";
import { MAIL_LEVELS, MAIL_LEVEL_HINTS, MAIL_LEVEL_LABELS, type MailLevel } from "@/app/lib/mail/userMail";
import { useDismiss } from "@/app/components/mail/content/useDismiss";
import { cn } from "@/lib/utils";

const DEFAULT_SORT: UserSort = "last_seen";
const n = (value: number) => value.toLocaleString("en-GB");

/**
 * The people list's Filters button: a small pane to pick the sort and the outreach level, applied
 * as the page's own `?sort=` and `?mail=` (so paging, links and the CSV/TXT export keep working),
 * starting again at page 1. The search and the chart range are carried over untouched.
 */
const UsersFilters: FC<{
  sort: UserSort;
  mail: MailLevel | undefined;
  q: string;
  range: UserRange;
  /** People at each outreach level; null while the summary couldn't be read. */
  counts: Record<MailLevel, number> | null;
}> = ({ sort, mail, q, range, counts }) => {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pickedSort, setPickedSort] = useState<UserSort>(sort);
  const [pickedMail, setPickedMail] = useState<MailLevel | null>(mail ?? null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);

  const active = (sort !== DEFAULT_SORT ? 1 : 0) + (mail ? 1 : 0);

  const toggle = () => {
    // Opening starts from what the page shows now, not from an abandoned earlier pick.
    if (!open) {
      setPickedSort(sort);
      setPickedMail(mail ?? null);
    }
    setOpen((o) => !o);
  };

  const apply = (nextSort: UserSort, nextMail: MailLevel | null) => {
    const search = new URLSearchParams({ sort: nextSort });
    if (q) search.set("q", q);
    if (nextMail) search.set("mail", nextMail);
    if (range !== "90") search.set("range", range);
    setOpen(false);
    router.push(`/heroshima/users?${search.toString()}#people`);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn("inline-flex h-full items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-bold br-plain-press", open && "border-black")}>
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Filters
        {active ? <span className="rounded-full bg-black px-1.5 text-[11px] leading-5 text-[#e1f073] tabular-nums">{active}</span> : null}
      </button>

      {open ? (
        <div role="dialog" aria-label="Filters" className="absolute left-0 top-full z-30 mt-2 w-[300px] rounded-md border border-black bg-white p-4 br-shadow">
          <p className="mb-2 text-xs font-bold text-gray-500">Sort by</p>
          <div role="radiogroup" aria-label="Sort by" className="mb-4 flex rounded-md border border-gray-300 p-0.5">
            {USER_SORTS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={pickedSort === s}
                onClick={() => setPickedSort(s)}
                className={cn("flex-1 rounded px-2 py-1 text-xs font-bold", pickedSort === s ? "bg-black text-[#e1f073]" : "text-gray-700 hover:bg-gray-100")}>
                {USER_SORT_LABELS[s]}
              </button>
            ))}
          </div>

          <p className="mb-1 text-xs font-bold text-gray-500">Outreach</p>
          <div role="radiogroup" aria-label="Outreach" className="flex flex-col">
            {[null, ...MAIL_LEVELS].map((level) => {
              const on = pickedMail === level;
              return (
                <button
                  key={level ?? "anyone"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={level ? MAIL_LEVEL_HINTS[level] : undefined}
                  onClick={() => setPickedMail(level)}
                  className={cn("flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50", on && "font-bold")}>
                  <span aria-hidden className={cn("grid h-3.5 w-3.5 place-items-center rounded-full border", on ? "border-black" : "border-gray-400")}>
                    {on ? <span className="h-1.5 w-1.5 rounded-full bg-black" /> : null}
                  </span>
                  <span className="flex-1">{level ? MAIL_LEVEL_LABELS[level] : "Anyone"}</span>
                  {level && counts ? <span className="text-xs tabular-nums text-gray-400">{n(counts[level])}</span> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-3">
            <button type="button" onClick={() => apply(pickedSort, pickedMail)} className="rounded-md bg-[#e1f073] px-3 py-1.5 text-sm font-bold br-plain-press">
              Apply
            </button>
            {active || pickedSort !== DEFAULT_SORT || pickedMail ? (
              <button type="button" onClick={() => apply(DEFAULT_SORT, null)} className="px-2 text-xs font-semibold text-gray-500 hover:text-black hover:underline">
                Reset
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UsersFilters;
