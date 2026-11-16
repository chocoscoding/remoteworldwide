import type { FC } from "react";
import Link from "next/link";
import { FACES, type Overview, type Totals } from "@/app/lib/mail/types";
import HBars from "../charts/HBars";
import { CONTEXT, METRIC, SOURCE } from "../charts/palette";
import { FeedbackBlock } from "../reports";
import { Empty } from "../ui";
import { EMPTY_TOTALS, money, n, pct, ratio } from "../format";
import type { FoldItem } from "./Accordion";

// The overview's folded sections, one open at a time: offers (codes, redeemed, the lift against the
// holdout), feedback (the faces), sources (product, campaign and playbook mail) and the triggers of
// the last 7 days. Each has the one line it shows while closed. No hooks: the server page builds
// the items and hands them to the client Accordion.

const plural = (count: number, one: string, many: string) => `${n(count)} ${count === 1 ? one : many}`;

/* ----------------------------------------------------------------------------- offers */

const liftOf = (offers: Overview["offers"]) => (ratio(offers.mailed?.upgraded, offers.mailed?.people) - ratio(offers.holdout?.upgraded, offers.holdout?.people)) * 100;
const signed = (points: number) => `${points > 0 ? "+" : points < 0 ? "-" : ""}${Math.abs(points).toFixed(1)} pts`;

const OffersBlock: FC<{ offers: Overview["offers"] }> = ({ offers }) => {
  const mailed = ratio(offers.mailed?.upgraded, offers.mailed?.people);
  const holdout = ratio(offers.holdout?.upgraded, offers.holdout?.people);
  const lift = liftOf(offers);
  const figures: Array<[string, string]> = [
    ["Codes given", n(offers.granted)],
    ["Redeemed", `${n(offers.redeemed)} (${pct(ratio(offers.redeemed, offers.granted), 0)})`],
    ["Revenue", money(offers.revenueCents)],
    ["Discount given", money(offers.discountCents)],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <dl className="flex flex-col">
        {figures.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 border-t border-gray-100 py-2 text-sm first:border-t-0 first:pt-0">
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="mb-1 text-xs font-semibold text-gray-500">Upgrade rate, mailed against the holdout</p>
        <HBars
          label="Upgrade rate of people mailed an offer against the holdout who got no mail"
          unit="percent"
          series={[{ key: "rate", label: "Upgrade rate", color: METRIC.converted }]}
          rows={[
            { key: "mailed", label: "Mailed", values: [mailed], sub: `${n(offers.mailed?.upgraded)} of ${n(offers.mailed?.people)} upgraded`, color: METRIC.converted },
            { key: "holdout", label: "Holdout, no mail", values: [holdout], sub: `${n(offers.holdout?.upgraded)} of ${n(offers.holdout?.people)} upgraded`, color: CONTEXT },
          ]}
          empty="Nobody has upgraded from an offer yet."
        />
        <p className="mt-2 text-sm">
          Lift <strong className={lift > 0 ? "text-[#5b6b12]" : lift < 0 ? "text-[#b23c26]" : ""}>{signed(lift)}</strong>
          {(offers.holdout?.people ?? 0) < 30 ? <span className="text-xs text-gray-500"> · too few people to trust yet</span> : null}
        </p>
      </div>
    </div>
  );
};

export const offersFold = (offers: Overview["offers"] | undefined): FoldItem => ({
  key: "offers",
  title: "Offers",
  summary: !offers?.granted
    ? "No codes given in this range"
    : `${plural(offers.granted, "code", "codes")} · ${n(offers.redeemed)} redeemed${(offers.holdout?.people ?? 0) > 0 ? ` · lift ${signed(liftOf(offers))}` : ""}`,
  content: offers ? <OffersBlock offers={offers} /> : <Empty>No offers yet.</Empty>,
});

/* ----------------------------------------------------------------------------- feedback */

export const feedbackFold = (feedback: Overview["feedback"] | undefined, days: number): FoldItem => {
  const total = FACES.reduce((sum, f) => sum + (Number(feedback?.[f]) || 0), 0);
  const happy = ratio((Number(feedback?.great) || 0) + (Number(feedback?.good) || 0), total);
  return {
    key: "feedback",
    title: "Feedback",
    summary: total ? `${pct(happy, 0)} happy · ${plural(total, "answer", "answers")}` : "No answers yet",
    content: <FeedbackBlock feedback={feedback} weekly={days > 30} />,
  };
};

/* ----------------------------------------------------------------------------- sources */

const SOURCES = [
  { key: "product", label: "Product mail", short: "product" },
  { key: "campaign", label: "Campaigns", short: "campaigns" },
  { key: "playbook", label: "Playbooks", short: "playbooks" },
] as const;

const sourceRows = (bySource: Overview["bySource"] | undefined) => SOURCES.map((s) => ({ ...s, t: { ...EMPTY_TOTALS, ...(bySource?.[s.key] ?? {}) } as Totals }));

const SourceSplit: FC<{ bySource: Overview["bySource"] | undefined }> = ({ bySource }) => {
  const rows = sourceRows(bySource);
  const all = rows.reduce((sum, row) => sum + row.t.sent, 0);
  if (!all) return <Empty>Nothing sent in this range.</Empty>;
  return (
    <ul className="flex flex-col">
      {rows.map(({ key, label, t }) => (
        <li key={key} className="border-t border-gray-100 py-3 first:border-t-0 first:pt-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: SOURCE[key] }} />
              {label}
            </span>
            <span className="text-sm tabular-nums">
              {n(t.sent)} <span className="text-xs text-gray-500">{pct(ratio(t.sent, all), 0)} of all</span>
            </span>
          </div>
          <div className="mt-1.5 h-1" aria-hidden>
            <div className="h-full rounded-r-full" style={{ width: `${ratio(t.sent, all) * 100}%`, minWidth: t.sent > 0 ? 2 : 0, background: SOURCE[key] }} />
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Delivered {pct(ratio(t.delivered, t.sent), 0)} · clicked {pct(ratio(t.clicked, t.delivered), 0)} · {plural(t.converted, "upgrade", "upgrades")}
          </p>
        </li>
      ))}
    </ul>
  );
};

export const sourcesFold = (bySource: Overview["bySource"] | undefined): FoldItem => {
  const rows = sourceRows(bySource);
  const all = rows.reduce((sum, row) => sum + row.t.sent, 0);
  const split = rows.map((r, i) => `${i === 0 ? "Product" : r.short} ${pct(ratio(r.t.sent, all), 0)}`).join(" · ");
  return { key: "sources", title: "Sources", summary: all ? split : "Nothing sent in this range", content: <SourceSplit bySource={bySource} /> };
};

/* ----------------------------------------------------------------------------- triggers */

export const triggersFold = (actions: Overview["actions"] | undefined): FoldItem => {
  const list = actions ?? [];
  const entered = list.reduce((sum, a) => sum + (Number(a.entered7d) || 0), 0);
  return {
    key: "triggers",
    title: "Triggers this week",
    summary: list.length ? `${plural(list.length, "trigger", "triggers")} · ${n(entered)} entered a playbook` : "No triggers in the last 7 days",
    content: (
      <div>
        {list.length ? (
          <HBars
            label="People who set off each trigger in the last 7 days, and how many of them entered a playbook"
            series={[
              { key: "people", label: "People", color: CONTEXT },
              { key: "entered", label: "Entered a playbook", color: METRIC.converted },
            ]}
            rows={[...list]
              .sort((a, b) => (Number(b.people7d) || 0) - (Number(a.people7d) || 0))
              .map((a) => ({ key: a.actionId, label: a.name, values: [Number(a.people7d) || 0, Number(a.entered7d) || 0], sub: `${pct(ratio(a.entered7d, a.people7d), 0)} entered` }))}
          />
        ) : (
          <Empty>No triggers in the last 7 days.</Empty>
        )}
        <Link href="/heroshima/outreach/playbooks" className="mt-3 inline-block text-xs font-semibold text-gray-600 hover:text-black hover:underline">
          Manage triggers in Playbooks
        </Link>
      </div>
    ),
  };
};
