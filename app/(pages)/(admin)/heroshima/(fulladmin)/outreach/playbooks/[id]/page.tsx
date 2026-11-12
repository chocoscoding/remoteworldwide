import { notFound } from "next/navigation";
import { getMailSettings, getPlaybook, getPlaybookReport, listAudiences, listMailActions, listOffers, listTemplates } from "@/libs/mail-admin";
import { DEFAULT_SETTINGS, type MailPlaybook, type PlaybookReport } from "@/app/lib/mail/types";
import { Panel, StatTile } from "@/app/components/ADMIN/analytics/Charts";
import { CONTEXT, HBars, METRIC, TimeSeries, num } from "@/app/components/mail/charts";
import MailShell from "@/app/components/mail/MailShell";
import { ErrorBox, StatusChip } from "@/app/components/mail/ui";
import { n, pct, ratio } from "@/app/components/mail/format";
import PlaybookEditor from "./PlaybookEditor";

// One playbook: the editor as a vertical step list, with each step's numbers and the people at it,
// and beside it the send steps as bars (sent, opened, clicked, converted) and 30 days of people
// entering against reaching the goal. /playbooks/new starts an empty draft.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach playbook", robots: { index: false, follow: false } };

const BACK = { href: "/heroshima/outreach/playbooks", label: "Playbooks" };
const STATUS_LABEL = { draft: "Draft", live: "Live", paused: "Paused" } as const;

/** The report's holdout, whatever shape it comes in: people kept back and how many reached the goal. */
const holdoutOf = (h: unknown): { people: number; converted: number } | null => {
  if (!h || typeof h !== "object") return null;
  const o = h as Record<string, unknown>;
  const people = Number(o.people ?? o.count ?? 0) || 0;
  const converted = Number(o.converted ?? o.upgraded ?? o.goal ?? 0) || 0;
  return people ? { people, converted } : null;
};

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[a-f\d]{24}$/i.test(id)) notFound();

  const [playbookRes, reportRes, templates, offers, actions, audiences, settings] = await Promise.all([
    isNew ? null : getPlaybook(id),
    isNew ? null : getPlaybookReport(id),
    listTemplates(),
    listOffers(),
    listMailActions(),
    listAudiences(),
    getMailSettings(),
  ]);

  if (playbookRes && (playbookRes.error || !playbookRes.data)) {
    return (
      <MailShell title="Playbook" back={BACK}>
        <ErrorBox>This playbook couldn&apos;t be loaded: {playbookRes.error ?? "no answer from the backend."}</ErrorBox>
      </MailShell>
    );
  }
  const playbook: MailPlaybook | null = playbookRes?.data ?? null;
  const report: PlaybookReport | null = reportRes?.data ?? null;
  const failures = [templates.error && "templates", offers.error && "offers", actions.error && "actions", audiences.error && "audiences"].filter(Boolean);
  const holdout = holdoutOf(report?.holdout);
  const counts = playbook?.counts;
  const goalReached = Number(report?.totals?.converted ?? 0) || 0;
  const sendSteps = (report?.steps ?? []).map((s, i) => ({ ...s, n: i + 1 })).filter((s) => s.type === "send" || num(s.sent) > 0);
  const daily = report?.daily;
  const aside =
    playbook && report && (sendSteps.length || daily) ? (
      <>
        {sendSteps.length ? (
          <Panel title="Mail steps">
            <HBars
              label="Each send step: mails sent, opened, clicked and converted"
              series={[
                { key: "sent", label: "Sent", color: METRIC.sent },
                { key: "opened", label: "Opened (estimate)", color: METRIC.opened },
                { key: "clicked", label: "Clicked", color: METRIC.clicked },
                { key: "converted", label: "Converted", color: METRIC.converted },
              ]}
              rows={sendSteps.map((s) => ({
                key: s.stepId,
                label: `${s.n}. ${s.label || "Send"}`,
                values: [num(s.sent), num(s.opened), num(s.clicked), num(s.converted)],
                sub: `${n(s.inStep)} here now · ${pct(ratio(s.clicked, s.sent), 0)} clicked`,
              }))}
              empty="No mail sent from this playbook yet."
            />
          </Panel>
        ) : null}
        {daily ? (
          <Panel title="Last 30 days">
            <TimeSeries
              label="People entering this playbook and reaching its goal a day, last 30 days"
              height={200}
              x={daily.map((d) => d.day)}
              series={[
                { key: "entered", label: "Entered", color: CONTEXT, values: daily.map((d) => num(d.entered)) },
                { key: "converted", label: "Reached the goal", short: "Goal", color: METRIC.converted, values: daily.map((d) => num(d.converted)) },
              ]}
              empty="Nobody entered in the last 30 days."
            />
          </Panel>
        ) : null}
      </>
    ) : undefined;

  return (
    <MailShell
      title={playbook ? playbook.name || "Playbook" : "New playbook"}
      description={playbook?.description || undefined}
      back={BACK}
      actions={playbook ? <StatusChip status={playbook.status} label={STATUS_LABEL[playbook.status] ?? playbook.status} /> : undefined}>
      {failures.length ? <ErrorBox className="mb-4">Some lists couldn&apos;t be loaded: {failures.join(", ")}.</ErrorBox> : null}
      {reportRes?.error ? <ErrorBox className="mb-4">The step numbers couldn&apos;t be loaded: {reportRes.error}</ErrorBox> : null}

      {playbook ? (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="In it now" value={counts?.active ?? 0} dark />
          <StatTile label="Finished" value={counts?.done ?? 0} />
          <StatTile label="Left early" value={counts?.exited ?? 0} hint="goal met or rules" />
          <StatTile label="Reached the goal" value={goalReached} />
          <StatTile
            label="Holdout"
            value={counts?.holdout ?? holdout?.people ?? 0}
            hint={holdout ? `${n(holdout.converted)} reached the goal (${pct(ratio(holdout.converted, holdout.people), 0)})` : `${playbook.holdoutPercent}% kept back`}
          />
        </div>
      ) : null}

      <PlaybookEditor
        playbook={playbook}
        templates={templates.data ?? []}
        offers={offers.data ?? []}
        actions={actions.data ?? []}
        audiences={audiences.data ?? []}
        maxDiscountPercent={settings.data?.maxDiscountPercent ?? DEFAULT_SETTINGS.maxDiscountPercent}
        stats={report?.steps ?? []}
        aside={aside}
      />
    </MailShell>
  );
};

export default Page;
