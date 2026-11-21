import { Fragment, type FC, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { getMailSettings, getPlaybook, getPlaybookReport, listAudiences, listMailActions, listOffers, listTemplates } from "@/libs/mail-admin";
import { DEFAULT_SETTINGS, type MailPlaybook, type PlaybookReport } from "@/app/lib/mail/types";
import { CONTEXT, HBars, METRIC, TimeSeries, num } from "@/app/components/mail/charts";
import MailShell from "@/app/components/mail/MailShell";
import { ErrorBox } from "@/app/components/mail/ui";
import { n, pct, ratio } from "@/app/components/mail/format";
import PlaybookEditor from "./PlaybookEditor";

// One playbook: the editor (its name as the title, the rules sentence, the flow of step cards, the
// inspector). Once people have entered, the playbook's numbers are one quiet line under the rules,
// with the report charts (send steps as bars, 30 days of people entering against reaching the
// goal) folded under "Numbers". /playbooks/new starts an empty draft.
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

const Figure: FC<{ value: number; label: string; hint?: string; extra?: string }> = ({ value, label, hint, extra }) => (
  <span className="whitespace-nowrap" title={hint}>
    <strong className="font-semibold tabular-nums text-gray-900">{n(value)}</strong> {label}
    {extra ? <span className="text-xs text-gray-400"> {extra}</span> : null}
  </span>
);

/** The playbook's people so far: the counts, the goal and holdout figures, and the report's days and steps. */
const peopleSoFar = (playbook: MailPlaybook, report: PlaybookReport | null) => {
  const c = playbook.counts;
  const fromSteps = (report?.steps ?? []).reduce((sum, s) => sum + (Number(s.inStep) || 0) + (Number(s.sent) || 0), 0);
  const fromDays = (report?.daily ?? []).reduce((sum, d) => sum + (Number(d.entered) || 0), 0);
  return (
    (c?.active ?? 0) +
    (c?.done ?? 0) +
    (c?.exited ?? 0) +
    (c?.holdout ?? 0) +
    (Number(report?.totals?.converted ?? 0) || 0) +
    (holdoutOf(report?.holdout)?.people ?? 0) +
    fromSteps +
    fromDays
  );
};

/** The five numbers in one quiet line; with charts, the line opens them. */
const NumbersLine: FC<{ playbook: MailPlaybook; report: PlaybookReport | null; charts: ReactNode }> = ({ playbook, report, charts }) => {
  const counts = playbook.counts;
  const holdout = holdoutOf(report?.holdout);
  const goalReached = Number(report?.totals?.converted ?? 0) || 0;
  const holdoutPeople = counts?.holdout ?? holdout?.people ?? 0;
  const figures = [
    <Figure key="active" value={counts?.active ?? 0} label="in it now" />,
    <Figure key="done" value={counts?.done ?? 0} label="finished" />,
    <Figure key="exited" value={counts?.exited ?? 0} label="left early" hint="Goal met or rules" />,
    <Figure key="goal" value={goalReached} label="reached the goal" />,
    <Figure
      key="holdout"
      value={holdoutPeople}
      label="holdout"
      extra={holdout ? `(${n(holdout.converted)} reached the goal, ${pct(ratio(holdout.converted, holdout.people), 0)})` : `(${playbook.holdoutPercent}% kept back)`}
    />,
  ];
  // Inline, with each dot kept on its figure's line, so a wrapped line never starts with a dot.
  const line = (
    <span className="min-w-0 text-sm text-gray-500">
      {figures.map((f, i) => (
        <Fragment key={i}>
          {i ? " " : null}
          <span className="whitespace-nowrap">
            {f}
            {i < figures.length - 1 ? (
              <span aria-hidden className="text-gray-300">
                {" "}·
              </span>
            ) : null}
          </span>
        </Fragment>
      ))}
    </span>
  );

  if (!charts) return <div className="py-0.5">{line}</div>;
  return (
    <details className="group">
      <summary className="flex w-fit max-w-full cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-0.5 py-0.5 [&::-webkit-details-marker]:hidden">
        {line}
        <span className="inline-flex flex-none items-center gap-1 text-xs font-semibold text-gray-600 group-hover:text-black">
          Numbers
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="mt-2 grid gap-6 border-y border-gray-200 py-4 xl:grid-cols-2">{charts}</div>
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
    // The editor's name field is the title here, edited in place.
    <MailShell back={BACK}>
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
        numbers={playbook && peopleSoFar(playbook, report) > 0 ? <NumbersLine playbook={playbook} report={report} charts={charts} /> : undefined}
      />
    </MailShell>
  );
};

export default Page;
