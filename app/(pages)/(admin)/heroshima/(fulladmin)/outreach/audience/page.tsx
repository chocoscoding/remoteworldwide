import Link from "next/link";
import { Lock } from "lucide-react";
import { listAudiences, listCampaigns } from "@/libs/mail-admin";
import { AUDIENCE_BUILT_INS, type MailAudience } from "@/app/lib/mail/types";
import MailShell from "@/app/components/mail/MailShell";
import { BTN_PRIMARY, Empty, ErrorBox, ROW, TABLE, TD, TH } from "@/app/components/mail/ui";
import { day, n } from "@/app/components/mail/format";
import { AUDIENCE_HREF, BUILT_IN_NAMES, UNTITLED_AUDIENCE, audienceSummary } from "@/app/components/mail/audience/filterText";

// The audiences: the two fixed ones pinned on top (every account, and every account that can get
// mail now), then the saved ones, used by campaigns and the playbook "joins an audience" trigger.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach audiences", robots: { index: false, follow: false } };

const people = (count: number) => `${n(count)} ${count === 1 ? "person" : "people"}`;

/** "1,213 people, 564 can get mail" for All users; "564 people" for All outreachable users. */
const fixedLine = (a: MailAudience) => {
  if (a.count === undefined) return a.builtIn === "all_outreachable" ? "Every account that can get mail now" : "Every account";
  if (a.builtIn === "all_users" && a.reachable !== undefined) return `${people(a.count)}, ${n(a.reachable)} can get mail`;
  return people(a.count);
};

const Page = async () => {
  const [res, campaigns] = await Promise.all([listAudiences(), listCampaigns()]);
  const all = res.data ?? [];
  const fixed = AUDIENCE_BUILT_INS.map((b) => all.find((a) => a.builtIn === b)).filter((a): a is MailAudience => Boolean(a));
  const saved = all.filter((a) => !a.builtIn);
  const ctx = { campaigns: (campaigns.data ?? []).map((c) => ({ id: c.id, name: c.name })) };

  return (
    <MailShell
      title="Audience"
      actions={
        <Link href={`${AUDIENCE_HREF}/new`} className={BTN_PRIMARY}>
          New audience
        </Link>
      }>
      {res.error ? (
        <ErrorBox>The audiences couldn&apos;t be loaded: {res.error}</ErrorBox>
      ) : (
        <div className="flex flex-col gap-6">
          {fixed.length ? (
            <section aria-label="Fixed audiences" className="grid gap-3 sm:grid-cols-2">
              {fixed.map((a) => (
                <Link key={a.id} href={`${AUDIENCE_HREF}/${a.id}`} className="flex flex-col gap-1 rounded-md bg-white px-4 py-3.5 br-plain-press">
                  <span className="flex items-center gap-2 font-bold">
                    {a.name || (a.builtIn ? BUILT_IN_NAMES[a.builtIn] : UNTITLED_AUDIENCE)}
                    <Lock className="h-3.5 w-3.5 text-gray-400" aria-label="Fixed audience" />
                  </span>
                  <span className="text-sm tabular-nums text-gray-600">{fixedLine(a)}</span>
                </Link>
              ))}
            </section>
          ) : null}

          {saved.length ? (
            <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Name</th>
                    <th className={TH}>Who</th>
                    <th className={TH}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {saved.map((a) => (
                    <tr key={a.id} className={`${ROW} hover:bg-gray-50`}>
                      <td className={`${TD} py-2.5`}>
                        <Link href={`${AUDIENCE_HREF}/${a.id}`} className="font-semibold hover:underline">
                          {a.name || UNTITLED_AUDIENCE}
                        </Link>
                      </td>
                      <td className={`${TD} py-2.5 text-gray-600`}>{audienceSummary(a.filter, ctx)}</td>
                      <td className={`${TD} whitespace-nowrap py-2.5 text-gray-600`}>{day(a.updatedAt ?? a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No saved audiences yet.</Empty>
          )}
        </div>
      )}
    </MailShell>
  );
};

export default Page;
