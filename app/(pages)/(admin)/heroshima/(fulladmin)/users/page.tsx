import Link from "next/link";
import Image from "next/image";
import { BackendError } from "@/app/lib/backend";
import { listUsers } from "@/libs/analytics-admin";
import { USER_SORTS, USER_SORT_LABELS, ago, type AdminUserList, type UserSort } from "@/app/lib/tracking/types";
import { MAIL_LEVELS, MAIL_LEVEL_HINTS, MAIL_LEVEL_LABELS, isMailLevel, type MailLevel } from "@/app/lib/mail/userMail";
import { TierBadge } from "@/app/components/ADMIN/analytics/Charts";
import UsersTable from "@/app/components/ADMIN/analytics/UsersTable";
import MailLevelBadge from "./MailLevelBadge";

// Every account, last active first by default: their plan, when they were last here and where,
// how much they have done, and how they take our mail (level and last click, filterable by level).
// A row opens the person's own page (/heroshima/users/[id]) with
// everything they did. Server-rendered through session-forwarding server actions
// (libs/analytics-admin.ts); the (fulladmin) layout and the backend both require an ADMIN.
// Tick some people, or all of them, to export chosen fields as CSV or TXT: UsersTable adds the
// checkboxes and Export around the cells rendered here. With a mail level picked, "Select all"
// means everyone at that level the search matches (the export is sent the level too).
export const dynamic = "force-dynamic";
export const metadata = { title: "Users", robots: { index: false, follow: false } };

const chip = (on: boolean) =>
  `rounded-md border px-3 py-1.5 text-xs font-bold ${on ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`;

/** "Clicked 3 d ago", "Clicked just now". */
const clicked = (iso: string) => `Clicked ${ago(iso).replace(/^Just now$/, "just now")}`;

const Page = async ({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string; mail?: string }> }) => {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const sort: UserSort = (USER_SORTS as readonly string[]).includes(params.sort ?? "") ? (params.sort as UserSort) : "last_seen";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const mail: MailLevel | undefined = isMailLevel(params.mail) ? params.mail : undefined;

  let list: AdminUserList | null = null;
  let failure: string | null = null;
  try {
    list = await listUsers({ q, page, sort, mail });
  } catch (error) {
    if (!(error instanceof BackendError)) throw error;
    failure = error.message || `The backend answered ${error.status}.`;
  }

  /** `mail: null` clears the level; left out, it stays. */
  const href = (next: { sort?: UserSort; page?: number; mail?: MailLevel | null }) => {
    const search = new URLSearchParams({ sort: next.sort ?? sort });
    if (q) search.set("q", q);
    const level = next.mail === undefined ? mail : next.mail;
    if (level) search.set("mail", level);
    if ((next.page ?? 1) > 1) search.set("page", String(next.page));
    return `/heroshima/users?${search.toString()}`;
  };
  const pages = Math.max(1, list?.pages ?? 1);

  return (
    <div className="w-full min-h-screen p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-gray-500">Everyone with an account. Open someone to see what they use, how, and everything they did, newest first.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Sort" className="flex flex-wrap gap-1.5">
          {USER_SORTS.map((s) => (
            <Link
              key={s}
              href={href({ sort: s })}
              aria-current={s === sort ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold ${s === sort ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
              {USER_SORT_LABELS[s]}
            </Link>
          ))}
        </nav>
        <form method="get" role="search" className="flex flex-1 gap-2">
          <input type="hidden" name="sort" value={sort} />
          {mail ? <input type="hidden" name="mail" value={mail} /> : null}
          <label htmlFor="users-search" className="sr-only">
            Search by name, email or id
          </label>
          <input
            id="users-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by name, email or id"
            className="min-w-[220px] flex-1 rounded-md border border-gray-300 p-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-white px-3 text-sm font-bold br-plain-press">
            Search
          </button>
          {q && (
            <Link
              href={`/heroshima/users?sort=${sort}${mail ? `&mail=${mail}` : ""}`}
              className="self-center text-xs font-semibold text-gray-500 hover:text-primary hover:underline">
              Clear search
            </Link>
          )}
        </form>
      </div>

      <nav aria-label="Filter by outreach engagement" className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-bold uppercase tracking-wide text-gray-500">Outreach</span>
        <Link href={href({ mail: null })} aria-current={!mail ? "page" : undefined} className={chip(!mail)}>
          Anyone
        </Link>
        {MAIL_LEVELS.map((level) => (
          <Link key={level} href={href({ mail: level })} aria-current={level === mail ? "page" : undefined} title={MAIL_LEVEL_HINTS[level]} className={chip(level === mail)}>
            {MAIL_LEVEL_LABELS[level]}
          </Link>
        ))}
      </nav>

      {!list ? (
        <div role="alert" className="rounded-md border border-[#f3c4b8] bg-[#fdeae6] p-4 text-sm text-[#b23c26]">
          The users couldn&apos;t be loaded: {failure ?? "no answer from the backend."}
        </div>
      ) : (
        <>
          <UsersTable
            q={q}
            sort={sort}
            total={list.total}
            columns={9}
            mail={mail}
            empty={mail ? "Nobody matches that filter." : q ? "Nobody matches that search." : "No accounts yet."}
            head={
              <>
                <th className="px-3 py-2 font-semibold">Person</th>
                <th className="px-3 py-2 font-semibold">Plan</th>
                <th className="px-3 py-2 font-semibold">Last active</th>
                <th className="px-3 py-2 font-semibold">Last on</th>
                <th className="px-3 py-2 text-right font-semibold">30 d</th>
                <th className="px-3 py-2 text-right font-semibold">All time</th>
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
                  <td className="px-3 py-2">
                    <Link href={`/heroshima/users/${u.id}`} className="flex items-center gap-2.5">
                      <Image
                        src={u.image || "/images/noimage.png"}
                        alt=""
                        width={28}
                        height={28}
                        referrerPolicy="no-referrer"
                        unoptimized
                        className="h-7 w-7 flex-none rounded-full border border-gray-200 object-cover"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold hover:underline">{u.name || "No name"}</span>
                        <span className="block truncate text-xs text-gray-500">
                          {u.email}
                          {u.role !== "USER" ? ` · ${u.role.toLowerCase()}` : ""}
                          {!u.verified ? " · unverified" : ""}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <TierBadge tier={u.tier} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" title={u.lastSeenAt ?? undefined}>
                    {ago(u.lastSeenAt)}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-gray-600" title={u.lastPath ?? undefined}>
                    {u.lastFeature ?? "Not seen yet"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.events30d.toLocaleString("en-GB")}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{u.eventCount.toLocaleString("en-GB")}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {u.mail ? (
                      <span className="flex items-center gap-1.5">
                        <MailLevelBadge level={u.mail.level} />
                        <span className="text-xs text-gray-500" title={`${u.mail.sent30d.toLocaleString("en-GB")} mails in the last 30 days`}>
                          {u.mail.lastClickAt ? clicked(u.mail.lastClickAt) : u.mail.sent30d ? `${u.mail.sent30d} in 30 d` : null}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Not known</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{u.device ? `${u.device.browser}, ${u.device.os}` : "Unknown"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
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

          <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-sm">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className="font-semibold text-primary hover:underline">
                ← Previous
              </Link>
            )}
            <span className="text-gray-500">
              Page {page} of {pages} · {list.total.toLocaleString("en-GB")} people
            </span>
            {page < pages && (
              <Link href={href({ page: page + 1 })} className="font-semibold text-primary hover:underline">
                Next →
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
};

export default Page;
