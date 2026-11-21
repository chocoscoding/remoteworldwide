"use client";

import { useEffect, useRef, useState, type FC } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Search, UserPlus } from "lucide-react";
import { AUDIENCE_PAGE_SIZES, type AudienceFilter, type AudiencePageSize, type AudiencePeopleScope, type AudiencePerson } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import { BTN, BTN_PRIMARY, Chip, ErrorBox, INPUT_SM, ROW, Segmented, TABLE, TD, TH } from "../ui";
import { day, n } from "../format";
import { peopleIn } from "./filterText";
import type { PeopleState } from "./useAudiencePeople";

/** What the table shows: which page, how many a page, the search, and the people in it or the removed ones. */
export type PeopleView = { page: number; pageSize: AudiencePageSize; q: string; scope: AudiencePeopleScope };
export const START_VIEW: PeopleView = { page: 1, pageSize: 25, q: "", scope: "audience" };

export const SIZE_OPTIONS = AUDIENCE_PAGE_SIZES.map((s) => ({ value: String(s), label: String(s) }));
export const planLabel = (plan: string | null) => (plan ? plan[0].toUpperCase() + plan.slice(1) : "");

/** What an editable table can do with the rows picked in it. */
export type PeopleActions = {
  /** Take these people out of the audience (matches go to excludeIds, added people leave includeIds). */
  remove: (rows: AudiencePerson[]) => void;
  /** Put removed matches back (out of excludeIds). */
  putBack: (rows: AudiencePerson[]) => void;
  /** Open the drawer to find and add people. */
  add: () => void;
};

/**
 * An audience's people, a page at a time, with search and paging. Read only for a fixed audience.
 * Editable: a checkbox per row picks it for an action (nobody is picked to begin with); with one or
 * more picked, a bar offers Remove from audience (or Put back, on the removed list). "N removed" in the
 * summary opens the list of people taken out by hand; Add people opens the drawer to find more.
 */
const PeopleTable: FC<{
  people: PeopleState;
  view: PeopleView;
  onView: (view: PeopleView) => void;
  kind: AudienceFilter["kind"];
  pickOnly?: boolean;
  /** Without these the list is read only (a fixed audience). */
  actions?: PeopleActions;
  /** Something wrong with the last change, in a sentence. */
  problem?: string | null;
}> = ({ people, view, onView, kind, pickOnly = false, actions, problem }) => {
  const { data, error, loading, stale } = people;
  const editable = Boolean(actions);
  const users = kind === "users";
  const rows = data?.rows ?? [];
  const page = data?.page ?? view.page;
  const pages = data?.pages ?? 1;
  const removedView = view.scope === "removed";

  // Rows picked for an action, by row id, kept across pages; cleared when the list changes meaning.
  const [picked, setPicked] = useState<Map<string, AudiencePerson>>(() => new Map());
  const listKey = `${view.scope}|${pickOnly}`;
  const [pickedFor, setPickedFor] = useState(listKey);
  if (pickedFor !== listKey) {
    setPickedFor(listKey);
    setPicked(new Map());
  }

  const pickedHere = editable ? rows.filter((r) => picked.has(r.id)).length : 0;
  const allHere = rows.length > 0 && pickedHere === rows.length;
  const someHere = pickedHere > 0 && !allHere;
  // The header box shows "some of this page" as the indeterminate dash.
  const headerBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerBox.current) headerBox.current.indeterminate = someHere;
  }, [someHere]);

  const pick = (list: AudiencePerson[], on: boolean) =>
    setPicked((current) => {
      const next = new Map(current);
      for (const row of list) {
        if (on) next.set(row.id, row);
        else next.delete(row.id);
      }
      return next;
    });

  const act = (run: (rows: AudiencePerson[]) => void) => {
    run([...picked.values()]);
    setPicked(new Map());
  };

  const counts = data?.counts;
  const inAudience = counts ? peopleIn(counts, pickOnly) : 0;
  const removed = !pickOnly && counts ? counts.removed : 0;
  const added = !pickOnly && counts ? counts.added : 0;

  const columns = (editable ? 1 : 0) + (users ? 5 : 3);
  const empty = view.q
    ? `Nobody here matches "${view.q}".`
    : removedView
      ? "Nobody has been removed by hand."
      : pickOnly
        ? "Nobody picked yet. Use Add people to find them."
        : "Nobody matches these filters.";

  return (
    <section aria-label="People" className="flex flex-col gap-3">
      <div className="flex min-h-[34px] flex-wrap items-center gap-x-4 gap-y-2">
        {actions && picked.size ? (
          // The actions take the summary's place, so the table never moves under the pointer.
          <div role="toolbar" aria-label="Selected people" className="flex min-w-0 flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold tabular-nums">{n(picked.size)} selected</span>
            {removedView ? (
              <button type="button" onClick={() => act(actions.putBack)} className={BTN_PRIMARY}>
                Put back
              </button>
            ) : (
              <button type="button" onClick={() => act(actions.remove)} className="rounded-md border border-[#b23c26] bg-white px-3 py-1.5 text-xs font-bold text-[#b23c26] hover:bg-[#fbeae6]">
                Remove from audience
              </button>
            )}
            <button type="button" onClick={() => setPicked(new Map())} className="text-xs font-semibold text-gray-600 hover:text-black hover:underline">
              Clear
            </button>
          </div>
        ) : removedView ? (
          <p className="flex min-w-0 items-center gap-3 text-sm font-semibold" aria-live="polite">
            <button type="button" onClick={() => onView({ ...view, scope: "audience", page: 1, q: "" })} className="inline-flex items-center gap-1 text-gray-600 hover:text-black hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to the audience
            </button>
            <span>Removed by hand · {n(removed)}</span>
            {loading ? <LoaderCircle className="h-4 w-4 flex-none animate-spin text-gray-500" aria-label="Loading" /> : null}
          </p>
        ) : (
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm font-semibold" aria-live="polite">
            {counts ? (
              <>
                <span>
                  {n(inAudience)} {inAudience === 1 ? "person" : "people"}
                </span>
                {removed ? (
                  <>
                    <span className="text-gray-400">·</span>
                    <button
                      type="button"
                      onClick={() => onView({ ...view, scope: "removed", page: 1, q: "" })}
                      className="underline decoration-gray-400 underline-offset-2 hover:decoration-black">
                      {n(removed)} removed
                    </button>
                  </>
                ) : null}
                {added ? (
                  <>
                    <span className="text-gray-400">·</span>
                    <span>{n(added)} added</span>
                  </>
                ) : null}
                {inAudience > 0 ? (
                  <>
                    <span className="text-gray-400">·</span>
                    <span className="font-normal text-gray-600">{counts.reachable >= inAudience ? "all can get mail" : `${n(counts.reachable)} can get mail`}</span>
                  </>
                ) : null}
              </>
            ) : (
              "Counting people"
            )}
            {loading ? <LoaderCircle className="ml-1 h-4 w-4 flex-none animate-spin text-gray-500" aria-label="Loading" /> : null}
          </p>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-gray-400" aria-hidden />
            <input
              type="search"
              aria-label="Search name or email"
              placeholder="Search name or email"
              className={cn(INPUT_SM, "w-56 pl-7")}
              value={view.q}
              maxLength={200}
              onChange={(e) => onView({ ...view, q: e.target.value, page: 1 })}
            />
          </label>
          {actions && !removedView ? (
            <button type="button" onClick={actions.add} className={BTN}>
              <UserPlus className="h-3.5 w-3.5" aria-hidden /> Add people
            </button>
          ) : null}
        </div>
      </div>

      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {problem ? (
        <p role="alert" className="text-xs text-[#b23c26]">
          {problem}
        </p>
      ) : null}

      <div className={cn("overflow-x-auto rounded-md border border-gray-300 bg-white transition-opacity", stale && data ? "opacity-60" : "")}>
        <table className={TABLE}>
          <thead>
            <tr>
              {editable ? (
                <th className="w-10 py-2 pl-4 pr-1">
                  <input
                    ref={headerBox}
                    type="checkbox"
                    aria-label={allHere ? "Unselect everyone on this page" : "Select everyone on this page"}
                    disabled={!rows.length}
                    checked={allHere}
                    onChange={() => pick(rows, !allHere)}
                    className="h-4 w-4 cursor-pointer accent-black align-middle"
                  />
                </th>
              ) : null}
              <th className={TH}>Name</th>
              <th className={TH}>Email</th>
              {users ? <th className={TH}>Plan</th> : null}
              <th className={TH}>{users ? "Signed up" : "Joined"}</th>
              {users ? <th className={TH}>Last seen</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => {
                const on = picked.has(row.id);
                return (
                  <tr key={row.id} className={cn(ROW, "hover:bg-gray-50", on && "bg-[#f7fbdc] hover:bg-[#f2f8cc]")}>
                    {editable ? (
                      <td className="py-2.5 pl-4 pr-1">
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.name || row.email}`}
                          checked={on}
                          onChange={(e) => pick([row], e.target.checked)}
                          className="h-4 w-4 cursor-pointer accent-black align-middle"
                        />
                      </td>
                    ) : null}
                    <td className={cn(TD, "py-2.5")}>
                      <span className="flex min-w-0 items-center gap-2">
                        {row.userId ? (
                          <Link href={`/heroshima/users/${row.userId}`} className="font-semibold hover:underline">
                            {row.name || <span className="font-normal text-gray-400">No name</span>}
                          </Link>
                        ) : row.name ? (
                          <span className="font-semibold">{row.name}</span>
                        ) : (
                          <span className="text-gray-400">No name</span>
                        )}
                        {editable && !pickOnly && !removedView && row.how === "added" ? <Chip tone="outline">Added</Chip> : null}
                      </span>
                    </td>
                    <td className={cn(TD, "py-2.5")}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{row.email}</span>
                        {row.reachable ? null : <Chip tone="gray">Can&apos;t get mail</Chip>}
                      </span>
                    </td>
                    {users ? <td className={cn(TD, "whitespace-nowrap py-2.5")}>{planLabel(row.plan)}</td> : null}
                    <td className={cn(TD, "whitespace-nowrap py-2.5 tabular-nums text-gray-600")}>{day(row.signedUpAt)}</td>
                    {users ? <td className={cn(TD, "whitespace-nowrap py-2.5 tabular-nums text-gray-600")}>{day(row.lastSeenAt)}</td> : null}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns} className="px-4 py-10 text-center text-sm text-gray-500">
                  {error && !data ? (
                    "The list couldn't be loaded."
                  ) : data ? (
                    <span className="flex flex-col items-center gap-3">
                      {empty}
                      {actions && pickOnly && !view.q ? (
                        <button type="button" onClick={actions.add} className={BTN}>
                          <UserPlus className="h-3.5 w-3.5" aria-hidden /> Add people
                        </button>
                      ) : null}
                    </span>
                  ) : (
                    <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-gray-400" aria-label="Loading people" />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs text-gray-500">
          <Segmented label="People a page" value={String(view.pageSize)} options={SIZE_OPTIONS} onChange={(v) => onView({ ...view, pageSize: Number(v) as AudiencePageSize, page: 1 })} />a page
        </span>
        <span className="flex items-center gap-2">
          <button type="button" className={BTN} disabled={page <= 1} onClick={() => onView({ ...view, page: Math.max(1, page - 1) })}>
            Previous
          </button>
          <span className="text-xs tabular-nums text-gray-600">
            Page {page} of {pages}
          </span>
          <button type="button" className={BTN} disabled={page >= pages} onClick={() => onView({ ...view, page: Math.min(pages, page + 1) })}>
            Next
          </button>
        </span>
      </div>
    </section>
  );
};

export default PeopleTable;
