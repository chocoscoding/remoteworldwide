import Link from "next/link";
import { listTemplates } from "@/libs/mail-admin";
import { PREF_LABELS, SENDER_LABELS } from "@/app/lib/mail/types";
import MailShell from "@/app/components/mail/MailShell";
import { BTN_PRIMARY, Chip, Empty, ErrorBox, ROW, TABLE, TD, TH } from "@/app/components/mail/ui";
import { day } from "@/app/components/mail/format";

// Reusable mails in our brand layout: the list. A row opens the block editor with its live preview.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach templates", robots: { index: false, follow: false } };

const Page = async ({ searchParams }: { searchParams: Promise<{ archived?: string }> }) => {
  const archived = (await searchParams).archived === "1";
  const res = await listTemplates({ archived });

  return (
    <MailShell
      title="Templates"
      description="Reusable mails for campaigns and playbook steps."
      actions={
        <>
          <Link href={archived ? "/heroshima/outreach/templates" : "/heroshima/outreach/templates?archived=1"} className="text-xs font-semibold text-gray-600 hover:underline">
            {archived ? "Show current" : "Show archived"}
          </Link>
          <Link href="/heroshima/outreach/templates/new" className={BTN_PRIMARY}>
            New template
          </Link>
        </>
      }>
      {res.error ? (
        <ErrorBox>The templates couldn&apos;t be loaded: {res.error}</ErrorBox>
      ) : !res.data?.length ? (
        <Empty>{archived ? "No archived templates." : "No templates yet. Make one, or load the starter set from Playbooks."}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Subject</th>
                <th className={TH}>From</th>
                <th className={TH}>Pref</th>
                <th className={TH}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {res.data.map((t) => (
                <tr key={t.id} className={`${ROW} hover:bg-gray-50`}>
                  <td className={TD}>
                    <Link href={`/heroshima/outreach/templates/${t.id}`} className="font-semibold hover:underline">
                      {t.name || "Untitled"}
                    </Link>{" "}
                    {t.seedKey ? <Chip tone="outline">starter</Chip> : null}
                  </td>
                  <td className={`${TD} max-w-[360px] truncate text-gray-700`} title={t.subject}>
                    {t.subject}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-gray-600`}>{SENDER_LABELS[t.sender] ?? t.sender}</td>
                  <td className={`${TD} whitespace-nowrap text-gray-600`}>{t.pref ? PREF_LABELS[t.pref] : "None"}</td>
                  <td className={`${TD} whitespace-nowrap text-gray-600`}>{day(t.updatedAt ?? t.createdAt)}</td>
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
