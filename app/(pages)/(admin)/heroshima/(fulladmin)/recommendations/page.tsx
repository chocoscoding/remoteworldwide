import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { listAdminRecommendations } from "@/libs/recommendations-admin";
import {
  ADMIN_RECOMMENDATION_FILTERS,
  RECOMMENDATION_STAGE_LABELS,
  type AdminRecommendationFilter,
  type AdminRecommendationItem,
} from "@/app/lib/recommendations/types";

// The reviewers' table. Server-rendered through the same session-forwarding
// server actions as the form (libs/recommendations-admin.ts); the (fulladmin)
// layout hides it from anyone who isn't an ADMIN, and the backend refuses
// them regardless.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const FILTER_LABELS: Record<AdminRecommendationFilter, string> = { open: "Open", closed: "Closed", all: "All" };

const OUTCOME_BADGE: Record<NonNullable<AdminRecommendationItem["outcome"]>, string> = {
  connected: "bg-[#e1f073] text-[#222325]",
  passed: "bg-gray-200 text-gray-700",
  expired: "bg-[#fdeae6] text-[#b23c26]",
};

const day = (value: string | Date | null) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** Where a row stands, in one short phrase: what the reviewer would want to know first. */
function status(r: AdminRecommendationItem): string {
  if (r.outcome) return r.outcome;
  if (r.answeredAt) return `Answered ${day(r.answeredAt)}`;
  if (r.questions.length) return `Waiting on the candidate${r.expiresAt ? ` · by ${day(r.expiresAt)}` : ""}`;
  return "Waiting on the company's questions";
}

const Page = async ({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) => {
  const params = await searchParams;
  const filter: AdminRecommendationFilter = (ADMIN_RECOMMENDATION_FILTERS as readonly string[]).includes(params.status ?? "") ? (params.status as AdminRecommendationFilter) : "open";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { data: rows, count } = await listAdminRecommendations({ page, status: filter, q });
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const href = (next: { status?: AdminRecommendationFilter; page?: number }) => {
    const search = new URLSearchParams({ status: next.status ?? filter });
    if (q) search.set("q", q);
    if ((next.page ?? 1) > 1) search.set("page", String(next.page));
    return `/heroshima/recommendations?${search.toString()}`;
  };

  return (
    <div className="w-full min-h-screen p-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recommendations</h1>
          <p className="text-sm text-gray-500">
            Candidates our reviewers put straight in front of a company. The company asks a question or two, the candidate answers, and they&apos;re connected.
          </p>
        </div>
        <Link
          href="/heroshima/recommendations/create"
          className="flex items-center p-2 bg-primary text-white outline outline-2 outline-primary font-bold rounded-md drop-shadow-primary2-hover transition-all">
          <PlusCircle className="w-5 h-5 mr-2" />
          New recommendation
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {ADMIN_RECOMMENDATION_FILTERS.map((f) => (
            <Link
              key={f}
              href={href({ status: f })}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${f === filter ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
              {FILTER_LABELS[f]}
            </Link>
          ))}
        </div>
        {/* A plain GET form: the search is a URL, so it survives a refresh and needs no client code. */}
        <form method="get" className="flex flex-1 gap-2">
          <input type="hidden" name="status" value={filter} />
          <input name="q" defaultValue={q} placeholder="Search by candidate email or name, company or role" className="min-w-[220px] flex-1 rounded-md border border-gray-300 p-2 text-sm" />
          <button type="submit" className="rounded-md border-2 border-primary bg-white px-3 text-sm font-bold">
            Search
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-10 text-center text-gray-500">
          {q ? `Nothing matches “${q}”.` : filter === "open" ? "No open recommendations. Put someone forward." : "Nothing here yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-3">Candidate</th>
                <th className="p-3">Company · role</th>
                <th className="p-3">Stage</th>
                <th className="p-3">Status</th>
                <th className="p-3">Reviewer</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-t ${r.outcome ? "bg-gray-50/60 text-gray-500" : ""}`}>
                  <td className="p-3">
                    <Link href={`/heroshima/recommendations/${r.id}`} className="font-semibold text-primary hover:underline">
                      {r.candidate?.name ?? r.candidate?.email ?? "Deleted account"}
                    </Link>
                    {r.candidate?.email && r.candidate.name && <div className="text-xs text-gray-500">{r.candidate.email}</div>}
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-gray-800">{r.company}</div>
                    <div className="text-xs text-gray-500">{r.role}</div>
                  </td>
                  <td className="p-3 text-xs text-gray-700">{RECOMMENDATION_STAGE_LABELS[r.stageIndex] ?? r.stage}</td>
                  <td className="p-3 text-xs">
                    {r.outcome ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${OUTCOME_BADGE[r.outcome]}`}>{r.outcome}</span>
                    ) : (
                      <span className="text-gray-700">{status(r)}</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-gray-600">{r.reviewer.name}</td>
                  <td className="p-3 text-xs tabular-nums text-gray-600">{day(r.createdAt)}</td>
                </tr>
              ))}
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
