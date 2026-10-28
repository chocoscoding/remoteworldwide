import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BackendError } from "@/app/lib/backend";
import { getUserDetail, getUserEvents } from "@/libs/analytics-admin";
import { TRACK_KIND_LABELS, TRACK_KINDS, ago, dateTime, type AdminUserDetail, type EventPage } from "@/app/lib/tracking/types";
import { BarList, DayColumns, Panel, StatTile, TierBadge } from "@/app/components/ADMIN/analytics/Charts";
import Timeline from "./Timeline";

// One person: their plan and credits, what they use and how much, where and on what, what they
// spent credits on, their streak actions, and below it all, everything they did, newest first
// (Timeline.tsx pages through it). Admin only: the (fulladmin) layout, the server actions'
// requireAdminAction and the backend's isAdmin.
export const dynamic = "force-dynamic";
export const metadata = { title: "User", robots: { index: false, follow: false } };

const Page = async ({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string; feature?: string }> }) => {
  const { id } = await params;
  const filters = await searchParams;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();

  let detail: AdminUserDetail;
  let first: EventPage;
  try {
    [detail, first] = await Promise.all([getUserDetail(id), getUserEvents(id, { kind: filters.kind, feature: filters.feature })]);
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
  const kind = (TRACK_KINDS as readonly string[]).includes(filters.kind ?? "") ? filters.kind : undefined;
  const feature = filters.feature?.trim() || undefined;
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
          <h2 className="text-sm font-bold">Everything they did{feature ? ` in ${feature}` : ""}</h2>
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
            {feature ? (
              <Link href={filterHref({ kind })} className="self-center px-1 text-xs font-semibold text-gray-500 hover:underline">
                Clear {feature}
              </Link>
            ) : null}
          </nav>
        </div>
        <Timeline key={`${kind ?? ""}|${feature ?? ""}`} userId={user.id} initial={first} kind={kind} feature={feature} />
      </section>
    </div>
  );
};

export default Page;
