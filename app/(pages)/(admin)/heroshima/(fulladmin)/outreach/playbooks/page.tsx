import Link from "next/link";
import { listAudiences, listMailActions, listPlaybooks } from "@/libs/mail-admin";
import type { MailPlaybook, PlaybookStatus } from "@/app/lib/mail/types";
import MailShell from "@/app/components/mail/MailShell";
import { BTN_PRIMARY, ErrorBox } from "@/app/components/mail/ui";
import { stepsSummary, triggerSentence } from "@/app/components/mail/playbook/summary";
import ActionsPanel from "./ActionsPanel";
import PlaybookList, { type PlaybookRow } from "./PlaybookList";
import StarterButton from "./StarterButton";

// Automations: when someone does something (N times in a window), something happens, or they join
// an audience, they walk a list of steps (wait, check, send, branch) until the goal is met. The
// list is searched and filtered in the browser; the triggers sit in a drawer behind "Triggers (n)".
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach playbooks", robots: { index: false, follow: false } };

const STATUS_ORDER: Record<PlaybookStatus, number> = { live: 0, paused: 1, draft: 2 };

const time = (p: MailPlaybook) => {
  const t = new Date(p.updatedAt ?? p.createdAt ?? 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** How many playbooks use each trigger: as the trigger, the goal, an entry rule or inside a step. */
const usageOf = (playbooks: MailPlaybook[]) => {
  const usage: Record<string, number> = {};
  for (const p of playbooks) {
    const ids = new Set<string>();
    if (p.trigger?.type === "action" && p.trigger.actionId) ids.add(p.trigger.actionId);
    if (p.goal?.type === "action" && p.goal.actionId) ids.add(p.goal.actionId);
    for (const r of p.entry?.requireActions ?? []) if (r.actionId) ids.add(r.actionId);
    for (const s of p.steps ?? []) {
      if (s.type === "wait_for" && s.what.kind === "action" && s.what.actionId) ids.add(s.what.actionId);
      if (s.type === "if" && s.condition.actionId) ids.add(s.condition.actionId);
    }
    for (const id of ids) usage[id] = (usage[id] ?? 0) + 1;
  }
  return usage;
};

const Page = async () => {
  const [playbooks, actions, audiences] = await Promise.all([listPlaybooks(), listMailActions(), listAudiences()]);
  const acts = actions.data ?? [];
  const auds = audiences.data ?? [];
  const list = playbooks.data ?? [];

  const rows: PlaybookRow[] = [...list]
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || time(b) - time(a))
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      status: p.status,
      group: p.group?.trim() || null,
      trigger: triggerSentence(p.trigger, acts, auds),
      steps: stepsSummary(p.steps),
      hasGoal: Boolean(p.goal && p.goal.type !== "none"),
      active: Number(p.counts?.active) || 0,
      trend: Array.isArray(p.trend) && p.trend.length ? p.trend.map((v) => Number(v) || 0) : null,
      stats30: p.stats30 ? { entered: Number(p.stats30.entered) || 0, converted: Number(p.stats30.converted) || 0 } : null,
    }));

  return (
    <MailShell
      title="Playbooks"
      description="People enter on a trigger, walk the steps, and leave when the goal is met."
      actions={
        <>
          <ActionsPanel actions={acts} error={actions.error} usage={usageOf(list)} />
          <StarterButton />
          <Link href="/heroshima/outreach/playbooks/new" className={BTN_PRIMARY}>
            New playbook
          </Link>
        </>
      }>
      {playbooks.error ? (
        <ErrorBox>The playbooks couldn&apos;t be loaded: {playbooks.error}</ErrorBox>
      ) : !rows.length ? (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No playbooks yet. Load the starter set (all drafts) or make one.</div>
      ) : (
        <PlaybookList rows={rows} />
      )}
    </MailShell>
  );
};

export default Page;
