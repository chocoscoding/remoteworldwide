import type { FC } from "react";
import Link from "next/link";
import { getMailOverview, getMailSettings, getMailTable } from "@/libs/mail-admin";
import { DEFAULT_SETTINGS, EVENT_LABELS, TABLE_BYS, TABLE_BY_LABELS, type AlarmLevel, type Overview, type Rates, type TableBy, type Totals } from "@/app/lib/mail/types";
import { humanKey } from "@/app/lib/mail/userMail";
import { Panel, StatTile } from "@/app/components/ADMIN/analytics/Charts";
import MailShell from "@/app/components/mail/MailShell";
import { Bars, Bullet, CONTEXT, CONVERSION, Funnel, FunnelTrend, HBars, METRIC, SOURCE, TimeSeries, num } from "@/app/components/mail/charts";
import { FeedbackBlock, FunnelTable } from "@/app/components/mail/reports";
import { Empty, ErrorBox, Notice, StatusChip, TABLE, TD, TH, ROW } from "@/app/components/mail/ui";
import { EMPTY_TOTALS, money, n, pct, ratio } from "@/app/components/mail/format";
import { cn } from "@/lib/utils";
import PauseSwitch from "./PauseSwitch";

// Outreach analytics: what every mail did in a range (product, campaign and playbook mail alike,
// from the send ledger), deliverability against the alarm limits, the funnel over time and by
// source, conversions, offers with their holdout lift, feedback and the actions that start
// playbooks. Read through libs/mail-admin.ts; the (fulladmin) layout and the backend's isAdmin both
// require an ADMIN. The series (daily, dailyBySource, conversions, offers.daily, feedback.daily)
// are optional: each chart shows only when the backend sends its rows.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach", robots: { index: false, follow: false } };

const RANGES = [7, 30, 90] as const;
const ZERO_RATES: Rates = { delivered: 0, opened: 0, clicked: 0, clickToOpen: 0, replied: 0, unsubscribed: 0, bounced: 0, complained: 0, converted: 0 };
const OBJECT_ID = /[a-f\d]{24}/i;

const hrefFor = (by: TableBy) => (id: string) => {
  const oid = id.match(OBJECT_ID)?.[0];
  if (!oid) return null;
  if (by === "campaign") return `/heroshima/outreach/campaigns/${oid}`;
  if (by === "playbook_step") return `/heroshima/outreach/playbooks/${oid}`;
  if (by === "template") return `/heroshima/outreach/templates/${oid}`;
  return null;
};

const Page = async ({ searchParams }: { searchParams: Promise<{ days?: string; by?: string }> }) => {
  const params = await searchParams;
  const asked = Number.parseInt(params.days ?? "30", 10);
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30;
  const by: TableBy = (TABLE_BYS as readonly string[]).includes(params.by ?? "") ? (params.by as TableBy) : "campaign";
  const href = (next: { days?: number; by?: TableBy }) => `/heroshima/outreach?days=${next.days ?? days}&by=${next.by ?? by}`;

  const [overview, table, settingsRes] = await Promise.all([getMailOverview(days), getMailTable(by, days), getMailSettings()]);
  const settings = settingsRes.data ?? DEFAULT_SETTINGS;

  return (
    <MailShell
      title="Analytics"
      description="Every mail we send, product and marketing, from the send ledger."
      actions={
        <>
          <nav aria-label="Range" className="flex gap-1.5">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={href({ days: r })}
                aria-current={r === days ? "page" : undefined}
                className={`rounded-md border px-3 py-1.5 text-xs font-bold ${r === days ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
                {r} days
              </Link>
            ))}
          </nav>
          {settingsRes.data ? <PauseSwitch paused={settings.paused} /> : null}
        </>
      }>
      {settingsRes.data?.paused ? (
        <Notice tone="warn" className="mb-4">
          All marketing is paused. Campaigns and playbooks wait; product mail still goes out.
        </Notice>
      ) : null}

      {overview.error || !overview.data ? (
        <ErrorBox>The outreach analytics couldn&apos;t be loaded: {overview.error ?? "no answer from the backend."}</ErrorBox>
      ) : (
        <Body data={overview.data} days={days} alarms={{ ...DEFAULT_SETTINGS.alarms, ...(settings.alarms ?? {}) }} />
      )}

      <Panel
        title="By"
        className="mt-4"
        aside={
          <nav aria-label="Table" className="flex flex-wrap gap-1.5">
            {TABLE_BYS.map((b) => (
              <Link
                key={b}
                href={href({ by: b })}
                scroll={false}
                aria-current={b === by ? "page" : undefined}
                className={`rounded-md border px-2.5 py-1 text-xs font-bold ${b === by ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
                {TABLE_BY_LABELS[b]}
              </Link>
            ))}
          </nav>
        }>
        {table.error ? <ErrorBox>{table.error}</ErrorBox> : <FunnelTable rows={table.data ?? []} hrefFor={hrefFor(by)} />}
      </Panel>
    </MailShell>
  );
};

/** A conversion goal in words: built-in events by their label, "event:x" and "action:x" without the prefix. */
const goalLabel = (goal: string) => {
  const key = goal.replace(/^(event|action|goal)[:.]/, "");
  return (EVENT_LABELS as Record<string, string>)[key] ?? humanKey(key || goal);
};

const Body: FC<{ data: Overview; days: number; alarms: typeof DEFAULT_SETTINGS.alarms }> = ({ data, days, alarms }) => {
  const t = { ...EMPTY_TOTALS, ...data.totals };
  const r: Rates = { ...ZERO_RATES, ...(data.rates ?? {}) };
  const faces = (data.feedback?.great ?? 0) + (data.feedback?.good ?? 0) + (data.feedback?.meh ?? 0) + (data.feedback?.bad ?? 0);
  const happy = ratio((data.feedback?.great ?? 0) + (data.feedback?.good ?? 0), faces);
  const daily = data.daily ?? [];
  const bySourceDaily = data.dailyBySource;
  const conversions = data.conversions;
  const offersDaily = data.offers?.daily;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <StatTile label={`Sent, ${days} d`} value={t.sent} dark />
        <StatTile label="Delivered" value={pct(r.delivered)} hint={n(t.delivered)} />
        <StatTile label="Opened" value={pct(r.opened)} hint={`${n(t.opened)} · estimate`} />
        <StatTile label="Clicked" value={pct(r.clicked)} hint={n(t.clicked)} />
        <StatTile label="Click to open" value={pct(r.clickToOpen)} hint="estimate" />
        <StatTile label="Replied" value={pct(r.replied)} hint={n(t.replied)} />
        <StatTile label="Feedback" value={faces ? pct(happy, 0) : "None"} hint={faces ? `happy, ${n(faces)} answers` : "no answers yet"} />
        <StatTile label="Unsubscribed" value={pct(r.unsubscribed, 2)} hint={n(t.unsubscribed)} />
        <StatTile label="Bounced" value={pct(r.bounced, 2)} hint={n(t.bounced)} />
        <StatTile label="Complained" value={pct(r.complained, 2)} hint={n(t.complained)} />
        <StatTile label="Converted" value={pct(r.converted)} hint={`${n(t.converted)} credited · ${n(t.influenced)} influenced`} />
        <StatTile label="Revenue" value={money(t.revenueCents)} hint="credited to mail" />
      </div>

      <Deliverability alarms={data.alarms} limits={alarms} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="A day" className="lg:col-span-2">
          <FunnelTrend label="Mail delivered, opened, clicked and converted a day" points={daily.map((d) => ({ at: d.day, delivered: d.delivered, opened: d.opened, clicked: d.clicked, converted: d.converted }))} empty="No mail in this range yet." />
        </Panel>
        <Panel title="Funnel">
          <Funnel
            label={`Funnel, last ${days} days`}
            base={{ label: "sent", value: t.sent }}
            stages={[
              { key: "delivered", label: "Delivered", value: t.delivered, color: METRIC.delivered },
              { key: "opened", label: "Opened (estimate)", value: t.opened, color: METRIC.opened },
              { key: "clicked", label: "Clicked", value: t.clicked, color: METRIC.clicked },
              { key: "converted", label: "Converted", value: t.converted, color: METRIC.converted },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {bySourceDaily ? (
          <Panel title="Sent by source" className="lg:col-span-2">
            <Bars
              label="Mail sent a day by source"
              mode="stacked"
              totalLabel="sent"
              categories={bySourceDaily.map((d) => d.day)}
              series={SOURCES.map((s) => ({ key: s.key, label: s.label, color: SOURCE[s.key], values: bySourceDaily.map((d) => num(d[s.key])) }))}
            />
          </Panel>
        ) : null}
        <Panel title="By source" className={cn(!bySourceDaily && "lg:col-span-3")}>
          <SourceSplit bySource={data.bySource} />
        </Panel>
      </div>

      {conversions ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Conversions a day" className="lg:col-span-2">
            <TimeSeries
              label="Conversions credited to and influenced by mail a day"
              x={(conversions.daily ?? []).map((d) => d.day)}
              series={[
                { key: "credited", label: "Credited", color: CONVERSION.credited, values: (conversions.daily ?? []).map((d) => num(d.credited)) },
                { key: "influenced", label: "Influenced", color: CONVERSION.influenced, dashed: true, values: (conversions.daily ?? []).map((d) => num(d.influenced)) },
              ]}
              empty="No conversions in this range yet."
            />
          </Panel>
          <Panel title="Conversions by goal">
            <HBars
              label="Conversions by goal, credited and influenced"
              series={[
                { key: "credited", label: "Credited", color: CONVERSION.credited },
                { key: "influenced", label: "Influenced", color: CONVERSION.influenced },
              ]}
              rows={[...(conversions.byGoal ?? [])]
                .sort((a, b) => num(b.credited) + num(b.influenced) - (num(a.credited) + num(a.influenced)))
                .map((g) => ({ key: g.goal, label: goalLabel(g.goal), values: [num(g.credited), num(g.influenced)], sub: num(g.valueCents) ? `${money(g.valueCents)} credited` : undefined }))}
              empty="No conversions in this range yet."
            />
          </Panel>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {offersDaily ? (
          <Panel title="Offer codes a day" className="lg:col-span-2">
            <TimeSeries
              label="Offer codes given and redeemed a day"
              x={offersDaily.map((d) => d.day)}
              series={[
                { key: "granted", label: "Given", color: CONTEXT, values: offersDaily.map((d) => num(d.granted)) },
                { key: "redeemed", label: "Redeemed", color: METRIC.converted, values: offersDaily.map((d) => num(d.redeemed)) },
              ]}
              empty="No codes given in this range yet."
            />
          </Panel>
        ) : null}
        <Panel title="Offers" className={cn(!offersDaily && "lg:col-span-3")}>
          <OffersBlock offers={data.offers} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Feedback" className="lg:col-span-2">
          <FeedbackBlock feedback={data.feedback} weekly={days > 30} />
        </Panel>
        <Panel title="Actions this week" aside={<Link href="/heroshima/outreach/playbooks#actions" className="text-xs font-semibold hover:underline">Manage</Link>}>
          {data.actions?.length ? (
            <div className="flex flex-col gap-3">
              <HBars
                label="People who did each action this week, and how many of them entered a playbook"
                table={false}
                series={[
                  { key: "people", label: "People", color: CONTEXT },
                  { key: "entered", label: "Entered a playbook", color: METRIC.converted },
                ]}
                rows={data.actions.map((a) => ({ key: a.actionId, label: a.name, values: [num(a.people7d), num(a.entered7d)] }))}
              />
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Action</th>
                    <th className={`${TH} text-right`}>People</th>
                    <th className={`${TH} text-right`}>Entered a playbook</th>
                  </tr>
                </thead>
                <tbody>
                  {data.actions.map((a) => (
                    <tr key={a.actionId} className={ROW}>
                      <td className={TD}>{a.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{n(a.people7d)}</td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {n(a.entered7d)} <span className="text-xs text-gray-500">{pct(ratio(a.entered7d, a.people7d), 0)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No actions recorded this week.</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
};

const LEVEL_LABEL: Record<AlarmLevel, string> = { ok: "Deliverability OK", warn: "Warning", pause: "At pause level" };

/** Complaint and bounce rates as bullet bars against the warn and pause limits from Outreach settings. */
const Deliverability: FC<{ alarms: Overview["alarms"]; limits: typeof DEFAULT_SETTINGS.alarms }> = ({ alarms, limits }) => (
  <section aria-label="Deliverability" className="rounded-md border border-gray-300 bg-white px-4 py-3">
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <h2 className="text-sm font-bold">Deliverability</h2>
      <StatusChip status={alarms?.level ?? "ok"} label={LEVEL_LABEL[alarms?.level ?? "ok"]} />
      {typeof alarms?.suppressed7d === "number" ? (
        <p className="ml-auto text-sm">
          <span className="text-gray-500">Suppressed this week</span> <strong className="tabular-nums">{n(alarms.suppressed7d)}</strong>
        </p>
      ) : null}
    </div>
    <Bullet
      label="Complaint and bounce rates against the warn and pause limits"
      rows={[
        { key: "complaints", label: "Complaints", value: num(alarms?.complaintRate), warn: limits.complaintWarn, pause: limits.complaintPause },
        { key: "bounces", label: "Bounces", value: num(alarms?.bounceRate), warn: limits.bounceWarn, pause: limits.bouncePause },
      ]}
    />
  </section>
);

const SOURCES = [
  { key: "product", label: "Product mail" },
  { key: "campaign", label: "Campaigns" },
  { key: "playbook", label: "Playbooks" },
] as const;

const SourceSplit: FC<{ bySource: Overview["bySource"] | undefined }> = ({ bySource }) => {
  const rows = SOURCES.map((s) => ({ ...s, t: { ...EMPTY_TOTALS, ...(bySource?.[s.key] ?? {}) } as Totals }));
  const all = rows.reduce((sum, row) => sum + row.t.sent, 0);
  return (
    <ul className="flex flex-col">
      {rows.map(({ key, label, t }) => (
        <li key={key} className="border-t border-gray-200 py-3 first:border-t-0 first:pt-0">
          <div className="flex items-baseline justify-between">
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: SOURCE[key] }} />
              {label}
            </span>
            <span className="text-sm tabular-nums">
              {n(t.sent)} <span className="text-xs text-gray-500">{pct(ratio(t.sent, all), 0)} of all</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-gray-100">
            <div className="h-full rounded-full" style={{ width: `${ratio(t.sent, all) * 100}%`, background: SOURCE[key] }} />
          </div>
          <p className="mt-1.5 text-xs text-gray-600">
            Delivered {pct(ratio(t.delivered, t.sent), 0)} · opened {pct(ratio(t.opened, t.delivered), 0)} · clicked {pct(ratio(t.clicked, t.delivered), 0)} · converted{" "}
            {n(t.converted)}
          </p>
        </li>
      ))}
    </ul>
  );
};

const OffersBlock: FC<{ offers: Overview["offers"] | undefined }> = ({ offers }) => {
  if (!offers) return <Empty>No offers yet.</Empty>;
  const mailed = ratio(offers.mailed?.upgraded, offers.mailed?.people);
  const holdout = ratio(offers.holdout?.upgraded, offers.holdout?.people);
  const lift = (mailed - holdout) * 100;
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {[
          ["Codes given", n(offers.granted)],
          ["Clicked", n(offers.clicked)],
          ["Redeemed", `${n(offers.redeemed)} (${pct(ratio(offers.redeemed, offers.granted), 0)})`],
          ["Revenue", money(offers.revenueCents)],
          ["Discount cost", money(offers.discountCents)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between border-b border-gray-100 pb-1">
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-md border border-gray-300 p-3">
        <p className="mb-2 text-xs font-semibold text-gray-500">Upgrade rate, mailed against holdout</p>
        <HBars
          label="Upgrade rate of people mailed an offer against the holdout who got no mail"
          unit="percent"
          series={[{ key: "rate", label: "Upgrade rate", color: METRIC.converted }]}
          rows={[
            { key: "mailed", label: "Mailed", values: [mailed], sub: `${n(offers.mailed?.upgraded)} of ${n(offers.mailed?.people)} upgraded`, color: METRIC.converted },
            { key: "holdout", label: "Holdout (no mail)", values: [holdout], sub: `${n(offers.holdout?.upgraded)} of ${n(offers.holdout?.people)} upgraded`, color: CONTEXT },
          ]}
          empty="Nobody has upgraded from an offer yet."
        />
        <p className="mt-2 text-sm">
          Lift{" "}
          <strong className={lift > 0 ? "text-[#5b6b12]" : lift < 0 ? "text-[#b23c26]" : ""}>
            {lift > 0 ? "+" : ""}
            {lift.toFixed(1)} points
          </strong>
          {(offers.holdout?.people ?? 0) < 30 ? <span className="text-xs text-gray-500"> · too few people to trust yet</span> : null}
        </p>
      </div>
    </div>
  );
};

export default Page;
