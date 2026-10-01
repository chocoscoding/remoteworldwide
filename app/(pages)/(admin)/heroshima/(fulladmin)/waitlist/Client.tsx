"use client";

// The waitlist table and its picking: a checkbox per WAITING row, a header
// checkbox for every waiting row on this page, and once the page is fully
// picked, Gmail's banner to widen it to every waiting signup matching the
// search, on every page. Anything picked brings up the sticky bar; its button
// opens a confirm dialog that says exactly what happens, then grants (the
// server action, libs/waitlist-admin.ts), shows what came of it and refreshes
// the list behind it. The rules live in app/lib/waitlist/admin.ts.

import { useEffect, useRef, useState, useTransition, type FC } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Gift, LoaderCircle, X } from "lucide-react";
import { grantWaitlist } from "@/libs/waitlist-admin";
import {
  NO_SELECTION,
  formatDay,
  grantButtonLabel,
  grantConfirmCopy,
  grantHeadline,
  grantRequestFor,
  grantSummary,
  grantTimeline,
  isSelectable,
  nextSelection,
  planLabel,
  selectionView,
  type SelectionAction,
  type WaitlistSelection,
} from "@/app/lib/waitlist/admin";
import {
  WAITLIST_GRANT_CREDITS,
  type WaitlistAdminFilter,
  type WaitlistAdminItem,
  type WaitlistGrantRequest,
  type WaitlistGrantResult,
  type WaitlistStatus,
} from "@/app/lib/waitlist/types";

export interface WaitlistTableProps {
  items: WaitlistAdminItem[];
  filter: WaitlistAdminFilter;
  q: string;
  /** Waiting signups matching the search, on every page: what "select all" grants. */
  waitingTotal: number;
}

const STATUS_BADGE: Record<WaitlistStatus, string> = {
  waiting: "border border-gray-300 bg-white text-gray-700",
  granted: "bg-[#e1f073] text-[#222325]",
  active: "bg-[#222325] text-[#e1f073]",
  ended: "bg-gray-200 text-gray-600",
  skipped: "bg-[#fdeae6] text-[#b23c26]",
};

const EMPTY: Record<WaitlistAdminFilter, string> = {
  all: "Nobody has joined the waitlist yet.",
  waiting: "Nobody is waiting. Everyone on the list has been granted.",
  granted: "Nobody granted is still waiting to sign up.",
  active: "No Pro months running right now.",
  ended: "No Pro month has ended yet.",
  skipped: "Nobody was skipped.",
};

type Stage = { phase: "confirm"; request: WaitlistGrantRequest; count: number; error?: string } | { phase: "done"; result: WaitlistGrantResult };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

const WaitlistTable: FC<WaitlistTableProps> = ({ items, filter, q, waitingTotal }) => {
  const router = useRouter();
  const [selection, setSelection] = useState<WaitlistSelection>(NO_SELECTION);
  const [open, setOpen] = useState(false);
  // Kept apart from `open` so the dialog's words stay put while it animates closed.
  const [stage, setStage] = useState<Stage | null>(null);
  const [granting, startGranting] = useTransition();

  const pageBox = useRef<HTMLInputElement>(null);
  const grantButton = useRef<HTMLButtonElement>(null);
  const doneButton = useRef<HTMLButtonElement>(null);
  const table = useRef<HTMLDivElement>(null);

  const view = selectionView(selection, items, waitingTotal);
  const dispatch = (action: SelectionAction) => setSelection((state) => nextSelection(state, action, items, waitingTotal));
  const matching = q ? ` matching “${q}”` : "";

  // `indeterminate` is a property, not an attribute: React can't set it from markup.
  useEffect(() => {
    if (pageBox.current) pageBox.current.indeterminate = view.someOnPage;
  }, [view.someOnPage]);

  // The confirm button goes when the result replaces it; focus moves to the result's own button.
  useEffect(() => {
    if (stage?.phase === "done") doneButton.current?.focus();
  }, [stage?.phase]);

  const openConfirm = () => {
    const request = grantRequestFor(view, q);
    if (!request) return;
    // The count is fixed here, so a refresh behind the dialog can't change what the admin agreed to.
    setStage({ phase: "confirm", request, count: view.count });
    setOpen(true);
  };

  const grant = () => {
    if (stage?.phase !== "confirm") return;
    const { request, count } = stage;
    startGranting(async () => {
      try {
        const res = await grantWaitlist(request);
        if (!res.data) {
          setStage({ phase: "confirm", request, count, error: res.error ?? "That was refused." });
          return;
        }
        setStage({ phase: "done", result: res.data });
        setSelection(NO_SELECTION);
        router.refresh();
      } catch {
        setStage({
          phase: "confirm",
          request,
          count,
          error: "That didn't go through. Reload the list to see whether anyone was granted before trying again.",
        });
      }
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 p-10 text-center text-gray-500">{q ? `Nobody here matches “${q}”.` : EMPTY[filter]}</div>
    );
  }

  return (
    <>
      {/* Always mounted, so screen readers hear the count change even as the bar comes and goes. */}
      <p className="sr-only" aria-live="polite">
        {view.everyWaiting ? `All ${plural(view.count, "waiting signup", "waiting signups")}${matching} selected` : view.count ? `${view.count} selected` : ""}
      </p>

      {(view.offerEvery || view.everyWaiting) && (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md bg-secondary/30 px-4 py-2.5 text-sm br-plain">
          {view.everyWaiting ? (
            <>
              <span>
                All <strong>{plural(view.count, "waiting signup", "waiting signups")}</strong>
                {matching} are selected.
              </span>
              <button type="button" onClick={() => dispatch({ type: "clear" })} className="font-bold text-primary underline underline-offset-2 hover:no-underline">
                Clear selection
              </button>
            </>
          ) : (
            <>
              <span>
                All <strong>{view.selectedIds.length}</strong> on this page are selected.
              </span>
              <button type="button" onClick={() => dispatch({ type: "every" })} className="font-bold text-primary underline underline-offset-2 hover:no-underline">
                Select all {plural(waitingTotal, "waiting signup", "waiting signups")}
                {matching}
              </button>
            </>
          )}
        </div>
      )}

      <div ref={table} tabIndex={-1} className="overflow-x-auto rounded-md bg-white outline-none br-plain">
        <table className="w-full text-sm">
          <caption className="sr-only">Waitlist, first in line first. Only people still waiting can be selected.</caption>
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" className="w-10 p-0">
                <label className="flex cursor-pointer items-center justify-center p-3">
                  <input
                    ref={pageBox}
                    type="checkbox"
                    checked={view.allOnPage}
                    disabled={view.selectableIds.length === 0}
                    onChange={() => dispatch({ type: "page" })}
                    className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-30"
                  />
                  <span className="sr-only">{view.allOnPage ? "Unselect every waiting signup on this page" : "Select every waiting signup on this page"}</span>
                </label>
              </th>
              <th scope="col" className="p-3">
                Place
              </th>
              <th scope="col" className="p-3">
                Email
              </th>
              <th scope="col" className="p-3">
                Plan eyed
              </th>
              <th scope="col" className="p-3">
                Joined
              </th>
              <th scope="col" className="p-3">
                Account
              </th>
              <th scope="col" className="p-3">
                Status
              </th>
              <th scope="col" className="p-3">
                Pro month
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const selectable = isSelectable(r);
              const checked = selectable && view.selectedIds.includes(r.id);
              const timeline = grantTimeline(r);
              return (
                <tr key={r.id} className={`border-t align-top transition-colors ${checked ? "bg-secondary/25" : ""}`}>
                  <td className="p-0">
                    <label className={`flex items-center justify-center p-3 ${selectable ? "cursor-pointer" : "cursor-not-allowed"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!selectable}
                        onChange={() => dispatch({ type: "row", id: r.id })}
                        className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-30"
                      />
                      <span className="sr-only">{selectable ? `Select ${r.email}` : `${r.email}: ${r.status}, can't be selected`}</span>
                    </label>
                  </td>
                  <td className="whitespace-nowrap p-3 font-semibold tabular-nums text-gray-700">{r.position != null ? `#${r.position}` : "—"}</td>
                  <td className="max-w-[320px] break-all p-3 font-semibold text-primary">{r.email}</td>
                  <td className="whitespace-nowrap p-3 text-xs text-gray-700">{planLabel(r)}</td>
                  <td className="whitespace-nowrap p-3 text-xs tabular-nums text-gray-600">{formatDay(r.joinedAt)}</td>
                  <td className="p-3 text-xs">{r.hasAccount ? <span className="font-semibold text-primary">Yes</span> : <span className="text-gray-400">No</span>}</td>
                  <td className="p-3 text-xs">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${STATUS_BADGE[r.status] ?? STATUS_BADGE.ended}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-600">
                    {timeline.length ? (
                      timeline.map((line, i) => (
                        <div key={i} className={i === 0 ? "whitespace-nowrap tabular-nums text-gray-700" : "text-gray-500"}>
                          {line}
                        </div>
                      ))
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {view.count > 0 && (
        <section
          aria-label="Selected signups"
          className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-primary px-4 py-3 text-white">
          <span className="text-sm font-semibold">
            {view.everyWaiting ? `All ${plural(view.count, "waiting signup", "waiting signups")}${matching}` : `${view.count} selected`}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "clear" })}
              className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:border-white">
              Clear
            </button>
            <button
              ref={grantButton}
              type="button"
              aria-haspopup="dialog"
              aria-label={`Give Pro for 1 month and ${WAITLIST_GRANT_CREDITS} credits to ${plural(view.count, "person", "people")}`}
              onClick={openConfirm}
              className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm font-bold text-primary br-shadow-press br-white">
              <Gift className="h-4 w-4" aria-hidden />
              {grantButtonLabel(view.count)}
            </button>
          </div>
        </section>
      )}

      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          // Not while the grant is in flight: the result has to land somewhere.
          if (!next && granting) return;
          setOpen(next);
        }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            onCloseAutoFocus={(event) => {
              // Back to the button that opened it while it's there; after a grant the bar is gone, so the table.
              event.preventDefault();
              (grantButton.current?.isConnected ? grantButton.current : table.current)?.focus();
            }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white br-bold duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-[15px] font-bold text-primary">
                  {stage?.phase === "done" ? grantHeadline(stage.result) : `Give Pro to ${plural(stage?.count ?? 0, "person", "people")}?`}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-black/65">
                  {stage?.phase === "done" ? "Everyone granted gets an email. The list behind this is up to date." : grantConfirmCopy(stage?.count ?? 0)}
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close
                disabled={granting}
                className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md bg-white text-[#222325] br-shadow-press">
                <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            <div className="border-t border-black/10 px-6 py-5">
              {stage?.phase === "done" ? (
                <>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-[13px]">
                    {grantSummary(stage.result).map(({ label, value }) => (
                      <div key={label} className="contents">
                        <dt className="text-black/65">{label}</dt>
                        <dd className="text-right font-bold tabular-nums text-primary">{value.toLocaleString("en-GB")}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex justify-end">
                    <DialogPrimitive.Close ref={doneButton} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-white br-shadow-press br-lime">
                      Done
                    </DialogPrimitive.Close>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[12px] leading-relaxed text-black/50">
                    {stage && "all" in stage.request
                      ? `Everyone still waiting${matching}, on every page. `
                      : `The ${plural(stage?.count ?? 0, "person", "people")} picked on this page. `}
                    Anyone already paying for a plan is skipped, and nobody is granted twice.
                  </p>
                  {stage?.phase === "confirm" && stage.error && (
                    <p role="alert" className="mt-3 rounded-md border border-[#f3c4b8] bg-[#fdeae6] p-3 text-[13px] text-[#b23c26]">
                      {stage.error}
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <DialogPrimitive.Close
                      disabled={granting}
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:border-black disabled:opacity-50">
                      Cancel
                    </DialogPrimitive.Close>
                    <button
                      type="button"
                      onClick={grant}
                      disabled={granting}
                      aria-busy={granting}
                      className="flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-bold text-primary br-shadow-press">
                      {granting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Gift className="h-4 w-4" aria-hidden />}
                      {granting ? "Granting…" : `Give Pro to ${plural(stage?.count ?? 0, "person", "people")}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};

export default WaitlistTable;
