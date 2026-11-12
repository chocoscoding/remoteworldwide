import type { FC } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaign, getCampaignReport, getMailSettings, listAudiences, listOffers, listTemplates } from "@/libs/mail-admin";
import { CAMPAIGN_STATUS_LABELS, DEFAULT_SETTINGS, UNSUBSCRIBE_REASON_LABELS, type CampaignReport, type MailCampaign } from "@/app/lib/mail/types";
import { BarList, Panel, StatTile } from "@/app/components/ADMIN/analytics/Charts";
import MailShell from "@/app/components/mail/MailShell";
import MailPreview from "@/app/components/mail/MailPreview";
import { Bars, Funnel, FunnelTrend, HBars, METRIC, num } from "@/app/components/mail/charts";
import { FeedbackBlock } from "@/app/components/mail/reports";
import { shortLink } from "@/app/lib/mail/userMail";
import { Chip, Empty, ErrorBox, Notice, ROW, StatusChip, TABLE, TD, TH } from "@/app/components/mail/ui";
import { EMPTY_TOTALS, dateTime, money, n, pct, ratio } from "@/app/components/mail/format";
import CampaignActions from "./CampaignActions";
import CampaignEditor from "./CampaignEditor";

// One campaign. A draft opens its editor (/campaigns/new starts one). Once scheduled or sent it is
// a report: counts, funnel, the timeline (hourly at first, then daily), A/B rates per subject, link
// clicks, replies, feedback, unsubscribe reasons and the people, with pause, resume, cancel, pick a
// winner and duplicate.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach campaign", robots: { index: false, follow: false } };

const BACK = { href: "/heroshima/outreach/campaigns", label: "Campaigns" };

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (id === "new") return <Editor campaign={null} />;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();

  const res = await getCampaign(id);
  if (res.error || !res.data) {
    return (
      <MailShell title="Campaign" back={BACK}>
        <ErrorBox>This campaign couldn&apos;t be loaded: {res.error ?? "no answer from the backend."}</ErrorBox>
      </MailShell>
    );
  }
  if (res.data.status === "draft") return <Editor campaign={res.data} />;
  return <Report campaign={res.data} />;
};

const Editor = async ({ campaign }: { campaign: MailCampaign | null }) => {
  const [templates, audiences, offers, settings] = await Promise.all([listTemplates(), listAudiences(), listOffers(), getMailSettings()]);
  const failures = [templates.error && `templates (${templates.error})`, audiences.error && `audiences (${audiences.error})`, offers.error && `offers (${offers.error})`].filter(Boolean);
  return (
    <MailShell title={campaign ? campaign.name || "Draft campaign" : "New campaign"} description={campaign ? "Draft" : undefined} back={BACK}>
      {failures.length ? <ErrorBox className="mb-4">Some lists couldn&apos;t be loaded: {failures.join(", ")}.</ErrorBox> : null}
      <CampaignEditor
        campaign={campaign}
        templates={templates.data ?? []}
        audiences={audiences.data ?? []}
        offers={offers.data ?? []}
        maxDiscountPercent={settings.data?.maxDiscountPercent ?? DEFAULT_SETTINGS.maxDiscountPercent}
      />
    </MailShell>
  );
};

const Report = async ({ campaign: c }: { campaign: MailCampaign }) => {
  const report = await getCampaignReport(c.id);
  const k = c.counts ?? { recipients: 0, sent: 0, deferred: 0, skippedCap: 0, skippedPref: 0, skippedSuppressed: 0, failed: 0 };
  const subjectA = c.content?.subject ?? "";
  const timeline = [
    c.sendAt ? `Send at ${dateTime(c.sendAt)}` : null,
    c.startedAt ? `started ${dateTime(c.startedAt)}` : null,
    c.finishedAt ? `finished ${dateTime(c.finishedAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <MailShell
      title={c.name || "Campaign"}
      description={timeline || undefined}
      back={BACK}
      actions={
        <>
          <StatusChip status={c.status} label={CAMPAIGN_STATUS_LABELS[c.status] ?? c.status} />
          <CampaignActions id={c.id} status={c.status} ab={c.abTest ? { subjectA, subjectB: c.abTest.subjectB, winner: c.abTest.winner } : null} />
        </>
      }>
      <div className="flex flex-col gap-4">
        {c.pausedReason ? (
          <Notice tone="warn">
            Paused: <strong>{c.pausedReason}</strong>
          </Notice>
        ) : null}

        <p className="text-sm text-gray-600">
          Key <span className="font-mono">{c.key}</span>
          {c.audienceId ? (
            <>
              {" · "}
              <Link href={`/heroshima/outreach/audience/${c.audienceId}`} className="font-semibold hover:underline">
                Audience
              </Link>
            </>
          ) : null}
          {c.templateId ? (
            <>
              {" · "}
              <Link href={`/heroshima/outreach/templates/${c.templateId}`} className="font-semibold hover:underline">
                Template
              </Link>
            </>
          ) : null}
          {c.offer ? (
            <>
              {" · "}
              <Link href={`/heroshima/outreach/offers/${c.offer.offerId}`} className="font-semibold hover:underline">
                Offer
              </Link>
              {c.offer.percentOverride ? ` ${c.offer.percentOverride}%` : ""}
              {c.offer.validHoursOverride ? `, ${c.offer.validHoursOverride} h` : ""}
            </>
          ) : null}
        </p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <StatTile label="People" value={k.recipients} dark />
          <StatTile label="Sent" value={k.sent} hint={pct(ratio(k.sent, k.recipients), 0)} />
          <StatTile label="Waiting" value={k.deferred} hint="quiet hours" />
          <StatTile label="Over the cap" value={k.skippedCap} />
          <StatTile label="Pref off" value={k.skippedPref} />
          <StatTile label="Suppressed" value={k.skippedSuppressed} />
          <StatTile label="Failed" value={k.failed} />
        </div>

        {report.error || !report.data ? (
          <ErrorBox>The report couldn&apos;t be loaded: {report.error ?? "no answer from the backend."}</ErrorBox>
        ) : (
          <ReportBody report={report.data} campaign={c} />
        )}

        {c.content ? (
          <details className="rounded-md border border-gray-300 bg-white p-4">
            <summary className="cursor-pointer text-sm font-bold">What was sent</summary>
            <div className="mt-3">
              <MailPreview content={c.content} />
            </div>
          </details>
        ) : null}
      </div>
    </MailShell>
  );
};

const ReportBody: FC<{ report: CampaignReport; campaign: MailCampaign }> = ({ report, campaign }) => {
  const f = { ...EMPTY_TOTALS, ...report.funnel };
  const variants = report.variants;
  const timeline = report.timeline?.rows?.length ? { unit: report.timeline.unit === "hour" ? ("hour" as const) : ("day" as const), rows: report.timeline.rows } : null;
  const side = (key: "a" | "b") => ({ ...EMPTY_TOTALS, ...(variants?.[key] ?? {}) });
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Funnel" className="lg:col-span-2">
          <Funnel
            label="Campaign funnel"
            base={{ label: "sent", value: f.sent }}
            stages={[
              { key: "delivered", label: "Delivered", value: f.delivered, color: METRIC.delivered },
              { key: "opened", label: "Opened (estimate)", value: f.opened, color: METRIC.opened },
              { key: "clicked", label: "Clicked", value: f.clicked, color: METRIC.clicked },
              { key: "converted", label: "Converted", value: f.converted, color: METRIC.converted },
            ]}
            empty="Nothing delivered yet."
          />
        </Panel>
        <Panel title="Also">
          <dl className="flex flex-col text-sm">
            {[
              ["Replied", f.replied, f.delivered],
              ["Unsubscribed", f.unsubscribed, f.delivered],
              ["Bounced", f.bounced, f.sent],
              ["Complained", f.complained, f.delivered],
            ].map(([label, value, of]) => (
              <div key={label as string} className="flex items-baseline justify-between border-b border-gray-100 py-1.5">
                <dt className="text-gray-500">{label}</dt>
                <dd className="tabular-nums">
                  {n(value as number)} <span className="text-xs text-gray-500">{pct(ratio(value as number, of as number), 2)}</span>
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between py-1.5">
              <dt className="text-gray-500">Revenue</dt>
              <dd className="font-semibold tabular-nums">{money(f.revenueCents)}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      {timeline ? (
        <Panel title={timeline.unit === "hour" ? "An hour (UTC)" : "A day"}>
          <FunnelTrend label={`Campaign mail delivered, opened, clicked and converted ${timeline.unit === "hour" ? "an hour" : "a day"}`} points={timeline.rows} xKind={timeline.unit} empty="Nothing delivered yet." />
        </Panel>
      ) : null}

      {variants && campaign.abTest ? (
        <Panel title="Subject test">
          <div className="mb-4">
            <Bars
              label="Open, click and convert rate per subject"
              mode="grouped"
              unit="percent"
              xKind="label"
              height={200}
              categories={(["a", "b"] as const).map((k) => `Subject ${k.toUpperCase()}${campaign.abTest?.winner === k ? " (winner)" : ""}`)}
              series={[
                { key: "opened", label: "Open rate (estimate)", color: METRIC.opened, values: [ratio(side("a").opened, side("a").delivered), ratio(side("b").opened, side("b").delivered)] },
                { key: "clicked", label: "Click rate", color: METRIC.clicked, values: [ratio(side("a").clicked, side("a").delivered), ratio(side("b").clicked, side("b").delivered)] },
                { key: "converted", label: "Convert rate", color: METRIC.converted, values: [ratio(side("a").converted, side("a").delivered), ratio(side("b").converted, side("b").delivered)] },
              ]}
              empty="No opens or clicks on either subject yet."
            />
          </div>
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Side</th>
                <th className={TH}>Subject</th>
                <th className={`${TH} text-right`}>Sent</th>
                <th className={`${TH} text-right`}>Opened*</th>
                <th className={`${TH} text-right`}>Clicked</th>
                <th className={`${TH} text-right`}>Click rate</th>
              </tr>
            </thead>
            <tbody>
              {(["a", "b"] as const).map((side) => {
                const v = { ...EMPTY_TOTALS, ...variants[side] };
                return (
                  <tr key={side} className={ROW}>
                    <td className={TD}>
                      {side.toUpperCase()} {campaign.abTest?.winner === side ? <Chip tone="lime">winner</Chip> : null}
                    </td>
                    <td className={`${TD} max-w-[360px] truncate`}>{side === "a" ? campaign.content?.subject : campaign.abTest?.subjectB}</td>
                    <td className={`${TD} text-right tabular-nums`}>{n(v.sent)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{pct(ratio(v.opened, v.delivered), 0)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{n(v.clicked)}</td>
                    <td className={`${TD} text-right font-semibold tabular-nums`}>{pct(ratio(v.clicked, v.delivered))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">
            {campaign.abTest.winner
              ? `Decided ${dateTime(campaign.abTest.decidedAt)}.`
              : campaign.abTest.mode === "auto"
                ? `The side with more unique clicks wins after ${campaign.abTest.decideAfterHours} hours.`
                : "You pick the winner."}{" "}
            * Opens are an estimate.
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Links clicked">
          <HBars
            label="Clicks per link"
            series={[{ key: "clicks", label: "Clicks", color: METRIC.clicked }]}
            rows={[...(report.links ?? [])]
              .sort((a, b) => num(b.clicks) - num(a.clicks))
              .map((l) => ({ key: l.url, label: shortLink(l.url), values: [num(l.clicks)], sub: `${n(l.people)} ${num(l.people) === 1 ? "person" : "people"}` }))}
            empty="No clicks yet."
          />
        </Panel>
        <Panel title="Replies">
          {report.replies?.length ? (
            <ul className="flex flex-col">
              {report.replies.map((r) => (
                <li key={r.threadId} className="border-t border-gray-200 py-2 first:border-t-0">
                  <Link href={`/heroshima/outreach/inbox/${r.threadId}`} className="block hover:underline">
                    <span className="text-sm font-semibold">{r.email}</span> <span className="text-xs text-gray-500">{dateTime(r.at)}</span>
                    <span className="block truncate text-sm text-gray-600">{r.snippet}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No replies yet.</Empty>
          )}
        </Panel>
        <Panel title="Feedback">
          <FeedbackBlock feedback={report.feedback} />
        </Panel>
        <Panel title="Why people unsubscribed">
          <BarList rows={(report.reasons ?? []).map((r) => ({ label: UNSUBSCRIBE_REASON_LABELS[r.reason] ?? r.reason, value: r.count }))} empty="No reasons given." />
        </Panel>
      </div>

      <Panel title="People" aside={<span className="text-xs text-gray-500">{n(report.people?.total)} in all</span>}>
        {report.people?.rows?.length ? (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Person</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Opened*</th>
                  <th className={TH}>Clicked</th>
                  <th className={TH}>Converted</th>
                </tr>
              </thead>
              <tbody>
                {report.people.rows.map((p, i) => (
                  <tr key={`${p.email}-${i}`} className={ROW}>
                    <td className={TD}>
                      {p.userId ? (
                        <Link href={`/heroshima/users/${p.userId}`} className="hover:underline">
                          {p.email}
                        </Link>
                      ) : (
                        p.email
                      )}
                    </td>
                    <td className={TD}>
                      <StatusChip status={p.status} />
                    </td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>{dateTime(p.openedAt, "No")}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>{dateTime(p.clickedAt, "No")}</td>
                    <td className={TD}>{p.convertedGoal ? <Chip tone="lime">{p.convertedGoal.replace(/_/g, " ")}</Chip> : <span className="text-gray-500">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.people.total > report.people.rows.length ? (
              <p className="mt-2 text-xs text-gray-500">
                Showing {n(report.people.rows.length)} of {n(report.people.total)}.
              </p>
            ) : null}
          </div>
        ) : (
          <Empty>Nobody yet.</Empty>
        )}
      </Panel>
    </>
  );
};

export default Page;
