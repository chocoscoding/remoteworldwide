import type { FC } from "react";
import Link from "next/link";
import { FACE_EMOJI, FACE_LABELS, FACES, type FeedbackSummary, type Totals } from "@/app/lib/mail/types";
import { Bars, FACE, groupByWeek } from "./charts";
import { ShareBar, TABLE, TD, TH, ROW, Empty } from "./ui";
import { dateTime, money, n, pct, ratio } from "./format";

// Outreach report pieces that read as tables and lists: the funnel per row (campaigns, playbook
// steps, templates, product mails) and the feedback block (faces as a share bar and over time,
// Yes / No, the latest comments). No hooks: server pages render them; the over-time chart inside is
// a client chart from ./charts.

/** The funnel per row: campaigns, playbook steps, templates or product mail kinds. */
export const FunnelTable: FC<{ rows: Array<Totals & { id: string; label: string }>; hrefFor?: (id: string) => string | null; empty?: string }> = ({
  rows,
  hrefFor,
  empty = "Nothing sent in this range.",
}) => {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>Name</th>
            <th className={`${TH} text-right`}>Sent</th>
            <th className={`${TH} text-right`}>Delivered</th>
            <th className={`${TH} text-right`} title="Opens are an estimate: some mail apps hide them, some open everything">
              Opened*
            </th>
            <th className={`${TH} text-right`}>Clicked</th>
            <th className={`${TH} text-right`}>Replied</th>
            <th className={`${TH} text-right`}>Unsub</th>
            <th className={`${TH} text-right`}>Bounced</th>
            <th className={`${TH} text-right`}>Complaints</th>
            <th className={`${TH} text-right`}>Converted</th>
            <th className={`${TH} text-right`}>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const href = r.id ? (hrefFor?.(r.id) ?? null) : null;
            return (
              <tr key={r.id || i} className={`${ROW} hover:bg-gray-50`}>
                <td className={`${TD} max-w-[280px] truncate font-semibold`} title={r.label}>
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {r.label || r.id}
                    </Link>
                  ) : (
                    r.label || r.id
                  )}
                </td>
                <td className={`${TD} text-right tabular-nums`}>{n(r.sent)}</td>
                <Rate value={r.delivered} of={r.sent} />
                <Rate value={r.opened} of={r.delivered} />
                <Rate value={r.clicked} of={r.delivered} />
                <Rate value={r.replied} of={r.delivered} />
                <Rate value={r.unsubscribed} of={r.delivered} />
                <Rate value={r.bounced} of={r.sent} />
                <Rate value={r.complained} of={r.delivered} />
                <Rate value={r.converted} of={r.delivered} />
                <td className={`${TD} text-right tabular-nums`}>{money(r.revenueCents)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-gray-500">* Opens are an estimate. Rates are of delivered (bounced and delivered: of sent).</p>
    </div>
  );
};

const Rate: FC<{ value: number; of: number }> = ({ value, of }) => (
  <td className={`${TD} text-right tabular-nums`} title={`${n(value)} of ${n(of)}`}>
    {n(value)} <span className="text-xs text-gray-500">{pct(ratio(value, of), 0)}</span>
  </td>
);


/**
 * Share of the four faces (a thin segmented bar beside its figures), the faces over time as 100%
 * columns when the backend sends a series (by week with `weekly`), Yes / No, and the latest comments.
 */
export const FeedbackBlock: FC<{ feedback: FeedbackSummary | null | undefined; showEmail?: boolean; weekly?: boolean }> = ({ feedback, showEmail = true, weekly = false }) => {
  if (!feedback) return <Empty>No feedback yet.</Empty>;
  const faces = FACES.map((f) => ({ label: FACE_LABELS[f], value: Number(feedback[f]) || 0, color: FACE[f] }));
  const total = faces.reduce((s, f) => s + f.value, 0);
  const useful = (Number(feedback.yes) || 0) + (Number(feedback.no) || 0);
  const daily = feedback.daily ?? [];
  const series = weekly ? groupByWeek(daily, FACES) : daily;
  const answered = series.some((d) => FACES.some((f) => (Number(d[f]) || 0) > 0));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-xs text-gray-500">
          <span>How is it going? {n(total)} answers</span>
          {total ? <span>{pct(ratio(faces[0].value + faces[1].value, total), 0)} happy</span> : null}
        </div>
        <ShareBar parts={faces} />
        <ul className="mt-2 grid grid-cols-4 gap-2 text-xs">
          {FACES.map((f, i) => (
            <li key={f} className="flex items-center gap-1">
              <span aria-hidden className="inline-block h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: FACE[f] }} />
              <span className="text-gray-600">
                <span aria-hidden>{FACE_EMOJI[f]}</span> {FACE_LABELS[f]}
              </span>
              <span className="ml-auto font-semibold tabular-nums">{total ? pct(ratio(faces[i].value, total), 0) : "0%"}</span>
            </li>
          ))}
        </ul>
      </div>

      {answered ? (
        <div>
          <p className="mb-1 text-xs text-gray-500">Share of answers {weekly ? "a week" : "a day"}</p>
          <Bars
            label={`Feedback faces as a share of answers ${weekly ? "a week" : "a day"}`}
            categories={series.map((d) => d.day)}
            xKind={weekly ? "week" : "day"}
            mode="percent"
            totalLabel="answers"
            height={170}
            series={FACES.map((f) => ({ key: f, label: FACE_LABELS[f], color: FACE[f], values: series.map((d) => Number(d[f]) || 0) }))}
          />
        </div>
      ) : null}

      <div className="text-sm">
        <span className="text-gray-500">Was this useful?</span> <strong className="tabular-nums">{n(feedback.yes)}</strong> yes ·{" "}
        <strong className="tabular-nums">{n(feedback.no)}</strong> no
        {useful ? <span className="text-gray-500"> ({pct(ratio(feedback.yes, useful), 0)} yes)</span> : null}
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-gray-500">Latest comments</p>
        {feedback.comments?.length ? (
          <ul className="flex flex-col">
            {feedback.comments.slice(0, 12).map((c, i) => (
              <li key={i} className="border-t border-gray-200 py-2 text-sm first:border-t-0">
                <p className="whitespace-pre-wrap">{c.comment}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {FACE_EMOJI[c.answer as keyof typeof FACE_EMOJI] ?? c.answer} {showEmail && c.email ? `${c.email} · ` : ""}
                  {dateTime(c.at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No comments yet.</p>
        )}
      </div>
    </div>
  );
};
