import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Panel, StatTile } from "@/app/components/ADMIN/analytics/Charts";
import { Sparkbars } from "@/app/components/mail/charts";
import {
  FEEDBACK_LABELS,
  MAIL_PREF_LABELS,
  MAIL_RUN_STATUS_LABELS,
  MAIL_SOURCE_LABELS,
  MARKETING_PREFS,
  UNSUBSCRIBE_REASON_LABELS,
  humanKey,
  isFeedbackAnswer,
  isPast,
  mailWhen,
  shortLink,
  type UserMailDetail,
  type UserMailFeedback,
  type UserMailGrant,
  type UserMailRun,
  type UserMailSend,
} from "@/app/lib/mail/userMail";
import MailLevelBadge from "../MailLevelBadge";

// The Outreach panel on a person's page (/heroshima/users/[id], MAIL-PLAN.md section 6): how they take
// our mail, every mail sent to them with what they did with it, the playbooks they are in and what
// started each, their personal offers, what they told us, and their mail switches. Server-rendered
// from GET /api/admin/mail/analytics/users/:id (libs/analytics-admin.ts getUserMail).

type Tone = "plain" | "good" | "read" | "bad" | "dark";

const TONE: Record<Tone, string> = {
  plain: "border-gray-300 bg-white text-gray-700",
  good: "border-black bg-[#e1f073] text-black",
  read: "border-[#c5d5ee] bg-[#e2ebf8] text-[#1c3d6e]",
  bad: "border-[#f3c4b8] bg-[#fdeae6] text-[#b23c26]",
  dark: "border-black bg-black text-[#e1f073]",
};

const Chip: FC<{ tone?: Tone; title?: string; children: ReactNode }> = ({ tone = "plain", title, children }) => (
  <span title={title} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4", TONE[tone])}>
    {children}
  </span>
);

const Heading: FC<{ children: ReactNode }> = ({ children }) => <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{children}</h3>;

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

const faceText = (answer: string) => {
  if (!isFeedbackAnswer(answer)) return humanKey(answer);
  const { emoji, label } = FEEDBACK_LABELS[answer];
  return emoji ? `${emoji} ${label}` : label;
};

/** What happened to one mail, in chips: how it ended up, then what they did with it. */
function sendChips(s: UserMailSend): { key: string; tone: Tone; label: string; title?: string }[] {
  const chips: { key: string; tone: Tone; label: string; title?: string }[] = [];
  if (s.status === "failed") chips.push({ key: "failed", tone: "bad", label: "Failed", title: s.failReason ?? undefined });
  if (s.bouncedAt) chips.push({ key: "bounced", tone: "bad", label: s.bounceType ? `Bounced, ${s.bounceType.toLowerCase()}` : "Bounced", title: mailWhen(s.bouncedAt) });
  if (s.complainedAt) chips.push({ key: "complained", tone: "bad", label: "Marked as spam", title: mailWhen(s.complainedAt) });
  if (s.deliveredAt) chips.push({ key: "delivered", tone: "plain", label: "Delivered", title: mailWhen(s.deliveredAt) });
  else if (!s.bouncedAt && s.status !== "failed") chips.push({ key: "sent", tone: "plain", label: s.sentAt ? "Sent" : "Queued" });
  if (s.opens > 0) chips.push({ key: "opened", tone: "read", label: `Opened ×${s.opens}`, title: "Opens are an estimate: some mail apps load images for everyone, some for no one" });
  if (s.clicks > 0) chips.push({ key: "clicked", tone: "good", label: `Clicked ×${s.clicks}` });
  if (s.visitedAt) chips.push({ key: "visited", tone: "good", label: "Visited", title: mailWhen(s.visitedAt) });
  if (s.feedback) chips.push({ key: "feedback", tone: "plain", label: faceText(s.feedback), title: "Their answer in the mail" });
  if (s.repliedAt) chips.push({ key: "replied", tone: "dark", label: "Replied", title: mailWhen(s.repliedAt) });
  if (s.unsubscribedAt) chips.push({ key: "unsubscribed", tone: "bad", label: "Unsubscribed", title: mailWhen(s.unsubscribedAt) });
  return chips;
}

const SendRow: FC<{ send: UserMailSend }> = ({ send: s }) => {
  const from = s.campaignName ?? s.playbookName ?? (s.kind ? humanKey(s.kind) : null);
  return (
    <li className="border-b border-gray-100 py-2.5 last:border-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <time className="w-[128px] flex-none text-xs tabular-nums text-gray-500" dateTime={s.sentAt ?? undefined}>
          {s.sentAt ? mailWhen(s.sentAt) : "Not sent yet"}
        </time>
        <span className="min-w-0 flex-1 break-words font-semibold">{s.subject || "(no subject)"}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:pl-[140px]">
        <span className="text-xs text-gray-500">
          {MAIL_SOURCE_LABELS[s.src] ?? s.src}
          {from ? `: ${from}` : ""}
        </span>
        {sendChips(s).map((c) => (
          <Chip key={c.key} tone={c.tone} title={c.title}>
            {c.label}
          </Chip>
        ))}
      </div>
      {s.links?.length ? (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600 sm:pl-[140px]">
          {s.links.map((l) => (
            <li key={l.url} title={l.url} className="max-w-full truncate">
              → {shortLink(l.url)} <span className="tabular-nums text-gray-500">×{l.clicks}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
};

/** What put them in a playbook: "Viewed plans (action), 3 times in 3 days". */
function startedBy(run: UserMailRun): string | null {
  if (!run.enteredBy) return null;
  const { kind, key, detail } = run.enteredBy;
  const what = kind === "audience" ? "Joined its audience" : `${humanKey(key)} (${kind})`;
  let extra = "";
  if (typeof detail === "string" || typeof detail === "number") extra = String(detail);
  else if (detail && typeof detail === "object") {
    const d = detail as { count?: unknown; withinDays?: unknown; name?: unknown };
    if (typeof d.count === "number" && typeof d.withinDays === "number") extra = `${d.count} times in ${d.withinDays} days`;
    else if (typeof d.name === "string") extra = d.name;
  }
  return extra ? `${what}, ${extra}` : what;
}

const stepText = (step: UserMailRun["step"]) => (typeof step === "number" ? `Step ${step + 1}` : step ? `Step ${step}` : null);

const RunRow: FC<{ run: UserMailRun }> = ({ run }) => {
  const started = startedBy(run);
  const step = stepText(run.step);
  const live = run.status === "active" || run.status === "waiting";
  return (
    <li className="border-b border-gray-100 py-2 last:border-0">
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">{run.name}</span>
        <Chip tone={live ? "good" : run.status === "failed" ? "bad" : "plain"}>{MAIL_RUN_STATUS_LABELS[run.status] ?? run.status}</Chip>
      </p>
      {started ? (
        <p className="text-xs text-gray-600">
          Started by {started}
          {run.enteredAt ? ` · ${mailWhen(run.enteredAt)}` : ""}
        </p>
      ) : null}
      {step || (live && run.nextAt) ? (
        <p className="text-xs text-gray-600">
          {step}
          {step && live && run.nextAt ? " · " : ""}
          {live && run.nextAt ? `next step ${mailWhen(run.nextAt)}` : ""}
        </p>
      ) : null}
    </li>
  );
};

const GrantRow: FC<{ grant: UserMailGrant }> = ({ grant: g }) => {
  const expired = !g.redeemedAt && isPast(g.expiresAt);
  return (
    <li className="border-b border-gray-100 py-2 last:border-0">
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold tabular-nums">{g.discountLabel} off</span>
        {g.offerName ? <span className="text-xs text-gray-500">{g.offerName}</span> : null}
        {g.holdout ? <Chip>Holdout, no mail</Chip> : g.code ? <code className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-[11px] font-bold">{g.code}</code> : null}
        {g.redeemedAt ? (
          <Chip tone="good" title={mailWhen(g.redeemedAt)}>
            Redeemed
          </Chip>
        ) : expired ? (
          <Chip>Expired</Chip>
        ) : null}
        {g.clickedAt && !g.redeemedAt ? (
          <Chip tone="read" title={mailWhen(g.clickedAt)}>
            Clicked
          </Chip>
        ) : null}
      </p>
      <p className="text-xs text-gray-600">
        {g.createdAt ? `Given ${mailWhen(g.createdAt)} · ` : ""}
        {expired ? "expired" : "until"} {mailWhen(g.expiresAt)}
        {g.redeemedAt && (g.discountCents || g.revenueCents)
          ? ` · ${[g.discountCents ? `${money(g.discountCents)} off` : null, g.revenueCents ? `${money(g.revenueCents)} paid` : null].filter(Boolean).join(", ")}`
          : ""}
      </p>
    </li>
  );
};

const FeedbackRow: FC<{ row: UserMailFeedback }> = ({ row }) => {
  const reason = row.kind === "unsubscribe_reason";
  const answer = reason ? (UNSUBSCRIBE_REASON_LABELS[row.answer as keyof typeof UNSUBSCRIBE_REASON_LABELS] ?? humanKey(row.answer)) : faceText(row.answer);
  return (
    <li className="border-b border-gray-100 py-2 last:border-0">
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
        <span className="font-semibold">{reason ? `Unsubscribed: ${answer}` : answer}</span>
        <span className="text-xs text-gray-500">
          {reason && row.pref ? `${MAIL_PREF_LABELS[row.pref] ?? row.pref} · ` : ""}
          {row.subject ? `on "${row.subject}" · ` : ""}
          {mailWhen(row.at)}
        </span>
      </p>
      {row.comment ? <p className="mt-0.5 whitespace-pre-line break-words text-sm text-gray-700">&ldquo;{row.comment}&rdquo;</p> : null}
    </li>
  );
};

/** Their switches, the two marketing ones first (both off makes them Unreachable), then the rest in the settings screen's order. */
function prefRows(prefs: Record<string, boolean>): { key: string; label: string; on: boolean }[] {
  const order = [...MARKETING_PREFS, ...Object.keys(MAIL_PREF_LABELS).filter((k) => !(MARKETING_PREFS as readonly string[]).includes(k))];
  const keys = [...order.filter((k) => k in prefs), ...Object.keys(prefs).filter((k) => !order.includes(k))];
  return keys.filter((k) => typeof prefs[k] === "boolean").map((k) => ({ key: k, label: MAIL_PREF_LABELS[k] ?? humanKey(k), on: prefs[k] }));
}

const MailPanel: FC<{ mail: UserMailDetail | null; error?: string | null }> = ({ mail, error }) => {
  if (!mail) {
    return (
      <Panel title="Outreach" className="mb-4">
        <p className="text-sm text-gray-500">Their mail couldn&apos;t be loaded{error ? `: ${error}` : "."}</p>
      </Panel>
    );
  }

  const { tiles } = mail;
  const prefs = prefRows(mail.prefs ?? {});
  const sends = mail.sends ?? [];
  const runs = mail.runs ?? [];
  const offers = mail.offers ?? [];
  const feedback = mail.feedback ?? [];
  const weekly = mail.weekly;

  return (
    <Panel title="Outreach" className="mb-4" aside={<MailLevelBadge level={mail.level} />}>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Mails, 30 d" value={tiles.sent30d} />
        <StatTile label="Opened, 30 d" value={tiles.opened30d} hint="estimate" />
        <StatTile label="Clicked, 30 d" value={tiles.clicked30d} />
        <StatTile label="Replied" value={tiles.replied} />
        <StatTile label="Conversions" value={tiles.conversions} hint="credited to a mail" />
      </div>

      {weekly?.length ? (
        <section className="mb-4 max-w-xl">
          <Heading>Last 12 weeks</Heading>
          <Sparkbars
            label="Mails sent, opened and clicked a week, last 12 weeks"
            x={weekly.map((w) => w.week)}
            xKind="week"
            rows={[
              { key: "sent", label: "Sent", values: weekly.map((w) => w.sent) },
              { key: "opened", label: "Opened*", values: weekly.map((w) => w.opened) },
              { key: "clicked", label: "Clicked", values: weekly.map((w) => w.clicked) },
            ]}
            empty="No mail in the last 12 weeks."
          />
          <p className="mt-1 text-[11px] text-gray-500">* Opens are an estimate. The latest week is highlighted.</p>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <Heading>Mails sent{sends.length ? `, newest first (${sends.length.toLocaleString("en-GB")})` : ""}</Heading>
          {sends.length ? (
            <ol className="max-h-[560px] overflow-y-auto pr-1 text-sm">
              {sends.map((s) => (
                <SendRow key={s.id} send={s} />
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-500">No mail sent to them yet.</p>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section>
            <Heading>Playbooks</Heading>
            {runs.length ? (
              <ul className="text-sm">
                {runs.map((r, i) => (
                  <RunRow key={`${r.playbookId}-${i}`} run={r} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Not in any playbook.</p>
            )}
          </section>

          <section>
            <Heading>Offers</Heading>
            {offers.length ? (
              <ul className="text-sm">
                {offers.map((g, i) => (
                  <GrantRow key={g.id ?? g._id ?? `${g.code}-${i}`} grant={g} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No personal offers.</p>
            )}
          </section>

          <section>
            <Heading>Feedback</Heading>
            {feedback.length ? (
              <ul>
                {feedback.map((f, i) => (
                  <FeedbackRow key={f.id ?? f._id ?? `${f.at}-${i}`} row={f} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Nothing yet.</p>
            )}
          </section>

          <section>
            <Heading>Mail switches</Heading>
            {mail.suppressed ? (
              <p className="mb-2 rounded-md border border-[#f3c4b8] bg-[#fdeae6] px-3 py-2 text-xs text-[#b23c26]">
                <strong>Suppressed</strong> since {mailWhen(mail.suppressed.at)}
                {mail.suppressed.reason ? ` (${mail.suppressed.reason})` : ""}. No marketing mail goes to this address.
              </p>
            ) : (
              <p className="mb-2 text-xs text-gray-500">Not suppressed.</p>
            )}
            {prefs.length ? (
              <ul className="text-sm">
                {prefs.map((p) => (
                  <li key={p.key} className="flex items-center justify-between gap-2 border-b border-gray-100 py-1 last:border-0">
                    <span>{p.label}</span>
                    <span className={cn("text-xs font-bold", p.on ? "text-[#3d6b12]" : "text-gray-400")}>{p.on ? "On" : "Off"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </div>
    </Panel>
  );
};

export default MailPanel;
