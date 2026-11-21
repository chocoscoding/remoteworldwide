import Link from "next/link";
import Image from "next/image";
import { BackendError } from "@/app/lib/backend";
import { getUsersSummary, listUsers } from "@/libs/analytics-admin";
import {
  USER_RANGES,
  USER_RANGE_LABELS,
  USER_RANGE_SHORT,
  USER_SORTS,
  USER_SORT_LABELS,
  ago,
  type AdminUserList,
  type UserRange,
  type UserSort,
  type UsersSummary,
} from "@/app/lib/tracking/types";
import { X } from "lucide-react";
import { MAIL_LEVEL_LABELS, isMailLevel, type MailLevel } from "@/app/lib/mail/userMail";
import { Panel, StatTile, TierBadge, percent } from "@/app/components/ADMIN/analytics/Charts";
import UsersGrowthChart from "@/app/components/ADMIN/analytics/UsersGrowthChart";
import UsersTable from "@/app/components/ADMIN/analytics/UsersTable";
import MailLevelBadge from "./MailLevelBadge";
import UsersFilters from "./UsersFilters";

// Every account. On top, four totals and accounts over time with new accounts per period (range
// picked in the header: 30 or 90 days, 12 months, all time), from GET /api/admin/analytics/users/summary,
// which also gives the outreach filter its counts. Under it, the people: last active first by default,
// searchable, sortable and filterable by outreach level. A row opens the
// person's own page (/heroshima/users/[id]) with everything they did. Server-rendered through
// session-forwarding server actions (libs/analytics-admin.ts); the (fulladmin) layout and the
// backend both require an ADMIN. Tick some people, or all of them, to export chosen fields as CSV or
// TXT: UsersTable adds the checkboxes and Export around the cells rendered here. With a mail level
// picked, "Select all" means everyone at that level the search matches (the export is sent the level
// too). The charts and the list load separately, so one failing leaves the other on screen.
export const dynamic = "force-dynamic";
export const metadata = { title: "Users", robots: { index: false, follow: false } };

const PAGE_SIZE = 50;

const chip = (on: boolean) =>
  `rounded-md border px-3 py-1.5 text-xs font-bold ${on ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`;

/** A filter in use, beside the Filters button; its x clears it. */
const activeChip = "inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold hover:border-black";

/** "Clicked 3 d ago", "Clicked just now". */
const clicked = (iso: string) => `Clicked ${ago(iso).replace(/^Just now$/, "just now")}`;

const n = (value: number) => value.toLocaleString("en-GB");

/** A backend refusal's message; anything else is a real fault and is thrown. */
const failureOf = (result: PromiseSettledResult<unknown>): string | null => {
  if (result.status === "fulfilled") return null;
  if (!(result.reason instanceof BackendError)) throw result.reason;
  return result.reason.message || `The backend answered ${result.reason.status}.`;
};

/** "12 more than the 90 d before", "Same as the 30 d before"; for all time, since when. */
const addedHint = (s: UsersSummary) => {
  if (s.addedBefore === null) return `Since ${new Date(`${s.from}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}`;
  const diff = s.added - s.addedBefore;
  const span = `the ${USER_RANGE_SHORT[s.range]} before`;
  return diff > 0 ? `${n(diff)} more than ${span}` : diff < 0 ? `${n(-diff)} fewer than ${span}` : `Same as ${span}`;
};

const Failed = ({ what, failure }: { what: string; failure: string | null }) => (
  <div role="alert" className="rounded-md border border-[#f3c4b8] bg-[#fdeae6] p-4 text-sm text-[#b23c26]">
    {what} couldn&apos;t be loaded: {failure ?? "no answer from the backend."}
  </div>
);

const Page = async ({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string; mail?: string; range?: string }> }) => {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const sort: UserSort = (USER_SORTS as readonly string[]).includes(params.sort ?? "") ? (params.sort as UserSort) : "last_seen";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const mail: MailLevel | undefined = isMailLevel(params.mail) ? params.mail : undefined;
  const range: UserRange = (USER_RANGES as readonly string[]).includes(params.range ?? "") ? (params.range as UserRange) : "90";

  const [listResult, summaryResult] = await Promise.allSettled([listUsers({ q, page, sort, mail }), getUsersSummary(range)]);
  const list: AdminUserList | null = listResult.status === "fulfilled" ? listResult.value : null;
  const summary: UsersSummary | null = summaryResult.status === "fulfilled" ? summaryResult.value : null;
  const listFailure = failureOf(listResult);
  const summaryFailure = failureOf(summaryResult);

  /** Every link keeps what it doesn't change; `mail: null` clears the level. A new sort, level or search starts at page 1. */
  const href = (next: { sort?: UserSort; page?: number; mail?: MailLevel | null; range?: UserRange; q?: string }) => {
    const search = new URLSearchParams({ sort: next.sort ?? sort });
    const query = next.q ?? q;
    if (query) search.set("q", query);
    const level = next.mail === undefined ? mail : next.mail;
    if (level) search.set("mail", level);
    const r = next.range ?? range;
    if (r !== "90") search.set("range", r);
    const p = next.page ?? (next.range ? page : 1);
    if (p > 1) search.set("page", String(p));
    return `/heroshima/users?${search.toString()}`;
  };
  const pages = Math.max(1, list?.pages ?? 1);
  const first = list && list.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = list ? Math.min(list.total, first + list.items.length - 1) : 0;

  const total = summary?.total ?? 0;
  const paying = summary ? summary.plans.basic + summary.plans.pro + summary.plans.ultra : 0;
  const active7 = summary ? summary.lastSeen.day + summary.lastSeen.week : 0;
  return (
    <div className="w-full min-h-screen p-4 lg:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-gray-500">Everyone with an account: how many, how it&apos;s growing, and what each person does.</p>
        </div>
        <nav aria-label="Chart range" className="flex flex-wrap gap-1.5">
          {USER_RANGES.map((r) => (
            <Link key={r} href={href({ range: r })} aria-current={r === range ? "page" : undefined} className={chip(r === range)} scroll={false}>
              {USER_RANGE_LABELS[r]}
            </Link>
          ))}
        </nav>
      </header>

      {!summary ? (
        <Failed what="The charts" failure={summaryFailure} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Accounts" value={total} hint={`${n(summary.verified)} verified their email (${percent(total ? summary.verified / total : 0)})`} dark />
            <StatTile label={`New, ${USER_RANGE_SHORT[range]}`} value={summary.added} hint={addedHint(summary)} />
            <StatTile label="Active, 7 d" value={active7} hint={`${percent(total ? active7 / total : 0)} of accounts · ${n(summary.lastSeen.day)} in the last day`} />
            <StatTile label="Paying" value={paying} hint={`${percent(total ? paying / total : 0)} · Basic ${n(summary.plans.basic)} · Pro ${n(summary.plans.pro)} · Ultra ${n(summary.plans.ultra)}`} />
          </div>

          <Panel title="New accounts" aside={<span className="text-xs text-gray-500">{USER_RANGE_LABELS[range]}, UTC days</span>}>
            <UsersGrowthChart daily={summary.daily} before={summary.before} />
          </Panel>
        </div>
      )}

      <section id="people" aria-labelledby="people-title" className="mt-8 scroll-mt-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="people-title" className="text-lg font-bold">
            People
          </h2>
          {list && (
            <span className="text-sm text-gray-500">
              {n(list.total)} {q || mail ? (list.total === 1 ? "matches" : "match") : list.total === 1 ? "account" : "accounts"}
            </span>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <form method="get" action="/heroshima/users#people" role="search" className="flex min-w-[260px] flex-1 gap-2 lg:max-w-xl">
            <input type="hidden" name="sort" value={sort} />
            {mail ? <input type="hidden" name="mail" value={mail} /> : null}
            {range !== "90" ? <input type="hidden" name="range" value={range} /> : null}
            <label htmlFor="users-search" className="sr-only">
              Search by name, email or id
            </label>
            <input
              id="users-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search by name, email or id"
              className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white p-2 text-sm"
            />
            <button type="submit" className="rounded-md bg-white px-3 text-sm font-bold br-plain-press">
              Search
            </button>
            {q && (
              <Link href={`${href({ q: "" })}#people`} className="self-center whitespace-nowrap text-xs font-semibold text-gray-500 hover:text-primary hover:underline">
                Clear search
              </Link>
            )}
          </form>

          <UsersFilters sort={sort} mail={mail} q={q} range={range} counts={summary?.mail ?? null} />

          {/* What the Filters pane has set, each one cleared by its x. */}
          {sort !== "last_seen" || mail ? (
            <div aria-label="Filters in use" className="flex flex-wrap items-center gap-1.5">
              {sort !== "last_seen" ? (
                <Link href={`${href({ sort: "last_seen" })}#people`} className={activeChip} aria-label={`Clear the sort: ${USER_SORT_LABELS[sort]}`}>
                  {USER_SORT_LABELS[sort]}
                  <X className="h-3 w-3" aria-hidden />
                </Link>
              ) : null}
              {mail ? (
                <Link href={`${href({ mail: null })}#people`} className={activeChip} aria-label={`Clear the outreach filter: ${MAIL_LEVEL_LABELS[mail]}`}>
                  {MAIL_LEVEL_LABELS[mail]}
                  {summary ? <span className="tabular-nums text-gray-400">{n(summary.mail[mail])}</span> : null}
                  <X className="h-3 w-3" aria-hidden />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {!list ? (
          <Failed what="The users" failure={listFailure} />
        ) : (
          <>
            <UsersTable
              q={q}
              sort={sort}
              total={list.total}
              columns={8}
              mail={mail}
              empty={mail ? "Nobody matches that filter." : q ? "Nobody matches that search." : "No accounts yet."}
              head={
                <>
                  <th className="px-3 py-2 font-semibold">Person</th>
                  <th className="px-3 py-2 font-semibold">Plan</th>
                  <th className="px-3 py-2 font-semibold">Last active</th>
                  <th className="px-3 py-2 text-right font-semibold" title="Things they did in the last 30 days">
                    30 d
                  </th>
                  <th className="px-3 py-2 text-right font-semibold" title="Things they did since we started counting">
                    All time
                  </th>
                  <th className="px-3 py-2 font-semibold">Outreach</th>
                  <th className="px-3 py-2 font-semibold">Device</th>
                  <th className="px-3 py-2 font-semibold">Joined</th>
                </>
              }
              rows={list.items.map((u) => ({
                id: u.id,
                label: u.email || u.name || u.id,
                cells: (
                  <>
                    <td className="px-3 py-2.5">
                      <Link href={`/heroshima/users/${u.id}`} className="flex items-center gap-2.5">
                        <Image
                          src={u.image || "/images/noimage.png"}
                          alt=""
                          width={32}
                          height={32}
                          referrerPolicy="no-referrer"
                          unoptimized
                          className="h-8 w-8 flex-none rounded-full border border-gray-200 object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block max-w-[260px] truncate font-semibold hover:underline">{u.name || "No name"}</span>
                          <span className="block max-w-[260px] truncate text-xs text-gray-500">
                            {u.email}
                            {u.role !== "USER" ? ` · ${u.role.toLowerCase()}` : ""}
                            {!u.verified ? " · unverified" : ""}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <TierBadge tier={u.tier} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block whitespace-nowrap" title={u.lastSeenAt ?? undefined}>
                        {ago(u.lastSeenAt)}
                      </span>
                      <span className="block max-w-[200px] truncate text-xs text-gray-500" title={u.lastPath ?? undefined}>
                        {u.lastFeature ?? "Not seen yet"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{n(u.events30d)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{n(u.eventCount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {u.mail ? (
                        <span className="flex items-center gap-1.5">
                          <MailLevelBadge level={u.mail.level} />
                          <span className="text-xs text-gray-500" title={`${n(u.mail.sent30d)} mails in the last 30 days`}>
                            {u.mail.lastClickAt ? clicked(u.mail.lastClickAt) : u.mail.sent30d ? `${u.mail.sent30d} in 30 d` : null}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Not known</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{u.device ? `${u.device.browser}, ${u.device.os}` : "Unknown"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Unknown"}
                    </td>
                  </>
                ),
              }))}
            />

            <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-gray-500">
                {list.total ? `Showing ${n(first)} to ${n(lastShown)} of ${n(list.total)}` : "Nobody to show"} · page {n(page)} of {n(pages)}
              </span>
              <span className="flex gap-2">
                {page > 1 ? (
                  <Link href={`${href({ page: page - 1 })}#people`} className="rounded-md bg-white px-3 py-1.5 font-bold br-plain-press">
                    ← Previous
                  </Link>
                ) : null}
                {page < pages ? (
                  <Link href={`${href({ page: page + 1 })}#people`} className="rounded-md bg-white px-3 py-1.5 font-bold br-plain-press">
                    Next →
                  </Link>
                ) : null}
              </span>
            </nav>
          </>
        )}
      </section>
    </div>
  );
};

export default Page;
