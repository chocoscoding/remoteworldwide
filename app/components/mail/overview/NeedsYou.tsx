import type { FC, ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, Inbox, OctagonX, PauseCircle, TriangleAlert } from "lucide-react";
import type { MailAlarms, Overview } from "@/app/lib/mail/types";
import Bullet from "../charts/Bullet";
import { STATUS } from "../charts/palette";
import { n } from "../format";
import type { Health } from "./metrics";

// The overview's "Needs you" list and the health chip in its header. Only what asks for the admin
// shows: unread replies, deliverability when it is over the warn line (the bullet bars appear only
// then), campaigns an alarm paused, and the marketing pause. Nothing to do: "Nothing needs you".
// No hooks: the server page renders these; the bullet bars inside are a client chart.

const HEALTH_ICON = { ok: CircleCheck, warn: TriangleAlert, pause: OctagonX } as const;

/** "Mail is healthy", or the alarm in words, always with its icon. Over the warn line it jumps to "Needs you". */
export const HealthChip: FC<{ health: Health }> = ({ health }) => {
  const Icon = HEALTH_ICON[health.level];
  const body = (
    <>
      <Icon className="h-4 w-4 flex-none" style={{ color: STATUS[health.level] }} aria-hidden />
      {health.text}
    </>
  );
  const chip = "inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-bold";
  return health.level === "ok" ? (
    <span className={`${chip} border-gray-300`}>
      {body}
    </span>
  ) : (
    <a href="#needs-you" className={`${chip} border-black hover:underline`}>
      {body}
    </a>
  );
};

export type PausedCampaign = { id: string; name: string; reason: string };

/** "Paused automatically: the bounce rate reached 4.2% (limit 4%)" as "The bounce rate reached 4.2% (limit 4%)". */
const reasonText = (reason: string) => {
  const rest = reason.replace(/^paused automatically:\s*/i, "").trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "An alarm paused it.";
};

const Need: FC<{ icon: ReactNode; title: ReactNode; children?: ReactNode }> = ({ icon, title, children }) => (
  <li className="flex gap-3 border-t border-gray-100 py-3 first:border-t-0 first:pt-0">
    <span className="mt-0.5 flex-none">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  </li>
);

const NeedsYou: FC<{
  health: Health;
  alarms: Overview["alarms"] | undefined;
  limits: MailAlarms;
  /** Unread open threads; `atLeast` when only the newest page was counted. Null when the inbox couldn't be read. */
  unread: { count: number; atLeast: boolean } | null;
  marketingPaused: boolean;
  pausedCampaigns: PausedCampaign[];
}> = ({ health, alarms, limits, unread, marketingPaused, pausedCampaigns }) => {
  const deliverability = health.level !== "ok";
  const replies = Boolean(unread && unread.count > 0);
  const nothing = !deliverability && !replies && !marketingPaused && !pausedCampaigns.length;
  const DeliverabilityIcon = HEALTH_ICON[health.level];

  return (
    <section id="needs-you" aria-labelledby="needs-you-title" className="scroll-mt-4 rounded-md border border-gray-300 bg-white p-4">
      <h2 id="needs-you-title" className="mb-3 text-sm font-bold">
        Needs you
      </h2>
      {nothing ? (
        <p className="flex items-center gap-2 py-4 text-sm text-gray-500">
          <CircleCheck className="h-4 w-4 flex-none" aria-hidden />
          Nothing needs you
        </p>
      ) : (
        <ul className="flex flex-col">
          {deliverability ? (
            <Need icon={<DeliverabilityIcon className="h-4 w-4" style={{ color: STATUS[health.level] }} aria-hidden />} title={health.text}>
              <p className="mb-3 text-xs text-gray-500">
                {health.level === "pause" ? "Campaigns at this level pause themselves." : "Campaigns pause themselves at the pause line."}
                {typeof alarms?.suppressed7d === "number" ? ` ${n(alarms.suppressed7d)} addresses suppressed this week.` : ""}
              </p>
              <Bullet
                label="Complaint and bounce rates against the warn and pause lines"
                table={false}
                rows={[
                  { key: "complaints", label: "Complaints", value: Number(alarms?.complaintRate) || 0, warn: limits.complaintWarn, pause: limits.complaintPause },
                  { key: "bounces", label: "Bounces", value: Number(alarms?.bounceRate) || 0, warn: limits.bounceWarn, pause: limits.bouncePause },
                ]}
              />
            </Need>
          ) : null}

          {pausedCampaigns.map((c) => (
            <Need
              key={c.id}
              icon={<OctagonX className="h-4 w-4" style={{ color: STATUS.pause }} aria-hidden />}
              title={
                <Link href={`/heroshima/outreach/campaigns/${c.id}`} className="hover:underline">
                  {c.name || "A campaign"} paused itself
                </Link>
              }>
              <p className="text-xs text-gray-500">{reasonText(c.reason)}</p>
            </Need>
          ))}

          {unread && unread.count > 0 ? (
            <Need
              icon={<Inbox className="h-4 w-4" aria-hidden />}
              title={
                <Link href="/heroshima/outreach/inbox" className="hover:underline">
                  {unread.atLeast ? "At least " : ""}
                  {n(unread.count)} unread {unread.count === 1 ? "reply" : "replies"}
                </Link>
              }
            />
          ) : null}

          {marketingPaused ? (
            <Need icon={<PauseCircle className="h-4 w-4" aria-hidden />} title="All marketing is paused">
              <p className="text-xs text-gray-500">Campaigns and playbooks wait. Product mail still goes out.</p>
            </Need>
          ) : null}
        </ul>
      )}
    </section>
  );
};

export default NeedsYou;
