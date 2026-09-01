"use client";

import { FC, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import SplitButton from "@/app/components/dashboard/ui/SplitButton";
import DashPagination, { type PageSize } from "@/app/components/dashboard/ui/DashPagination";
import Pill from "@/app/components/dashboard/ui/Pill";
import type { PillProps } from "@/app/components/dashboard/ui/Pill";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import ShareChannelDialog, {
  SHARE_CHANNELS,
  type ShareChannel,
} from "@/app/components/dashboard/invites/ShareChannelDialog";
import { INVITES } from "@/app/lib/dashboard/mock-data";
import { CREDITS_PER_SUBSCRIBER, INVITE_CREDITS_EARNED, SUBSCRIBED_INVITES } from "@/app/lib/dashboard/invites";
import type { InviteRow } from "@/app/lib/dashboard/types";

const STATUS_META: Record<InviteRow["status"], { label: string; variant: NonNullable<PillProps["variant"]> }> = {
  subscribed: { label: `+${CREDITS_PER_SUBSCRIBER} credits`, variant: "positive" },
  joined: { label: "Joined", variant: "neutral" },
  invited: { label: "Not yet", variant: "outline-dashed" },
};

const INVITE_LINK = "remoteworldwide.net/j/amara";

const InvitesClient: FC = () => {
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState<ShareChannel | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  const totalPages = Math.max(1, Math.ceil(INVITES.length / pageSize));
  // Clamped rather than stored — shrinking the page size can strand `page`
  // past the end, and a corrective setState in render is what the compiler
  // rules (and the user) rightly object to.
  const currentPage = Math.min(page, totalPages);
  const visible = INVITES.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCopy = () => {
    setCopied(true);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`https://${INVITE_LINK}`).catch(() => {});
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  function changePageSize(size: PageSize) {
    setPageSize(size);
    setPage(1);
  }

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
              Share your link and earn {CREDITS_PER_SUBSCRIBER} credits every time someone who joins on it subscribes —
              the only way credits are earned on Remote Worldwide.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[240px] flex-1 rounded-lg border border-black/10 bg-white/70 px-4 py-3">
                <span className="block truncate text-sm font-semibold text-primary">{INVITE_LINK}</span>
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
              <span className="text-[17px] font-bold tabular-nums text-[#6c7a1e]">{INVITE_CREDITS_EARNED}</span>
              <span className="text-xs font-semibold text-black/60">credits earned</span>
            </span>
          </div>
          <p className="mb-5 text-xs text-black/60">
            {SUBSCRIBED_INVITES.length} of {INVITES.length} have subscribed.
          </p>

          <div className="flex flex-col divide-y divide-black/8">
            {visible.map((row) => {
              const meta = STATUS_META[row.status];
              return (
                <div key={row.name} className="flex items-center gap-3 py-3.5 first:pt-0">
                  <Avatar name={row.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-primary">{row.name}</p>
                    <p className="truncate text-xs text-black/60">{row.meta}</p>
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
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={INVITES.length}
            itemNoun="people"
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
          />
        </DashCard>
      </main>

      <ShareChannelDialog channel={channel} onOpenChange={(open) => !open && setChannel(null)} inviteLink={INVITE_LINK} />
    </div>
  );
};

export default InvitesClient;
