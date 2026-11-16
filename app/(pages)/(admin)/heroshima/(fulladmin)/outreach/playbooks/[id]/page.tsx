import type { FC, ReactNode } from "react";
import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { getMailSettings, getPlaybook, getPlaybookReport, listAudiences, listMailActions, listOffers, listTemplates } from "@/libs/mail-admin";
import { DEFAULT_SETTINGS, type MailPlaybook, type PlaybookReport } from "@/app/lib/mail/types";
import { CONTEXT, HBars, METRIC, TimeSeries, num } from "@/app/components/mail/charts";
import MailShell from "@/app/components/mail/MailShell";
import { ErrorBox } from "@/app/components/mail/ui";
import { n, pct, ratio } from "@/app/components/mail/format";
import PlaybookEditor from "./PlaybookEditor";

// One playbook: the editor (rules sentence, the flow of step cards, the inspector), with the
// playbook's numbers as one line above the flow and the report charts (send steps as bars, 30
// days of people entering against reaching the goal) folded under "Numbers". /playbooks/new
// starts an empty draft.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach playbook", robots: { index: false, follow: false } };

const BACK = { href: "/heroshima/outreach/playbooks", label: "Playbooks" };

/** The report's holdout, whatever shape it comes in: people kept back and how many reached the goal. */
const holdoutOf = (h: unknown): { people: number; converted: number } | null => {
  if (!h || typeof h !== "object") return null;
  const o = h as Record<string, unknown>;
  const people = Number(o.people ?? o.count ?? 0) || 0;
  const converted = Number(o.converted ?? o.upgraded ?? o.goal ?? 0) || 0;
  return people ? { people, converted } : null;
};

const Figure: FC<{ value: number; label: string; hint?: string; strong?: boolean }> = ({ value, label, hint, strong }) => (
  <span className="whitespace-nowrap" title={hint}>
    <strong className={strong ? "tabular-nums text-black" : "tabular-nums font-semibold text-gray-900"}>{n(value)}</strong> <span className="text-gray-600">{label}</span>
  </span>
);

/** The five numbers in one line; with charts, the line opens them. */
const NumbersLine: FC<{ playbook: MailPlaybook; report: PlaybookReport | null; charts: ReactNode }> = ({ playbook, report, charts }) => {
  const counts = playbook.counts;
  const holdout = holdoutOf(report?.holdout);
  const goalReached = Number(report?.totals?.converted ?? 0) || 0;
  const holdoutPeople = counts?.holdout ?? holdout?.people ?? 0;
  const line = (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <Figure value={counts?.active ?? 0} label="in it now" strong />
      <Figure value={counts?.done ?? 0} label="finished" />
      <Figure value={counts?.exited ?? 0} label="left early" hint="Goal met or rules" />
      <Figure value={goalReached} label="reached the goal" />
      <span className="whitespace-nowrap">
        <strong className="font-semibold tabular-nums text-gray-900">{n(holdoutPeople)}</strong> <span className="text-gray-600">holdout</span>{" "}
        <span className="text-xs text-gray-500">
          {holdout ? `(${n(holdout.converted)} reached the goal, ${pct(ratio(holdout.converted, holdout.people), 0)})` : `(${playbook.holdoutPercent}% kept back)`}
        </span>
      </span>
    </span>
  );

  if (!charts) return <div className="flex items-center rounded-md border border-gray-300 bg-white px-4 py-2.5">{line}</div>;
  return (
    <details className="group rounded-md border border-gray-300 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        {line}
        <span className="inline-flex flex-none items-center gap-1 text-xs font-semibold text-gray-600 group-hover:text-black">
          Numbers
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="grid gap-6 border-t border-gray-200 p-4 xl:grid-cols-2">{charts}</div>
    </details>
  );
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
  const failures = [templates.error && "templates", offers.error && "offers", actions.error && "triggers", audiences.error && "audiences"].filter(Boolean);
  const sendSteps = (report?.steps ?? []).map((s, i) => ({ ...s, n: i + 1 })).filter((s) => s.type === "send" || num(s.sent) > 0);
  const daily = report?.daily;
  const charts =
    playbook && report && (sendSteps.length || daily) ? (
      <>
        {sendSteps.length ? (
          <div className="min-w-0">
            <h2 className="mb-3 text-sm font-bold">Mail steps</h2>
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
          </div>
        ) : null}
        {daily ? (
          <div className="min-w-0">
            <h2 className="mb-3 text-sm font-bold">Last 30 days</h2>
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
          </div>
        ) : null}
      </>
    ) : null;

  return (
    <MailShell title={playbook ? playbook.name || "Playbook" : "New playbook"} description={playbook?.description || undefined} back={BACK}>
      {failures.length ? <ErrorBox className="mb-4">Some lists couldn&apos;t be loaded: {failures.join(", ")}.</ErrorBox> : null}
      {reportRes?.error ? <ErrorBox className="mb-4">The step numbers couldn&apos;t be loaded: {reportRes.error}</ErrorBox> : null}

      <PlaybookEditor
        playbook={playbook}
        templates={templates.data ?? []}
        offers={offers.data ?? []}
        actions={actions.data ?? []}
        audiences={audiences.data ?? []}
        maxDiscountPercent={settings.data?.maxDiscountPercent ?? DEFAULT_SETTINGS.maxDiscountPercent}
        stats={report?.steps ?? []}
        numbers={playbook ? <NumbersLine playbook={playbook} report={report} charts={charts} /> : undefined}
      />
    </MailShell>
  );
};

export default Page;
