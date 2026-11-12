import Link from "next/link";
import { listOffers } from "@/libs/mail-admin";
import MailShell from "@/app/components/mail/MailShell";
import { BTN_PRIMARY, Chip, Empty, ErrorBox, ROW, TABLE, TD, TH } from "@/app/components/mail/ui";
import { durationText, hours, money, n, offerLabel } from "@/app/components/mail/format";

// Personal discounts the founder makes: each is one Stripe coupon per version, granted per person
// as a single-use promotion code by a campaign or a playbook send step.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach offers", robots: { index: false, follow: false } };

const Page = async ({ searchParams }: { searchParams: Promise<{ archived?: string }> }) => {
  const archived = (await searchParams).archived === "1";
  const res = await listOffers();
  const rows = (res.data ?? []).filter((o) => Boolean(o.archived) === archived);

  return (
    <MailShell
      title="Offers"
      description="Discounts for campaigns and playbook steps. Editing the terms makes a new version; codes already sent keep theirs."
      actions={
        <>
          <Link href={archived ? "/heroshima/outreach/offers" : "/heroshima/outreach/offers?archived=1"} className="text-xs font-semibold text-gray-600 hover:underline">
            {archived ? "Show current" : "Show archived"}
          </Link>
          <Link href="/heroshima/outreach/offers/new" className={BTN_PRIMARY}>
            New offer
          </Link>
        </>
      }>
      {res.error ? (
        <ErrorBox>The offers couldn&apos;t be loaded: {res.error}</ErrorBox>
      ) : !rows.length ? (
        <Empty>{archived ? "No archived offers." : "No offers yet."}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Discount</th>
                <th className={TH}>On the bill for</th>
                <th className={TH}>Code valid</th>
                <th className={TH}>Plans</th>
                <th className={`${TH} text-right`}>Cap / month</th>
                <th className={`${TH} text-right`}>Given</th>
                <th className={`${TH} text-right`}>Redeemed</th>
                <th className={`${TH} text-right`}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className={`${ROW} hover:bg-gray-50`}>
                  <td className={TD}>
                    <Link href={`/heroshima/outreach/offers/${o.id}`} className="font-semibold hover:underline">
                      {o.name}
                    </Link>{" "}
                    <Chip tone="outline">v{o.version}</Chip>
                  </td>
                  <td className={`${TD} font-semibold tabular-nums`}>{offerLabel(o)}</td>
                  <td className={`${TD} text-gray-600`}>{durationText(o)}</td>
                  <td className={`${TD} whitespace-nowrap text-gray-600`}>{hours(o.validHours)}</td>
                  <td className={`${TD} text-gray-600`}>
                    {o.plans?.length ? o.plans.join(", ") : "All plans"}
                    {o.intervals?.length ? ` · ${o.intervals.join(", ")}` : ""}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{o.monthlyCap ?? "None"}</td>
                  <td className={`${TD} text-right tabular-nums`}>{o.stats ? n(o.stats.granted) : ""}</td>
                  <td className={`${TD} text-right tabular-nums`}>{o.stats ? n(o.stats.redeemed) : ""}</td>
                  <td className={`${TD} text-right tabular-nums`}>{o.stats ? money(o.stats.revenueCents) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MailShell>
  );
};

export default Page;
