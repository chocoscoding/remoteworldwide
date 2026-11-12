import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BackendError } from "@/app/lib/backend";
import { getUserDetail, getUserEvents, getUserMail, getUserMailEvents } from "@/libs/analytics-admin";
import { TRACK_KIND_LABELS, TRACK_KINDS, ago, dateTime, type AdminUserDetail, type EventPage } from "@/app/lib/tracking/types";
import { MAIL_FILTER, type MailTimelinePage, type UserMailDetail } from "@/app/lib/mail/userMail";
import { BarList, DayColumns, Panel, StatTile, TierBadge } from "@/app/components/ADMIN/analytics/Charts";
import { CheckoutBadge, checkoutWhat } from "@/app/components/ADMIN/analytics/Checkout";
import MailPanel from "./MailPanel";
import Timeline from "./Timeline";

// One person: their plan and credits, what they use and how much, where and on what, what they
// spent credits on, the payments they started and how each ended, their mail (MailPanel.tsx), their
// streak actions, and below it all, everything they did, newest first, their mail rows woven in
// (Timeline.tsx pages through it). Admin only: the (fulladmin) layout, the server actions'
// requireAdminAction and the backend's isAdmin.
export const dynamic = "force-dynamic";
export const metadata = { title: "User", robots: { index: false, follow: false } };

type Soft<T> = { data: T; error: null } | { data: null; error: string };

/** The mail parts are extra: a backend that refuses them (or doesn't have them yet) leaves the rest of the page standing. */
const softly = <T,>(promise: Promise<T>): Promise<Soft<T>> =>
  promise.then(
    (data) => ({ data, error: null }),
    (error: unknown) => {
      if (!(error instanceof BackendError)) throw error;
      return { data: null, error: error.message || `the backend answered ${error.status}` };
    },
  );

const NO_EVENTS: EventPage = { items: [], next: null };

const Page = async ({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string; feature?: string }> }) => {
  const { id } = await params;
  const filters = await searchParams;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();

  const mailOnly = filters.kind === MAIL_FILTER;
  const kind = mailOnly ? MAIL_FILTER : (TRACK_KINDS as readonly string[]).includes(filters.kind ?? "") ? filters.kind : undefined;
  const feature = mailOnly ? undefined : filters.feature?.trim() || undefined;
  // Mail rows join the unfiltered timeline and make up the Mail filter; the other filters are about the site.
  const withMailRows = mailOnly || (!kind && !feature);

  let detail: AdminUserDetail;
  let first: EventPage;
  let mail: Soft<UserMailDetail>;
  let mailRows: Soft<MailTimelinePage> | null;
  try {
    [detail, first, mail, mailRows] = await Promise.all([
      getUserDetail(id),
      mailOnly ? Promise.resolve(NO_EVENTS) : getUserEvents(id, { kind, feature }),
      softly(getUserMail(id)),
      withMailRows ? softly(getUserMailEvents(id)) : Promise.resolve(null),
    ]);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) notFound();
    if (!(error instanceof BackendError)) throw error;
    return (
      <div className="w-full p-4">
        <div role="alert" className="rounded-md border border-[#f3c4b8] bg-[#fdeae6] p-4 text-sm text-[#b23c26]">
          This person couldn&apos;t be loaded: {error.message || `the backend answered ${error.status}.`}
        </div>
      </div>
    );
  }

  const { user, plan, counts } = detail;
  const filterHref = (next: { kind?: string; feature?: string }) => {
    const search = new URLSearchParams();
    if (next.kind) search.set("kind", next.kind);
    if (next.feature) search.set("feature", next.feature);
    const s = search.toString();
    return `/heroshima/users/${user.id}${s ? `?${s}` : ""}#timeline`;
  };

  return (
    <div className="w-full min-h-screen p-4">
      <Link href="/heroshima/users" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-black">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Users
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Image
          src={user.image || "/images/noimage.png"}
          alt=""
          width={56}
          height={56}
          referrerPolicy="no-referrer"
          unoptimized
          className="h-14 w-14 rounded-full border border-gray-300 object-cover"
        />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            {user.name || "No name"} <TierBadge tier={plan.tier} />
          </h1>
          <p className="text-sm text-gray-500">
            {user.email} · {user.role.toLowerCase()} · {user.verified ? "verified" : "not verified"} · joined {user.createdAt ? dateTime(user.createdAt) : "unknown"} · id {user.id}
          </p>
          <p className="text-sm text-gray-700">
            Last active <strong>{ago(user.lastSeenAt)}</strong>
            {user.lastFeature ? (
              <>
                {" "}
                on <strong>{user.lastFeature}</strong> ({user.lastPath})
              </>
            ) : null}
            {user.device ? ` · ${user.device.browser} on ${user.device.os}${user.device.mobile ? " (phone)" : ""}` : ""}
            {user.firstSeenAt ? ` · first seen ${dateTime(user.firstSeenAt)}` : ""}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatTile
          label="Plan"
          value={plan.tier[0].toUpperCase() + plan.tier.slice(1)}
          hint={[plan.status !== "none" ? plan.status : null, plan.interval, plan.periodEnd ? `to ${dateTime(plan.periodEnd).split(",")[0]}` : null, plan.cancelAtPeriodEnd ? "cancelling" : null, plan.provider]
            .filter(Boolean)
            .join(" · ")}
          dark
        />
        <StatTile label="Credits" value={plan.creditBalance} />
        <StatTile label="Events, 30 d" value={user.events30d} hint={`${user.eventCount.toLocaleString("en-GB")} all time`} />
        <StatTile label="Visits, 30 d" value={counts.sessions30d} />
        <StatTile label="Applications" value={counts.applications} />
        <StatTile label="Saved jobs" value={counts.savedJobs} />
        <StatTile label="Documents" value={counts.documents} />
        <StatTile label="Sign-ins" value={counts.signIns} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Activity, last 30 days" className="lg:col-span-2">
          <DayColumns days={detail.daily.map((d) => ({ day: d.day, value: d.events }))} />
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            {TRACK_KINDS.map((k) => (
              <span key={k}>
                {TRACK_KIND_LABELS[k]}: <strong className="tabular-nums">{detail.kinds[k] ?? 0}</strong>
              </span>
            ))}
            <span className="text-gray-400">(last 90 days)</span>
          </p>
        </Panel>
        <Panel title="Devices">
          {detail.devices.length ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {detail.devices.map((d) => (
                <li key={`${d.browser}-${d.os}-${d.mobile}`} className="flex justify-between gap-2">
                  <span>
                    {d.browser} on {d.os}
                    {d.mobile ? " (phone)" : ""}
                  </span>
                  <span className="text-xs text-gray-500">{ago(d.lastAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Nothing recorded yet.</p>
          )}
        </Panel>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Panel title="What they use (90 days)">
          <BarList rows={detail.features.map((f) => ({ label: f.feature, value: f.count, sub: ago(f.lastAt), href: filterHref({ feature: f.feature }) }))} />
        </Panel>
        <Panel title="Pages they open">
          <BarList rows={detail.pages.map((p) => ({ label: p.path, value: p.count }))} />
        </Panel>
        <Panel title="Credits">
          {detail.spends.length ? (
            <ol className="flex max-h-[320px] flex-col overflow-y-auto text-sm">
              {detail.spends.map((s, i) => (
                <li key={`${s.at}-${i}`} className="flex justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0">
                  <span className="min-w-0">
                    <span className="block truncate">{s.feature ?? s.reason.replace("_", " ")}</span>
                    <span className="block text-xs text-gray-500">{dateTime(s.at)}</span>
                  </span>
                  <span className={`flex-none tabular-nums font-semibold ${s.delta < 0 ? "text-[#b23c26]" : "text-[#3d6b12]"}`}>
                    {s.delta > 0 ? "+" : ""}
                    {s.delta}
                    <span className="ml-1 text-xs font-normal text-gray-500">→ {s.balanceAfter}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-500">No credit movements.</p>
          )}
        </Panel>
      </div>

      <Panel title="Payments they started" className="mb-4" aside={<span className="text-xs text-gray-500">newest first</span>}>
        {detail.checkouts?.length ? (
          <ol className="text-sm">
            {detail.checkouts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-gray-100 py-2 last:border-0">
                <time className="w-[128px] flex-none text-xs tabular-nums text-gray-500" dateTime={c.createdAt}>
                  {dateTime(c.createdAt)}
                </time>
                <CheckoutBadge checkout={c} />
                <span className="font-medium">{checkoutWhat(c)}</span>
                {c.completedAt ? <span className="text-xs text-gray-500">paid {dateTime(c.completedAt)}</span> : null}
                {!c.provider ? <span className="text-xs text-gray-500">reserved while card payments were off</span> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-gray-500">No payments started.</p>
        )}
      </Panel>

      <MailPanel mail={mail.data} error={mail.error} />

      {detail.streakActions.length ? (
        <Panel title="Streak actions" className="mb-4">
          <p className="flex flex-wrap gap-1.5 text-xs">
            {detail.streakActions.map((a, i) => (
              <span key={`${a.at}-${i}`} className="rounded-full border border-gray-300 px-2 py-0.5" title={dateTime(a.at)}>
                {a.kind} · {a.day}
              </span>
            ))}
          </p>
        </Panel>
      ) : null}

      <section id="timeline" className="rounded-md border border-gray-300 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Everything they did{feature ? ` in ${feature}` : mailOnly ? " with our mail" : ""}</h2>
          <nav aria-label="Filter the timeline" className="flex flex-wrap gap-1.5">
            <Link
              href={filterHref({ feature })}
              aria-current={!kind ? "page" : undefined}
              className={`rounded border px-2 py-1 text-xs font-bold ${!kind ? "border-black bg-black text-[#e1f073]" : "border-gray-300 hover:border-black"}`}>
              All
            </Link>
            {TRACK_KINDS.map((k) => (
              <Link
                key={k}
                href={filterHref({ kind: k, feature })}
                aria-current={k === kind ? "page" : undefined}
                className={`rounded border px-2 py-1 text-xs font-bold ${k === kind ? "border-black bg-black text-[#e1f073]" : "border-gray-300 hover:border-black"}`}>
                {TRACK_KIND_LABELS[k]}
              </Link>
            ))}
            <Link
              href={filterHref({ kind: MAIL_FILTER })}
              aria-current={mailOnly ? "page" : undefined}
              title="Mails they opened or clicked, visits from mail, and what was credited to a mail"
              className={`rounded border px-2 py-1 text-xs font-bold ${mailOnly ? "border-black bg-black text-[#e1f073]" : "border-gray-300 hover:border-black"}`}>
              Outreach
            </Link>
            {feature ? (
              <Link href={filterHref({ kind })} className="self-center px-1 text-xs font-semibold text-gray-500 hover:underline">
                Clear {feature}
              </Link>
            ) : null}
          </nav>
        </div>
        <Timeline
          key={`${kind ?? ""}|${feature ?? ""}`}
          userId={user.id}
          initial={first}
          mail={mailRows?.data ?? null}
          mailFailed={Boolean(mailRows?.error)}
          kind={kind}
          feature={feature}
        />
      </section>
    </div>
  );
};

export default Page;
