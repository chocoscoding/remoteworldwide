import Link from "next/link";
import { BackendError } from "@/app/lib/backend";
import { getActivityOverview } from "@/libs/analytics-admin";
import type { ActivityOverview } from "@/app/lib/tracking/types";
import { BarList, DayColumns, Panel, StatTile } from "@/app/components/ADMIN/analytics/Charts";
import EventRow from "@/app/components/ADMIN/analytics/EventRow";

// Everything happening on the platform: who is active, what they use, which pages and presses, and
// the latest things people did. Read from the backend's tracking (libs/analytics-admin.ts); the
// (fulladmin) layout hides it from anyone who isn't an ADMIN and the backend refuses them too.
export const dynamic = "force-dynamic";
export const metadata = { title: "Activity", robots: { index: false, follow: false } };

const RANGES = [7, 30, 90] as const;

const Page = async ({ searchParams }: { searchParams: Promise<{ days?: string }> }) => {
  const asked = Number.parseInt((await searchParams).days ?? "30", 10);
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30;

  let data: ActivityOverview | null = null;
  let failure: string | null = null;
  try {
    data = await getActivityOverview(days);
  } catch (error) {
    if (!(error instanceof BackendError)) throw error;
    failure = error.message || `The backend answered ${error.status}.`;
  }

  return (
    <div className="w-full min-h-screen p-4">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="text-sm text-gray-500">What everyone is doing on Remote Worldwide. Open a person from the feed or from Users to see their own timeline.</p>
        </div>
        <nav aria-label="Range" className="flex gap-1.5">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/heroshima/activity?days=${r}`}
              aria-current={r === days ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold ${r === days ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
              {r} days
            </Link>
          ))}
        </nav>
      </div>

      {!data ? (
        <div role="alert" className="rounded-md border border-[#f3c4b8] bg-[#fdeae6] p-4 text-sm text-[#b23c26]">
          The activity couldn&apos;t be loaded: {failure ?? "no answer from the backend."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <StatTile label="Users" value={data.totals.users} dark />
            <StatTile label={`New, ${days} d`} value={data.totals.newUsers} />
            <StatTile label="Active today" value={data.totals.activeToday} />
            <StatTile label="Active 7 d" value={data.totals.active7} />
            <StatTile label="Active 30 d" value={data.totals.active30} />
            <StatTile label="Paying" value={data.totals.paying} hint={`Basic ${data.plans.basic} · Pro ${data.plans.pro} · Ultra ${data.plans.ultra}`} />
            <StatTile label={`Events, ${days} d`} value={data.totals.events} />
            <StatTile label={`Visitors, ${days} d`} value={data.totals.visitors} hint="Signed out, analytics accepted" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Active people a day">
              <DayColumns days={data.daily.map((d) => ({ day: d.day, value: d.users, title: `${d.day}: ${d.users} people, ${d.events} events, ${d.pageViews} pages` }))} />
            </Panel>
            <Panel title="Sign-ups a day">
              <DayColumns days={data.daily.map((d) => ({ day: d.day, value: d.signups, title: `${d.day}: ${d.signups} sign-ups` }))} />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="What people use" aside={<span className="text-xs text-gray-500">events · people</span>}>
              <BarList rows={data.features.map((f) => ({ label: f.feature, value: f.count, sub: `${f.users} ppl` }))} />
            </Panel>
            <Panel title="Pages">
              <BarList rows={data.pages.map((p) => ({ label: p.path, value: p.count, sub: `${p.users} ppl` }))} />
            </Panel>
            <Panel title="Presses">
              <BarList rows={data.clicks.map((c) => ({ label: c.name, value: c.count, sub: `${c.users} ppl` }))} />
            </Panel>
            <Panel title="Changes made (API)">
              <BarList rows={data.api.map((a) => ({ label: a.name, value: a.count, sub: `${a.users} ppl` }))} />
            </Panel>
            <Panel title="Devices">
              <BarList rows={data.devices.map((d) => ({ label: `${d.os}${d.mobile ? " (phone)" : ""}`, value: d.count }))} />
            </Panel>
            <Panel title="Plans">
              <BarList
                rows={(["free", "basic", "pro", "ultra"] as const).map((tier) => ({ label: tier[0].toUpperCase() + tier.slice(1), value: data.plans[tier] }))}
              />
            </Panel>
          </div>

          <Panel title="Latest, everyone" aside={<Link href="/heroshima/users" className="text-xs font-semibold hover:underline">All users →</Link>}>
            {data.recent.length ? (
              <ol>
                {data.recent.map((e) => (
                  <EventRow key={e.id} event={e} user={e.user} />
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-500">Nothing recorded yet.</p>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
};

export default Page;
