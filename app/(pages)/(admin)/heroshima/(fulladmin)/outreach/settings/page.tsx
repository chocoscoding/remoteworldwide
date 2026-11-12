import Link from "next/link";
import { getMailAudit, getMailSettings } from "@/libs/mail-admin";
import { Panel } from "@/app/components/ADMIN/analytics/Charts";
import MailShell from "@/app/components/mail/MailShell";
import { Empty, ErrorBox, ROW, TABLE, TD, TH } from "@/app/components/mail/ui";
import { dateTime, n } from "@/app/components/mail/format";
import SettingsForm from "./SettingsForm";

// Mail settings (the gear): caps, quiet hours, attribution, the highest discount, alarm limits,
// senders and the reply domain. Every change is logged; the log is below.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach settings", robots: { index: false, follow: false } };

const detailText = (detail: unknown) => {
  if (detail === null || detail === undefined) return "";
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail).slice(0, 300);
  } catch {
    return "";
  }
};

const Page = async ({ searchParams }: { searchParams: Promise<{ page?: string }> }) => {
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const [settings, audit] = await Promise.all([getMailSettings(), getMailAudit(page)]);

  return (
    <MailShell title="Settings" description="The numbers here are starting values. Changes apply from the next send.">
      {settings.error || !settings.data ? (
        <ErrorBox>The outreach settings couldn&apos;t be loaded: {settings.error ?? "no answer from the backend."}</ErrorBox>
      ) : (
        <SettingsForm settings={settings.data} />
      )}

      <Panel title="Change log" className="mt-6" aside={<span className="text-xs text-gray-500">Every send action and change, with who did it</span>}>
        {audit.error ? (
          <ErrorBox>The log couldn&apos;t be loaded: {audit.error}</ErrorBox>
        ) : !audit.data?.items.length ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>When</th>
                    <th className={TH}>Who</th>
                    <th className={TH}>What</th>
                    <th className={TH}>On</th>
                    <th className={TH}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data.items.map((row, i) => (
                    <tr key={row.id ?? i} className={ROW}>
                      <td className={`${TD} whitespace-nowrap text-gray-600`}>{dateTime(row.at)}</td>
                      <td className={`${TD} whitespace-nowrap`}>{row.byEmail ?? row.by ?? "System"}</td>
                      <td className={`${TD} font-mono text-xs`}>{row.action}</td>
                      <td className={`${TD} font-mono text-xs text-gray-600`}>{row.target ?? ""}</td>
                      <td className={`${TD} max-w-[420px] truncate font-mono text-xs text-gray-500`} title={detailText(row.detail)}>
                        {detailText(row.detail)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {audit.data.pages > 1 ? (
              <nav aria-label="Pages" className="mt-3 flex items-center gap-3 text-sm">
                {page > 1 ? (
                  <Link href={`/heroshima/outreach/settings?page=${page - 1}`} className="font-semibold hover:underline">
                    Newer
                  </Link>
                ) : null}
                <span className="text-gray-500">
                  Page {page} of {audit.data.pages} · {n(audit.data.total)} entries
                </span>
                {page < audit.data.pages ? (
                  <Link href={`/heroshima/outreach/settings?page=${page + 1}`} className="font-semibold hover:underline">
                    Older
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </Panel>
    </MailShell>
  );
};

export default Page;
