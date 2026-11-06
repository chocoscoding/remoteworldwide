"use client";

// The users table's picking and Export (/heroshima/users). The page renders each row's cells on the
// server and hands them in; this adds a checkbox per row, a header checkbox for the page, Gmail's
// banner to widen a full page to everyone the search matches, and the sticky bar whose Export opens
// the field picker (UserExportDialog). Ticks are kept in sessionStorage, so they survive paging and
// searching (the search box is a plain GET form, a full page load). The rules live in
// app/lib/tracking/export.ts.

import { useEffect, useRef, useState, useSyncExternalStore, type FC, type ReactNode } from "react";
import { Download } from "lucide-react";
import { NO_PICK, nextPick, parsePick, pickView, type PickAction, type UsersPick } from "@/app/lib/tracking/export";
import type { UserSort } from "@/app/lib/tracking/types";
import UserExportDialog from "./UserExportDialog";

const STORAGE_KEY = "rww-admin-users-pick";

// A sessionStorage-backed store for useSyncExternalStore: the server and the first client render
// see nothing ticked, then the saved pick, with no hydration mismatch. The parsed value is cached
// per raw string so the snapshot keeps its identity between renders.
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedPick: UsersPick = NO_PICK;

const readPick = (): UsersPick => {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPick = parsePick(raw);
  }
  return cachedPick;
};

const writePick = (next: UsersPick) => {
  try {
    if (!next.picked.length && !next.every) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep the pick in memory for this page.
    cachedRaw = JSON.stringify(next);
    cachedPick = next;
  }
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export interface UsersTableRow {
  id: string;
  /** Who the checkbox is for, for screen readers. */
  label: string;
  /** The row's other cells, rendered on the server. */
  cells: ReactNode;
}

export interface UsersTableProps {
  rows: UsersTableRow[];
  /** The other header cells. */
  head: ReactNode;
  columns: number;
  empty: string;
  q: string;
  sort: UserSort;
  /** Everyone the search matches, on every page: what "Select all" takes. */
  total: number;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

const UsersTable: FC<UsersTableProps> = ({ rows, head, columns, empty, q, sort, total }) => {
  const stored = useSyncExternalStore(subscribe, readPick, () => NO_PICK);
  const [exporting, setExporting] = useState(false);
  const pageBox = useRef<HTMLInputElement>(null);
  const exportButton = useRef<HTMLButtonElement>(null);

  const pageIds = rows.map((r) => r.id);
  const view = pickView(stored, pageIds, q, total);
  const dispatch = (action: PickAction) => writePick(nextPick(readPick(), action, pageIds, q, total));
  const matching = q ? ` matching “${q}”` : "";
  const unticked = view.state.every?.except.length ?? 0;

  // `indeterminate` is a property, not an attribute: React can't set it from markup.
  useEffect(() => {
    if (pageBox.current) pageBox.current.indeterminate = view.someOnPage;
  }, [view.someOnPage]);

  const summary =
    view.every && !unticked ? `All ${plural(view.count, "person", "people")}${matching} selected` : `${plural(view.count, "person", "people")} selected`;

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {view.count ? summary : ""}
      </p>

      {(view.offerEvery || view.every) && (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md bg-secondary/30 px-4 py-2.5 text-sm br-plain">
          {view.every ? (
            <>
              <span>
                All <strong>{plural(Math.max(total, view.count), "person", "people")}</strong>
                {matching} are selected
                {unticked ? `, less ${unticked.toLocaleString("en-GB")} unticked` : ""}.
              </span>
              <button
                type="button"
                onClick={() => dispatch({ type: "clear" })}
                className="font-bold text-primary underline underline-offset-2 hover:no-underline">
                Clear selection
              </button>
            </>
          ) : (
            <>
              <span>
                All <strong>{pageIds.length}</strong> on this page are selected.
              </span>
              <button
                type="button"
                onClick={() => dispatch({ type: "every" })}
                className="font-bold text-primary underline underline-offset-2 hover:no-underline">
                Select all {plural(total, "person", "people")}
                {matching}
              </button>
            </>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-gray-300 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" className="w-10 p-0">
                <label className="flex cursor-pointer items-center justify-center px-3 py-2">
                  <input
                    ref={pageBox}
                    type="checkbox"
                    checked={view.allOnPage}
                    disabled={!rows.length}
                    onChange={() => dispatch({ type: "page" })}
                    className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-30"
                  />
                  <span className="sr-only">{view.allOnPage ? "Unselect everyone on this page" : "Select everyone on this page"}</span>
                </label>
              </th>
              {head}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const checked = view.checked.has(r.id);
              return (
                <tr key={r.id} className={`border-b border-gray-100 last:border-0 ${checked ? "bg-secondary/25" : "hover:bg-[#fbfbf7]"}`}>
                  <td className="p-0">
                    <label className="flex cursor-pointer items-center justify-center px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => dispatch({ type: "row", id: r.id })}
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                      <span className="sr-only">Select {r.label}</span>
                    </label>
                  </td>
                  {r.cells}
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={columns + 1} className="px-3 py-6 text-center text-gray-500">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {view.count > 0 && (
        <section
          aria-label="Selected people"
          className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-primary px-4 py-3 text-white">
          <span className="text-sm font-semibold">{summary}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "clear" })}
              className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:border-white">
              Clear
            </button>
            <button
              ref={exportButton}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setExporting(true)}
              className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm font-bold text-primary br-shadow-press br-white">
              <Download className="h-4 w-4" aria-hidden />
              Export
            </button>
          </div>
        </section>
      )}

      <UserExportDialog open={exporting} onOpenChange={setExporting} pick={view.state} count={view.count} sort={sort} returnFocus={exportButton} />
    </>
  );
};

export default UsersTable;
