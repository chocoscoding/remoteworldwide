import Link from "next/link";
import { listThreads } from "@/libs/mail-admin";
import type { ThreadStatus } from "@/app/lib/mail/types";
import MailShell from "@/app/components/mail/MailShell";
import { Chip, Empty, ErrorBox } from "@/app/components/mail/ui";
import { dateTime, n } from "@/app/components/mail/format";
import { cn } from "@/lib/utils";

// Replies to our mails and feedback comments, unread first. A thread opens beside the person's card.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach inbox", robots: { index: false, follow: false } };

const Page = async ({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) => {
  const params = await searchParams;
  const status: ThreadStatus = params.status === "done" ? "done" : "open";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const res = await listThreads({ status, page });
  const threads = [...(res.data?.items ?? [])].sort(
    (a, b) => Number(b.unread) - Number(a.unread) || new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
  const pages = res.data?.pages ?? 1;
  const href = (next: { status?: ThreadStatus; page?: number }) => {
    const search = new URLSearchParams({ status: next.status ?? status });
    if ((next.page ?? 1) > 1) search.set("page", String(next.page));
    return `/heroshima/outreach/inbox?${search.toString()}`;
  };

  return (
    <MailShell
      title="Inbox"
      description="Replies to our mails. Answers go out from the founder address."
      actions={
        <nav aria-label="Status" className="flex gap-1.5">
          {(["open", "done"] as const).map((s) => (
            <Link
              key={s}
              href={href({ status: s })}
              aria-current={s === status ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold ${s === status ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
              {s === "open" ? "Open" : "Done"}
            </Link>
          ))}
        </nav>
      }>
      {res.error ? (
        <ErrorBox>The inbox couldn&apos;t be loaded: {res.error}</ErrorBox>
      ) : !threads.length ? (
        <Empty>{status === "open" ? "Nothing open. Replies land here." : "Nothing marked done yet."}</Empty>
      ) : (
        <>
          <ul className="overflow-hidden rounded-md border border-gray-300 bg-white">
            {threads.map((t) => (
              <li key={t.id} className="border-t border-gray-200 first:border-t-0">
                <Link href={`/heroshima/outreach/inbox/${t.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                  <span aria-label={t.unread ? "Unread" : undefined} className={cn("mt-1.5 h-2 w-2 flex-none rounded-full", t.unread ? "bg-black" : "bg-transparent")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className={cn("truncate text-sm", t.unread ? "font-bold" : "font-semibold text-gray-700")}>{t.name || t.email}</span>
                      {t.name ? <span className="truncate text-xs text-gray-500">{t.email}</span> : null}
                      {t.tags?.map((tag) => (
                        <Chip key={tag} tone="outline">
                          {tag}
                        </Chip>
                      ))}
                    </span>
                    <span className={cn("block truncate text-sm", t.unread ? "text-black" : "text-gray-600")}>{t.subject || "(no subject)"}</span>
                    {t.snippet ? <span className="block truncate text-xs text-gray-500">{t.snippet}</span> : null}
                  </span>
                  <span className="flex-none whitespace-nowrap text-xs text-gray-500">{dateTime(t.lastMessageAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-sm">
            {page > 1 ? (
              <Link href={href({ page: page - 1 })} className="font-semibold hover:underline">
                Previous
              </Link>
            ) : null}
            <span className="text-gray-500">
              Page {page} of {pages} · {n(res.data?.total)} threads
            </span>
            {page < pages ? (
              <Link href={href({ page: page + 1 })} className="font-semibold hover:underline">
                Next
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </MailShell>
  );
};

export default Page;
