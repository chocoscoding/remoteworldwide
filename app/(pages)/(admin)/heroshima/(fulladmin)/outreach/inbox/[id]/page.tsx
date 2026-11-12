import Link from "next/link";
import { notFound } from "next/navigation";
import { getThread } from "@/libs/mail-admin";
import { ENGAGEMENT_LABELS, type MailMessage } from "@/app/lib/mail/types";
import { TierBadge } from "@/app/components/ADMIN/analytics/Charts";
import MailShell from "@/app/components/mail/MailShell";
import { Chip, ErrorBox, StatusChip } from "@/app/components/mail/ui";
import { dateTime, day } from "@/app/components/mail/format";
import { cn } from "@/lib/utils";
import ThreadActions from "./ThreadActions";

// One conversation: the messages, the person beside them, and a reply box. Opening it marks it read.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach thread", robots: { index: false, follow: false } };

const BACK = { href: "/heroshima/outreach/inbox", label: "Inbox" };

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  const res = await getThread(id);
  if (res.error || !res.data?.thread) {
    return (
      <MailShell title="Conversation" back={BACK}>
        <ErrorBox>This conversation couldn&apos;t be loaded: {res.error ?? "no answer from the backend."}</ErrorBox>
      </MailShell>
    );
  }
  const { thread, messages, person } = res.data;
  const level = person?.engagement ?? person?.level ?? null;
  const userId = person?.userId ?? thread.userId;
  const sorted = [...messages].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <MailShell
      title={thread.subject || "(no subject)"}
      description={`${thread.name ? `${thread.name} · ` : ""}${thread.email}`}
      back={BACK}
      actions={<StatusChip status={thread.status} label={thread.status === "open" ? "Open" : "Done"} />}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-3">
          {sorted.length ? sorted.map((m) => <Message key={m.id} message={m} />) : <p className="text-sm text-gray-500">No messages yet.</p>}
          <ThreadActions id={thread.id} status={thread.status} unread={thread.unread} />
        </div>

        <aside aria-label="Person" className="flex flex-col gap-2 self-start rounded-md border border-gray-300 bg-white p-4 text-sm lg:sticky lg:top-4">
          <p className="text-base font-bold">{person?.name || thread.name || "No name"}</p>
          <p className="break-all text-gray-600">{person?.email || thread.email}</p>
          {person?.plan ? (
            <p>
              <TierBadge tier={person.plan} />
            </p>
          ) : null}
          <dl className="mt-1 flex flex-col gap-1">
            <Row label="Signed up" value={day(person?.signedUpAt ?? person?.createdAt, "Unknown")} />
            <Row label="Last active" value={dateTime(person?.lastActiveAt ?? person?.lastSeenAt, "Unknown")} />
            <Row label="Outreach" value={level ? ENGAGEMENT_LABELS[level] ?? level : "Unknown"} />
          </dl>
          {thread.tags?.length ? (
            <p className="flex flex-wrap gap-1">
              {thread.tags.map((t) => (
                <Chip key={t} tone="outline">
                  {t}
                </Chip>
              ))}
            </p>
          ) : null}
          {userId ? (
            <Link href={`/heroshima/users/${userId}`} className="mt-2 text-xs font-semibold hover:underline">
              Open their page
            </Link>
          ) : (
            <p className="mt-2 text-xs text-gray-500">No account with this address.</p>
          )}
        </aside>
      </div>
    </MailShell>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2 border-b border-gray-100 pb-1">
    <dt className="text-gray-500">{label}</dt>
    <dd className="text-right">{value}</dd>
  </div>
);

const Message = ({ message: m }: { message: MailMessage }) => {
  const out = m.direction === "out";
  return (
    <article className={cn("max-w-[85%] rounded-md border p-3", out ? "self-end border-black bg-[#f6f9d9]" : "self-start border-gray-300 bg-white")}>
      <header className="mb-1 flex flex-wrap items-baseline gap-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-700">{out ? "You" : m.from}</span>
        <span>{dateTime(m.at)}</span>
        {m.status === "queued" ? <Chip tone="amber">sending</Chip> : null}
        {m.status === "failed" ? <Chip tone="red">failed</Chip> : null}
      </header>
      {m.status === "fetching" ? (
        <p className="text-sm text-gray-500">Fetching the message...</p>
      ) : m.text ? (
        <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
      ) : m.html ? (
        <iframe title="Message" sandbox="" srcDoc={m.html} className="h-64 w-full border-0 bg-white" />
      ) : (
        <p className="text-sm text-gray-500">(empty)</p>
      )}
    </article>
  );
};

export default Page;
