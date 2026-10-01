import Link from "next/link";
import { BackendError } from "@/app/lib/backend";
import { listWaitlist } from "@/libs/waitlist-admin";
import { waitingMatching } from "@/app/lib/waitlist/admin";
import { WAITLIST_ADMIN_FILTER_LABELS, WAITLIST_ADMIN_FILTERS, type WaitlistAdminFilter, type WaitlistAdminList } from "@/app/lib/waitlist/types";
import Client from "./Client";

// The early-access waitlist, first in line first. The admin picks the ones still
// waiting (or every waiting signup matching the search) and gives them Pro for a
// month with 100 credits; the backend applies it and emails each person.
// Server-rendered through session-forwarding server actions
// (libs/waitlist-admin.ts), like the recommendations table; the (fulladmin)
// layout hides it from anyone who isn't an ADMIN, and the backend refuses them
// regardless. The table itself is a client component for the checkboxes.
export const dynamic = "force-dynamic";

const Page = async ({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) => {
  const params = await searchParams;
  const filter: WaitlistAdminFilter = (WAITLIST_ADMIN_FILTERS as readonly string[]).includes(params.status ?? "") ? (params.status as WaitlistAdminFilter) : "all";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  let list: WaitlistAdminList | null = null;
  let failure: string | null = null;
  try {
    list = await listWaitlist({ q, status: filter, page });
  } catch (error) {
    // A refusal or a backend that isn't there yet says so in place; anything else is the error page's.
    if (!(error instanceof BackendError)) throw error;
    failure = error.message || `The backend answered ${error.status}.`;
  }

  // Switching tab keeps the search and starts at page 1; paging keeps both.
  const href = (next: { status?: WaitlistAdminFilter; page?: number }) => {
    const search = new URLSearchParams({ status: next.status ?? filter });
    if (q) search.set("q", q);
    if ((next.page ?? 1) > 1) search.set("page", String(next.page));
    return `/heroshima/waitlist?${search.toString()}`;
  };

  const pages = Math.max(1, list?.pages ?? 1);

  return (
    <div className="w-full min-h-screen p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Waitlist</h1>
        <p className="text-sm text-gray-500">
          Everyone who joined early access, first in line first. Pick the ones still waiting and give them Pro for a month with 100 credits: those with an account start
          now, the rest when they sign up, and each gets an email. Anyone already paying for a plan is skipped.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {WAITLIST_ADMIN_FILTERS.map((f) => (
            <Link
              key={f}
              href={href({ status: f })}
              aria-current={f === filter ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${f === filter ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
              {WAITLIST_ADMIN_FILTER_LABELS[f]}
              {list && <span className={`tabular-nums font-semibold ${f === filter ? "text-white/70" : "text-gray-400"}`}>{list.counts[f] ?? 0}</span>}
            </Link>
          ))}
        </nav>
        {/* A plain GET form: the search is a URL, so it survives a refresh and needs no client code. */}
        <form method="get" role="search" className="flex flex-1 gap-2">
          <input type="hidden" name="status" value={filter} />
          <label htmlFor="waitlist-search" className="sr-only">
            Search by email
          </label>
          <input
            id="waitlist-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by email"
            className="min-w-[220px] flex-1 rounded-md border border-gray-300 p-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-white px-3 text-sm font-bold br-plain-press">
            Search
          </button>
          {q && (
            <Link href={`/heroshima/waitlist?status=${filter}`} className="self-center text-xs font-semibold text-gray-500 hover:text-primary hover:underline">
              Clear search
            </Link>
          )}
        </form>
      </div>

      {failure !== null || !list ? (
        <div role="alert" className="rounded-md border border-[#f3c4b8] bg-[#fdeae6] p-4 text-sm text-[#b23c26]">
          The waitlist couldn&apos;t be loaded: {failure ?? "no answer from the backend."}
        </div>
      ) : (
        <>
          {/* Keyed by what is showing: another tab, search or page starts the picking afresh. */}
          <Client key={`${filter}|${q}|${page}`} items={list.items} filter={filter} q={q} waitingTotal={waitingMatching(filter, list)} />

          {pages > 1 && (
            <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-sm">
              {page > 1 && (
                <Link href={href({ page: page - 1 })} className="font-semibold text-primary hover:underline">
                  ← Earlier in line
                </Link>
              )}
              <span className="text-gray-500">
                Page {page} of {pages} · {list.total} total
              </span>
              {page < pages && (
                <Link href={href({ page: page + 1 })} className="font-semibold text-primary hover:underline">
                  Later in line →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
};

export default Page;
