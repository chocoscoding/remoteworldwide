import Link from "next/link";
import { listCoverageRequests, setCoverageRequestStatus } from "@/libs/coverage-admin";
import {
  ADMIN_COVERAGE_FILTERS,
  COVERAGE_REQUEST_STATUSES,
  type AdminCoverageFilter,
  type AdminCoverageRequestItem,
  type CoverageRequestKind,
  type CoverageRequestStatus,
} from "@/app/lib/coverage/types";

// The coverage review queue: pages the extension could not read, sent in with
// "Request support", or reported when someone added the site to the extension
// by hand ("Add this page" — those rows carry the Added by user badge, and the
// toggle beside the status filters narrows to them). Server-rendered through
// session-forwarding server actions (libs/coverage-admin.ts), like the
// recommendations table; the (fulladmin) layout hides it from anyone who isn't
// an ADMIN, and the backend refuses them regardless.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const FILTER_LABELS: Record<AdminCoverageFilter, string> = { open: "Open", reviewed: "Reviewed", dismissed: "Dismissed", all: "All" };

const KIND_LABELS: Record<CoverageRequestKind, string> = { job: "Job posting", form: "Application form" };

/** The button that moves a row TO this status. */
const ACTION_LABELS: Record<CoverageRequestStatus, string> = { open: "Reopen", reviewed: "Mark reviewed", dismissed: "Dismiss" };

const STATUS_BADGE: Record<CoverageRequestStatus, string> = {
  open: "bg-[#e1f073] text-[#222325]",
  reviewed: "bg-gray-200 text-gray-700",
  dismissed: "bg-[#fdeae6] text-[#b23c26]",
};

const when = (value: string | Date) =>
  new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * The backend only ever stores an http(s) origin, so this is belt and braces:
 * anything else is printed, never made clickable.
 */
const pageUrl = (r: AdminCoverageRequestItem): string | null => (/^https?:\/\//i.test(r.origin) ? `${r.origin}${r.path}` : null);

const Page = async ({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; added?: string; notice?: string }> }) => {
  const params = await searchParams;
  const filter: AdminCoverageFilter = (ADMIN_COVERAGE_FILTERS as readonly string[]).includes(params.status ?? "") ? (params.status as AdminCoverageFilter) : "open";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  // Filtered by the backend, not here: a page of 50 filtered after the fact would page wrongly.
  const addedOnly = params.added === "1";
  const notice = (params.notice ?? "").trim();
  const { data: rows, count } = await listCoverageRequests({ page, status: filter, added: addedOnly });
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // The added-only toggle rides along with every link unless one flips it, so switching status or
  // page keeps it; flipping it, like switching status, starts again from page 1.
  const href = (next: { status?: AdminCoverageFilter; page?: number; added?: boolean }) => {
    const search = new URLSearchParams({ status: next.status ?? filter });
    if (next.added ?? addedOnly) search.set("added", "1");
    if ((next.page ?? 1) > 1) search.set("page", String(next.page));
    return `/heroshima/coverage?${search.toString()}`;
  };
  // Where a row's button sends the admin back to: this filter and page, so working the queue
  // never jumps them to the top.
  const here = href({ page });

  return (
    <div className="w-full min-h-screen p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Coverage requests</h1>
        <p className="text-sm text-gray-500">
          Pages the extension couldn&apos;t read, sent in with &ldquo;Request support&rdquo; or reported when someone added the site by hand with &ldquo;Add this page&rdquo;
          (marked <span className="font-semibold text-gray-700">Added by user</span>). Only the site and path are kept — never the query string — so a link may need the
          posting found again from there.
        </p>
      </div>

      {notice && <div className="mb-4 rounded-md border border-[#f3c4b8] bg-[#fdeae6] p-3 text-sm text-[#b23c26]">{notice}</div>}

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {ADMIN_COVERAGE_FILTERS.map((f) => (
          <Link
            key={f}
            href={href({ status: f })}
            className={`rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${f === filter ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
            {FILTER_LABELS[f]}
          </Link>
        ))}
        {/* Not another status: it narrows whichever one is showing, so it sits apart, dashed while off. */}
        <span aria-hidden className="mx-1 h-5 w-px bg-gray-300" />
        <Link
          href={href({ added: !addedOnly })}
          title={addedOnly ? "Show every request again" : "Only pages people added to the extension by hand"}
          className={`rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${addedOnly ? "border-black bg-black text-[#e1f073]" : "border-dashed border-gray-400 bg-white text-gray-700 hover:border-black"}`}>
          Added by user
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-10 text-center text-gray-500">
          {addedOnly ? "No pages added by hand here." : filter === "open" ? "Nothing waiting. Every page sent in has been looked at." : "Nothing here yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-3">Page</th>
                <th className="p-3">Kind</th>
                <th className="p-3">Note</th>
                <th className="p-3">Requester</th>
                <th className="p-3">Sent</th>
                <th className="p-3">Status</th>
                <th className="p-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const url = pageUrl(r);
                return (
                  <tr key={r.id} className={`border-t align-top ${r.status === "open" ? "" : "bg-gray-50/60 text-gray-500"}`}>
                    <td className="max-w-[360px] p-3">
                      {url ? (
                        // no-referrer: opening a reported page must not tell that site it was looked at from here.
                        <a href={url} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" title={url} className="font-semibold text-primary hover:underline">
                          {r.origin.replace(/^https?:\/\//i, "")}
                        </a>
                      ) : (
                        <span className="font-semibold">{r.origin}</span>
                      )}
                      {r.addedByUser && (
                        <span
                          title="Added to the extension by hand with “Add this page”: it couldn't read this site on its own."
                          className="ml-2 whitespace-nowrap rounded-full bg-[#222325] px-2 py-0.5 align-middle text-[10.5px] font-extrabold uppercase tracking-wide text-[#e1f073]">
                          Added by user
                        </span>
                      )}
                      <div className="break-all text-xs text-gray-500" title={r.path}>
                        {r.path.length > 160 ? `${r.path.slice(0, 160)}…` : r.path}
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-3 text-xs text-gray-700">{KIND_LABELS[r.kind] ?? r.kind}</td>
                    <td className="max-w-[320px] whitespace-pre-line break-words p-3 text-xs text-gray-700">{r.note ?? <span className="text-gray-400">—</span>}</td>
                    <td className="p-3 text-xs">
                      {r.requester ? (
                        <>
                          <div className="font-semibold text-gray-800">{r.requester.name ?? r.requester.email ?? r.requester.id}</div>
                          {r.requester.name && r.requester.email && <div className="text-gray-500">{r.requester.email}</div>}
                        </>
                      ) : (
                        <span className="text-gray-400">Deleted account</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3 text-xs tabular-nums text-gray-600">{when(r.createdAt)}</td>
                    <td className="p-3 text-xs">
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col items-stretch gap-1.5">
                        {COVERAGE_REQUEST_STATUSES.filter((s) => s !== r.status).map((s) => (
                          <form key={s} action={setCoverageRequestStatus}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value={s} />
                            <input type="hidden" name="back" value={here} />
                            <button
                              type="submit"
                              className={`w-full whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${s === "reviewed" ? "border-primary bg-primary text-white" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
                              {ACTION_LABELS[s]}
                            </button>
                          </form>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={href({ page: page - 1 })} className="font-semibold text-primary hover:underline">
              ← Newer
            </Link>
          )}
          <span className="text-gray-500">
            Page {page} of {pages} · {count} total
          </span>
          {page < pages && (
            <Link href={href({ page: page + 1 })} className="font-semibold text-primary hover:underline">
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default Page;
