"use client";

import { useState, type FC } from "react";
import { LoaderCircle, Search } from "lucide-react";
import type { AudienceFilter, AudiencePerson } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import { BTN, BTN_PRIMARY, Chip, ErrorBox, INPUT_SM } from "../ui";
import { n } from "../format";
import Drawer from "../playbook/Drawer";
import { planLabel } from "./PeopleTable";
import { useAudiencePeople } from "./useAudiencePeople";

const PAGE_SIZE = 25;

/**
 * Find people to add to an audience: every account (or subscriber) a page at a time, searched by name
 * or email. People already in the audience show "In audience" and can't be picked; the rest are picked
 * with their checkbox and added with "Add N people". The list is only asked for while the drawer is open.
 */
const AddPeopleDrawer: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The audience as it stands on screen, unsaved picks included. */
  filter: AudienceFilter;
  onAdd: (rows: AudiencePerson[]) => void;
}> = ({ open, onOpenChange, filter, onAdd }) => {
  const [picked, setPicked] = useState<Map<string, AudiencePerson>>(() => new Map());

  const close = (next: boolean) => {
    if (!next) setPicked(new Map());
    onOpenChange(next);
  };

  const add = () => {
    onAdd([...picked.values()]);
    close(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={close}
      title="Add people"
      description={filter.kind === "subscribers" ? "Search every subscriber and pick who joins this audience." : "Search every account and pick who joins this audience."}
      footer={
        <>
          <button type="button" onClick={add} disabled={!picked.size} className={BTN_PRIMARY}>
            {picked.size ? `Add ${n(picked.size)} ${picked.size === 1 ? "person" : "people"}` : "Add people"}
          </button>
          <button type="button" onClick={() => close(false)} className={BTN}>
            Cancel
          </button>
        </>
      }>
      {open ? <Finder filter={filter} picked={picked} setPicked={setPicked} /> : null}
    </Drawer>
  );
};

/** The search and the list, mounted only while the drawer is open so nothing is asked for before. */
const Finder: FC<{
  filter: AudienceFilter;
  picked: Map<string, AudiencePerson>;
  setPicked: (update: (current: Map<string, AudiencePerson>) => Map<string, AudiencePerson>) => void;
}> = ({ filter, picked, setPicked }) => {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const people = useAudiencePeople({ filter, scope: "everyone", q, page, pageSize: PAGE_SIZE });
  const { data, error, loading, stale } = people;
  const rows = data?.rows ?? [];
  const pages = data?.pages ?? 1;
  const shownPage = data?.page ?? page;
  const users = filter.kind === "users";

  const toggle = (row: AudiencePerson, on: boolean) =>
    setPicked((current) => {
      const next = new Map(current);
      if (on) next.set(row.id, row);
      else next.delete(row.id);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <label className="relative flex items-center">
        <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-gray-400" aria-hidden />
        <input
          type="search"
          autoFocus
          aria-label="Search name or email"
          placeholder="Search name or email"
          className={cn(INPUT_SM, "w-full pl-7")}
          value={q}
          maxLength={200}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </label>

      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <ul className={cn("flex flex-col divide-y divide-gray-200 rounded-md border border-gray-300 transition-opacity", stale && data ? "opacity-60" : "")}>
        {rows.length ? (
          rows.map((row) => {
            const inAlready = row.inAudience;
            const on = picked.has(row.id);
            return (
              <li key={row.id}>
                <label className={cn("flex items-center gap-3 px-3 py-2.5", inAlready ? "cursor-default" : "cursor-pointer hover:bg-gray-50", on && "bg-[#f7fbdc]")}>
                  <input
                    type="checkbox"
                    aria-label={inAlready ? `${row.name || row.email} is already in the audience` : `Pick ${row.name || row.email}`}
                    disabled={inAlready}
                    checked={inAlready || on}
                    onChange={(e) => toggle(row, e.target.checked)}
                    className="h-4 w-4 flex-none accent-black disabled:opacity-40"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-semibold", inAlready && "text-gray-500")}>{row.name || <span className="font-normal text-gray-400">No name</span>}</span>
                    <span className="block truncate text-xs text-gray-500">{row.email}</span>
                  </span>
                  <span className="flex flex-none items-center gap-1.5">
                    {users && row.plan ? <span className="text-xs text-gray-500">{planLabel(row.plan)}</span> : null}
                    {inAlready ? <Chip tone="outline">In audience</Chip> : row.how === "removed" ? <Chip tone="gray">Removed</Chip> : null}
                    {row.reachable ? null : <Chip tone="gray">Can&apos;t get mail</Chip>}
                  </span>
                </label>
              </li>
            );
          })
        ) : error && !data ? null : (
          <li className="px-3 py-8 text-center text-sm text-gray-500">
            {data ? (q ? `Nobody matches "${q}".` : "Nobody found.") : <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-gray-400" aria-label="Loading people" />}
          </li>
        )}
      </ul>

      <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
        <span className="flex items-center gap-1.5 tabular-nums">
          {data ? `${n(data.total)} found` : ""}
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-gray-500" aria-label="Loading" /> : null}
        </span>
        <span className="flex items-center gap-2">
          <button type="button" className={BTN} disabled={shownPage <= 1} onClick={() => setPage(Math.max(1, shownPage - 1))}>
            Previous
          </button>
          <span className="tabular-nums">
            {shownPage} of {pages}
          </span>
          <button type="button" className={BTN} disabled={shownPage >= pages} onClick={() => setPage(Math.min(pages, shownPage + 1))}>
            Next
          </button>
        </span>
      </div>
    </div>
  );
};

export default AddPeopleDrawer;
