import Link from "next/link";
import { listAudiences } from "@/libs/mail-admin";
import MailShell from "@/app/components/mail/MailShell";
import { BTN_PRIMARY, Empty, ErrorBox, ROW, TABLE, TD, TH } from "@/app/components/mail/ui";
import { day, filterSummary } from "@/app/components/mail/format";

// Saved audiences: filters over our own data and mail behaviour, used by campaigns and playbook triggers.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach audiences", robots: { index: false, follow: false } };

const Page = async () => {
  const res = await listAudiences();
  return (
    <MailShell
      title="Audience"
      description="Saved filters. Counts are live when you open one."
      actions={
        <Link href="/heroshima/outreach/audience/new" className={BTN_PRIMARY}>
          New audience
        </Link>
      }>
      {res.error ? (
        <ErrorBox>The audiences couldn&apos;t be loaded: {res.error}</ErrorBox>
      ) : !res.data?.length ? (
        <Empty>No audiences yet.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Filter</th>
                <th className={TH}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {res.data.map((a) => (
                <tr key={a.id} className={`${ROW} hover:bg-gray-50`}>
                  <td className={TD}>
                    <Link href={`/heroshima/outreach/audience/${a.id}`} className="font-semibold hover:underline">
                      {a.name || "Untitled"}
                    </Link>
                  </td>
                  <td className={`${TD} text-gray-600`}>{filterSummary(a.filter)}</td>
                  <td className={`${TD} whitespace-nowrap text-gray-600`}>{day(a.updatedAt ?? a.createdAt)}</td>
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
