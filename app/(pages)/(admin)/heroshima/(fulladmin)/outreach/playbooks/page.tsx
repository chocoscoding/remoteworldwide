import Link from "next/link";
import { listAudiences, listMailActions, listPlaybooks } from "@/libs/mail-admin";
import { EVENT_LABELS, type MailAction, type MailAudience, type Trigger } from "@/app/lib/mail/types";
import { Panel } from "@/app/components/ADMIN/analytics/Charts";
import MailShell from "@/app/components/mail/MailShell";
import { BTN_PRIMARY, Chip, ErrorBox, ROW, StatusChip, TABLE, TD, TH } from "@/app/components/mail/ui";
import { n } from "@/app/components/mail/format";
import ActionsPanel from "./ActionsPanel";
import StarterButton from "./StarterButton";

// Automations: when someone does something (N times in a window), something happens, or they join
// an audience, they walk a list of steps (wait, check, send, branch) until the goal is met. Below,
// the actions playbooks can trigger on.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach playbooks", robots: { index: false, follow: false } };

const STATUS_LABEL = { draft: "Draft", live: "Live", paused: "Paused" } as const;

const triggerText = (t: Trigger | undefined, actions: MailAction[], audiences: MailAudience[]) => {
  if (!t) return "No trigger";
  if (t.type === "action") return `${actions.find((a) => a.id === t.actionId)?.name ?? "An action"} ${t.count}x in ${t.withinDays} d`;
  if (t.type === "event") return EVENT_LABELS[t.event] ?? t.event;
  return `Joins ${audiences.find((a) => a.id === t.audienceId)?.name ?? "an audience"}`;
};

const Page = async () => {
  const [playbooks, actions, audiences] = await Promise.all([listPlaybooks(), listMailActions(), listAudiences()]);
  const acts = actions.data ?? [];
  const auds = audiences.data ?? [];

  return (
    <MailShell
      title="Playbooks"
      description="People enter on a trigger, walk the steps, and leave when the goal is met."
      actions={
        <>
          <StarterButton />
          <Link href="/heroshima/outreach/playbooks/new" className={BTN_PRIMARY}>
            New playbook
          </Link>
        </>
      }>
      {playbooks.error ? (
        <ErrorBox>The playbooks couldn&apos;t be loaded: {playbooks.error}</ErrorBox>
      ) : !playbooks.data?.length ? (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No playbooks yet. Load the starter set (all drafts) or make one.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Status</th>
                <th className={TH}>When</th>
                <th className={TH}>Group</th>
                <th className={`${TH} text-right`}>In it</th>
                <th className={`${TH} text-right`}>Done</th>
                <th className={`${TH} text-right`}>Left early</th>
                <th className={`${TH} text-right`}>Holdout</th>
              </tr>
            </thead>
            <tbody>
              {playbooks.data.map((p) => (
                <tr key={p.id} className={`${ROW} hover:bg-gray-50`}>
                  <td className={TD}>
                    <Link href={`/heroshima/outreach/playbooks/${p.id}`} className="font-semibold hover:underline">
                      {p.name || "Untitled"}
                    </Link>{" "}
                    <span className="text-xs text-gray-500">v{p.version}</span>
                    {p.description ? <span className="block max-w-[360px] truncate text-xs text-gray-500">{p.description}</span> : null}
                  </td>
                  <td className={TD}>
                    <StatusChip status={p.status} label={STATUS_LABEL[p.status] ?? p.status} />
                  </td>
                  <td className={`${TD} text-gray-600`}>{triggerText(p.trigger, acts, auds)}</td>
                  <td className={TD}>{p.group ? <Chip tone="outline">{p.group}</Chip> : <span className="text-gray-400">None</span>}</td>
                  <td className={`${TD} text-right tabular-nums`}>{n(p.counts?.active)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{n(p.counts?.done)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{n(p.counts?.exited)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{n(p.counts?.holdout)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Panel title="Actions" className="mt-6" aside={<span className="text-xs text-gray-500">What people do, as triggers. Matched every 5 minutes.</span>}>
        <div id="actions" />
        {actions.error ? <ErrorBox>The actions couldn&apos;t be loaded: {actions.error}</ErrorBox> : <ActionsPanel actions={acts} />}
      </Panel>
    </MailShell>
  );
};

export default Page;
