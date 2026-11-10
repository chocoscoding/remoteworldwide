import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackendError } from "@/app/lib/backend";
import { getCardEvents } from "@/libs/analytics-admin";
import { ACTIVITY_CARDS, ACTIVITY_CARD_LABELS, TRACK_KIND_LABELS, cardRowHref, dateTime, type ActivityCard, type CardEventPage } from "@/app/lib/tracking/types";
import { StatTile } from "@/app/components/ADMIN/analytics/Charts";
import { KIND_STYLE, details } from "@/app/components/ADMIN/analytics/EventRow";
import { CheckoutBadge, checkoutWhat } from "@/app/components/ADMIN/analytics/Checkout";

// One row of the Activity page's cards, opened: every event that row counted in the same range,
// newest first, 50 a page, with who did it, when and where; a call that started a payment also
// says how that payment ended. The address keeps the card, the row
// (?key=), the range (?days=) and the page (?page=), so it can be shared or reloaded. Admin only:
// the (fulladmin) layout, the server action's requireAdminAction and the backend's isAdmin.
export const dynamic = "force-dynamic";
export const metadata = { title: "Activity", robots: { index: false, follow: false } };

const RANGES = [7, 30, 90] as const;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The page numbers to offer: the first, the last, and two either side of this one, with gaps as null. */
const pageWindow = (page: number, pages: number): (number | null)[] => {
  const wanted = [...new Set([1, pages, ...[-2, -1, 0, 1, 2].map((d) => page + d)])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  wanted.forEach((p, i) => {
    if (i && p - wanted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
};

const Page = async ({ params, searchParams }: { params: Promise<{ card: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) => {
  const { card: cardParam } = await params;
  if (!(ACTIVITY_CARDS as readonly string[]).includes(cardParam)) notFound();
  const card = cardParam as ActivityCard;
  const query = await searchParams;
  const key = first(query.key);
  if (key === undefined) notFound();
  const asked = Number.parseInt(first(query.days) ?? "30", 10);
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30;
  const page = Math.max(1, Number.parseInt(first(query.page) ?? "1", 10) || 1);

  let data: CardEventPage | null = null;
  let failure: string | null = null;
  try {
    data = await getCardEvents({ card, key, days, page });
  } catch (error) {
    if (!(error instanceof BackendError)) throw error;
    failure = error.message || `The backend answered ${error.status}.`;
  }

  const label = key || "(none)";
  const pages = Math.max(1, data?.pages ?? 1);

  return (
    <div className="w-full min-h-screen p-4">
      <Link href={`/heroshima/activity?days=${days}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-black">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Activity
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold">
            {ACTIVITY_CARD_LABELS[card]}: <span className="font-semibold">{label}</span>
          </h1>
          <p className="text-sm text-gray-500">Every event this row counted in the last {days} days, newest first.</p>
        </div>
        <nav aria-label="Range" className="flex gap-1.5">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={cardRowHref(card, key, r)}
              aria-current={r === days ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold ${r === days ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
              {r} days
            </Link>
          ))}
        </nav>
      </div>

      {!data ? (
        <div role="alert" className="rounded-md border border-[#f3c4b8] bg-[#fdeae6] p-4 text-sm text-[#b23c26]">
          These events couldn&apos;t be loaded: {failure ?? "no answer from the backend."}
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label={`Events, ${days} d`} value={data.total} dark />
            <StatTile label="People" value={data.people} hint="Signed in" />
            {data.visitors ? <StatTile label="Visitors" value={data.visitors} hint="Signed out, analytics accepted" /> : null}
          </div>

          <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-gray-300 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">When</th>
                  <th className="px-3 py-2 font-semibold">Person</th>
                  <th className="px-3 py-2 font-semibold">What</th>
                  <th className="px-3 py-2 font-semibold">Where</th>
                  <th className="px-3 py-2 font-semibold">Feature</th>
                  <th className="px-3 py-2 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length ? (
                  data.items.map((e) => {
                    const facts = details(e);
                    if (e.device) facts.push(`${e.device.browser}, ${e.device.os}${e.device.mobile ? " (phone)" : ""}`);
                    return (
                      <tr key={e.id} className="border-b border-gray-100 align-top last:border-0 hover:bg-[#fbfbf7]">
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-gray-600">
                          <time dateTime={e.at}>{dateTime(e.at)}</time>
                        </td>
                        <td className="max-w-[240px] px-3 py-2.5">
                          {e.user ? (
                            <Link href={`/heroshima/users/${e.user.id}`} className="group block min-w-0">
                              <span className="block truncate font-semibold group-hover:underline">{e.user.name || e.user.email || e.user.id}</span>
                              {e.user.name && e.user.email ? <span className="block truncate text-xs text-gray-500">{e.user.email}</span> : null}
                            </Link>
                          ) : (
                            <span className="text-gray-500">{e.userId ? "Deleted account" : "Visitor"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn("mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", KIND_STYLE[e.kind])}>{TRACK_KIND_LABELS[e.kind]}</span>
                          <span className="break-words font-medium">{e.name}</span>
                          {e.checkout !== undefined ? (
                            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-600">
                              {e.checkout ? (
                                <>
                                  <CheckoutBadge checkout={e.checkout} />
                                  {checkoutWhat(e.checkout)}
                                  {e.checkout.completedAt ? <span className="text-gray-500">paid {dateTime(e.checkout.completedAt)}</span> : null}
                                </>
                              ) : (
                                <span className="text-gray-500">No matching payment found</span>
                              )}
                            </span>
                          ) : null}
                        </td>
                        <td className="max-w-[240px] break-words px-3 py-2.5 text-gray-600">{e.path ?? ""}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{e.feature}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{facts.join(" · ")}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                      {data.total ? (
                        <>
                          Nothing on this page.{" "}
                          <Link href={cardRowHref(card, key, days)} className="font-semibold text-black hover:underline">
                            Back to page 1
                          </Link>
                        </>
                      ) : (
                        `Nothing recorded for this row in the last ${days} days.`
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            {page > 1 && (
              <Link href={cardRowHref(card, key, days, page - 1)} className="font-semibold text-primary hover:underline">
                ← Previous
              </Link>
            )}
            {pages > 1 ? (
              <ol className="flex flex-wrap items-center gap-1">
                {pageWindow(page, pages).map((p, i) =>
                  p === null ? (
                    <li key={`gap-${i}`} aria-hidden className="px-1 text-gray-400">
                      …
                    </li>
                  ) : (
                    <li key={p}>
                      <Link
                        href={cardRowHref(card, key, days, p)}
                        aria-current={p === page ? "page" : undefined}
                        className={cn(
                          "inline-flex min-w-[2rem] justify-center rounded-md border px-2 py-1 text-xs font-bold tabular-nums",
                          p === page ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black",
                        )}>
                        {p}
                      </Link>
                    </li>
                  ),
                )}
              </ol>
            ) : null}
            {page < pages && (
              <Link href={cardRowHref(card, key, days, page + 1)} className="font-semibold text-primary hover:underline">
                Next →
              </Link>
            )}
            <span className="text-gray-500">
              Page {page} of {pages} · {data.total.toLocaleString("en-GB")} events
            </span>
          </nav>
        </>
      )}
    </div>
  );
};

export default Page;
