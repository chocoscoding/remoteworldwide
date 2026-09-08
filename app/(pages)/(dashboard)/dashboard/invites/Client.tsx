"use client";

import { FC, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Share2, UserPlus } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import SplitButton from "@/app/components/dashboard/ui/SplitButton";
import DashPagination, { type PageSize } from "@/app/components/dashboard/ui/DashPagination";
import Pill from "@/app/components/dashboard/ui/Pill";
import type { PillProps } from "@/app/components/dashboard/ui/Pill";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import ShareChannelDialog, {
  SHARE_CHANNELS,
  type ShareChannel,
} from "@/app/components/dashboard/invites/ShareChannelDialog";
import type { InviteOverview, InviteRow } from "@/app/lib/invites/types";

const DAY = 86_400_000;

/** "3 weeks ago" — the only thing anyone reads one of these dates for. */
function since(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "last month" : `${months} months ago`;
}

const statusMeta = (
  row: InviteRow,
  perSubscriber: number
): { label: string; variant: NonNullable<PillProps["variant"]> } =>
  row.status === "subscribed"
    ? { label: `+${perSubscriber} credits`, variant: "positive" }
    : { label: "Not yet", variant: "outline-dashed" };

const rowMeta = (row: InviteRow): string =>
  row.status === "subscribed" && row.subscribedAt
    ? `Subscribed ${since(row.subscribedAt)}`
    : `Joined ${since(row.joinedAt)}`;

export interface InvitesClientProps {
  invites: InviteOverview;
  /** Built server-side so the copied link works off whatever device shares it. */
  inviteUrl: string;
}

const InvitesClient: FC<InvitesClientProps> = ({ invites, inviteUrl }) => {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState<ShareChannel | null>(null);

  const display = inviteUrl.replace(/^https?:\/\/(www\.)?/, "");

  const handleCopy = () => {
    setCopied(true);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl).catch(() => {});
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  // Paging is a navigation, not a state change: the server holds the list, so
  // a page of it can be linked and refreshed like any other URL.
  const goTo = (page: number, pageSize: number) => router.push(`/dashboard/invites?page=${page}&pageSize=${pageSize}`);

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <h1 className="whitespace-nowrap text-[17px] font-bold text-primary">Invite friends</h1>
      </header>

      <main className="mx-auto flex max-w-[820px] flex-col gap-5 px-8 py-7 pb-14">
        {/* Lime hero — personal invite link */}
        {/* Not `overflow-hidden` on the card itself: that clipped the share
            menu, which has to escape the hero. Only the blur is clipped. */}
        <div className="relative rounded-[18px] bg-secondary p-7 text-primary">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/40 blur-3xl" />
          </div>

          <div className="relative">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-primary/60">Your invite link</p>
            <p className="mb-6 max-w-[560px] text-[15px] font-semibold leading-relaxed text-primary/80">
              Share your link and earn {invites.creditsPerSubscriber} credits every time someone who joins on it
              subscribes — the only way credits are earned on Remote Worldwide.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[240px] flex-1 rounded-lg border border-black/10 bg-white/70 px-4 py-3">
                <span className="block truncate text-sm font-semibold text-primary">{display}</span>
              </div>
              {/* Copying is what people do most, so it keeps the click; the
                  networks live behind the chevron. White shadow because a lime
                  one disappears on this card. */}
              <SplitButton
                label={copied ? "Copied ✓" : "Share link"}
                icon={copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                shadowColor="#ffffff"
                onClick={handleCopy}
                items={[
                  { id: "copy", label: "Copy link", icon: <Copy className="h-3.5 w-3.5" />, onSelect: handleCopy },
                  ...SHARE_CHANNELS.map((c) => {
                    const Icon = c.icon;
                    return {
                      id: c.id,
                      label: `Share on ${c.label}`,
                      icon: <Icon className="h-3.5 w-3.5" />,
                      onSelect: () => setChannel(c),
                    };
                  }),
                ]}
              />
            </div>
          </div>
        </div>

        {/* People you invited */}
        <DashCard className="p-6">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-[15px] font-bold text-primary">People you invited</p>
            {/* Referral credits are this page's own story — the gifts modal
                deliberately knows nothing about them. */}
            <span className="inline-flex flex-none items-baseline gap-1.5 rounded-lg bg-[#f0f0ea] px-2 py-1">
              <span className="text-[17px] font-bold tabular-nums text-[#6c7a1e]">{invites.creditsEarned}</span>
              <span className="text-xs font-semibold text-black/60">credits earned</span>
            </span>
          </div>
          <p className="mb-5 text-xs text-black/60">
            {invites.subscribed} of {invites.total} have subscribed.
          </p>

          {invites.total === 0 ? (
            <DashEmptyState
              bare
              icon={UserPlus}
              title="Nobody has used your link yet"
              body="Send it to one person who is job hunting right now. They appear here the moment they sign up, and pay out when they subscribe."
              ctaLabel="Copy your link"
              onCta={handleCopy}
            />
          ) : (
            <>
              <div className="flex flex-col divide-y divide-black/8">
                {invites.rows.map((row) => {
                  const meta = statusMeta(row, invites.creditsPerSubscriber);
                  return (
                    <div key={row.id} className="flex items-center gap-3 py-3.5 first:pt-0">
                      <Avatar name={row.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-primary">{row.name}</p>
                        <p className="truncate text-xs text-black/60">{rowMeta(row)}</p>
                      </div>
                      <Pill variant={meta.variant} className="flex-none">
                        {meta.label}
                      </Pill>
                    </div>
                  );
                })}
              </div>

              <DashPagination
                className="mt-5 border-t border-black/8 pt-4"
                page={invites.page}
                totalPages={invites.totalPages}
                pageSize={invites.pageSize}
                totalItems={invites.total}
                itemNoun="people"
                onPageChange={(page) => goTo(page, invites.pageSize)}
                onPageSizeChange={(size: PageSize) => goTo(1, size)}
              />
            </>
          )}
        </DashCard>
      </main>

      <ShareChannelDialog channel={channel} onOpenChange={(open) => !open && setChannel(null)} inviteLink={display} />
    </div>
  );
};

export default InvitesClient;
