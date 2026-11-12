import Link from "next/link";
import { notFound } from "next/navigation";
import { getMailSettings, getOffer } from "@/libs/mail-admin";
import { DEFAULT_SETTINGS } from "@/app/lib/mail/types";
import { Panel, StatTile } from "@/app/components/ADMIN/analytics/Charts";
import MailShell from "@/app/components/mail/MailShell";
import { CONTEXT, METRIC, TimeSeries, num } from "@/app/components/mail/charts";
import { Chip, Empty, ErrorBox, ROW, TABLE, TD, TH } from "@/app/components/mail/ui";
import { dateTime, durationText, money, n, offerLabel, pct, ratio } from "@/app/components/mail/format";
import OfferEditor from "./OfferEditor";

// One offer: its terms (a change to the discount or duration makes a new version and a new Stripe
// coupon at the next grant), codes given and redeemed a day, its version history, and the codes.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach offer", robots: { index: false, follow: false } };

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const back = { href: "/heroshima/outreach/offers", label: "Offers" };
  const isNew = id === "new";
  if (!isNew && !/^[a-f\d]{24}$/i.test(id)) notFound();

  const [offerRes, settingsRes] = await Promise.all([isNew ? null : getOffer(id), getMailSettings()]);
  const maxDiscountPercent = settingsRes.data?.maxDiscountPercent ?? DEFAULT_SETTINGS.maxDiscountPercent;

  if (isNew) {
    return (
      <MailShell title="New offer" back={back}>
        <OfferEditor offer={null} maxDiscountPercent={maxDiscountPercent} />
      </MailShell>
    );
  }
  if (!offerRes || offerRes.error || !offerRes.data) {
    return (
      <MailShell title="Offer" back={back}>
        <ErrorBox>This offer couldn&apos;t be loaded: {offerRes?.error ?? "no answer from the backend."}</ErrorBox>
      </MailShell>
    );
  }

  const offer = offerRes.data;
  const stats = offer.stats;
  const history = [...(offer.history ?? [])].sort((a, b) => b.version - a.version);

  return (
    <MailShell title={offer.name} description={`${offerLabel(offer)} · ${durationText(offer)} · version ${offer.version}${offer.archived ? " · archived" : ""}`} back={back}>
      <div className="flex flex-col gap-4">
        {stats ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatTile label="Codes given" value={stats.granted} dark hint={stats.thisMonth !== undefined ? `${n(stats.thisMonth)} this month` : undefined} />
            <StatTile label="Clicked" value={stats.clicked ?? 0} />
            <StatTile label="Redeemed" value={stats.redeemed} hint={pct(ratio(stats.redeemed, stats.granted), 0)} />
            <StatTile label="Revenue" value={money(stats.revenueCents)} />
            <StatTile label="Discount cost" value={money(stats.discountCents)} />
          </div>
        ) : null}

        {offer.daily ? (
          <Panel title="Codes a day">
            <TimeSeries
              label="Codes of this offer given and redeemed a day"
              height={200}
              x={offer.daily.map((d) => d.day)}
              series={[
                { key: "granted", label: "Given", color: CONTEXT, values: offer.daily.map((d) => num(d.granted)) },
                { key: "redeemed", label: "Redeemed", color: METRIC.converted, values: offer.daily.map((d) => num(d.redeemed)) },
              ]}
              empty="No codes given in this range yet."
            />
          </Panel>
        ) : null}

        <OfferEditor offer={offer} maxDiscountPercent={maxDiscountPercent} />

        <Panel title="Versions">
          {history.length ? (
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Version</th>
                  <th className={TH}>Discount</th>
                  <th className={TH}>On the bill for</th>
                  <th className={TH}>Stripe coupon</th>
                  <th className={TH}>Since</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.version} className={ROW}>
                    <td className={TD}>
                      v{h.version} {h.version === offer.version ? <Chip tone="lime">current</Chip> : null}
                    </td>
                    <td className={`${TD} tabular-nums`}>{offerLabel({ kind: h.percentOff !== null && h.percentOff !== undefined ? "percent" : "amount", percentOff: h.percentOff, amountOffCents: h.amountOffCents })}</td>
                    <td className={TD}>{durationText(h)}</td>
                    <td className={`${TD} font-mono text-xs text-gray-600`}>{h.stripeCouponId ?? "Made at first grant"}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>{dateTime(h.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>Version 1, unchanged.</Empty>
          )}
        </Panel>

        <Panel title="Codes given">
          {offer.grants?.length ? (
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Person</th>
                    <th className={TH}>Code</th>
                    <th className={TH}>Discount</th>
                    <th className={TH}>Given</th>
                    <th className={TH}>Expires</th>
                    <th className={TH}>Clicked</th>
                    <th className={TH}>Redeemed</th>
                    <th className={`${TH} text-right`}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {offer.grants.map((g) => (
                    <tr key={g.id} className={ROW}>
                      <td className={TD}>
                        <Link href={`/heroshima/users/${g.userId}`} className="hover:underline">
                          {g.email || g.userId}
                        </Link>
                        {g.holdout ? (
                          <>
                            {" "}
                            <Chip tone="outline">holdout</Chip>
                          </>
                        ) : null}
                      </td>
                      <td className={`${TD} font-mono text-xs`}>{g.code || "None"}</td>
                      <td className={TD}>{g.discountLabel}</td>
                      <td className={`${TD} whitespace-nowrap text-gray-600`}>{dateTime(g.createdAt)}</td>
                      <td className={`${TD} whitespace-nowrap text-gray-600`}>{dateTime(g.expiresAt)}</td>
                      <td className={`${TD} whitespace-nowrap text-gray-600`}>{dateTime(g.clickedAt, "No")}</td>
                      <td className={`${TD} whitespace-nowrap`}>{g.redeemedAt ? <Chip tone="lime">{dateTime(g.redeemedAt)}</Chip> : <span className="text-gray-500">No</span>}</td>
                      <td className={`${TD} text-right tabular-nums`}>{g.revenueCents ? money(g.revenueCents) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No codes given yet.</Empty>
          )}
        </Panel>
      </div>
    </MailShell>
  );
};

export default Page;
