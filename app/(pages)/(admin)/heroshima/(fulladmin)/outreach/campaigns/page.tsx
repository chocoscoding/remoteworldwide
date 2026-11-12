import Link from "next/link";
import { listCampaigns } from "@/libs/mail-admin";
import { CAMPAIGN_STATUS_LABELS, type MailCampaign } from "@/app/lib/mail/types";
import MailShell from "@/app/components/mail/MailShell";
import { BTN_PRIMARY, Empty, ErrorBox, ROW, StatusChip, TABLE, TD, TH } from "@/app/components/mail/ui";
import { dateTime, n } from "@/app/components/mail/format";

// One-off mails to an audience: the list. A draft opens its editor; anything scheduled or sent
// opens its report.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach campaigns", robots: { index: false, follow: false } };

const when = (c: MailCampaign) => {
  if (c.status === "draft") return "Not scheduled";
  if (c.status === "scheduled") return `Sends ${dateTime(c.sendAt, "soon")}`;
  if (c.finishedAt) return `Finished ${dateTime(c.finishedAt)}`;
  if (c.startedAt) return `Started ${dateTime(c.startedAt)}`;
  return dateTime(c.sendAt ?? c.updatedAt ?? c.createdAt);
};

const Page = async () => {
  const res = await listCampaigns();
  return (
    <MailShell
      title="Campaigns"
      description="Write a mail, pick an audience, test, then schedule or send now."
      actions={
        <Link href="/heroshima/outreach/campaigns/new" className={BTN_PRIMARY}>
          New campaign
        </Link>
      }>
      {res.error ? (
        <ErrorBox>The campaigns couldn&apos;t be loaded: {res.error}</ErrorBox>
      ) : !res.data?.length ? (
        <Empty>No campaigns yet.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Status</th>
                <th className={TH}>When</th>
                <th className={`${TH} text-right`}>People</th>
                <th className={`${TH} text-right`}>Sent</th>
                <th className={`${TH} text-right`}>Waiting</th>
                <th className={`${TH} text-right`}>Skipped</th>
                <th className={`${TH} text-right`}>Failed</th>
              </tr>
            </thead>
            <tbody>
              {res.data.map((c) => {
                const k = c.counts ?? { recipients: 0, sent: 0, deferred: 0, skippedCap: 0, skippedPref: 0, skippedSuppressed: 0, failed: 0 };
                const skipped = (k.skippedCap ?? 0) + (k.skippedPref ?? 0) + (k.skippedSuppressed ?? 0);
                return (
                  <tr key={c.id} className={`${ROW} hover:bg-gray-50`}>
                    <td className={TD}>
                      <Link href={`/heroshima/outreach/campaigns/${c.id}`} className="font-semibold hover:underline">
                        {c.name || "Untitled"}
                      </Link>
                      {c.abTest ? <span className="ml-1.5 text-xs text-gray-500">A/B</span> : null}
                    </td>
                    <td className={TD}>
                      <StatusChip status={c.status} label={CAMPAIGN_STATUS_LABELS[c.status] ?? c.status} />
                    </td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>{when(c)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{n(k.recipients)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{n(k.sent)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{n(k.deferred)}</td>
                    <td className={`${TD} text-right tabular-nums`} title={`cap ${k.skippedCap ?? 0} · pref ${k.skippedPref ?? 0} · suppressed ${k.skippedSuppressed ?? 0}`}>
                      {n(skipped)}
                    </td>
                    <td className={`${TD} text-right tabular-nums ${k.failed ? "text-[#b23c26]" : ""}`}>{n(k.failed)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </MailShell>
  );
};

export default Page;
