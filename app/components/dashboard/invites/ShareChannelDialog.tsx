"use client";

import { FC, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Check, Copy, Instagram, Linkedin, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import AutoGrowTextarea from "@/app/components/dashboard/ui/AutoGrowTextarea";

export type ShareChannelId = "whatsapp" | "instagram" | "linkedin";

/**
 * How much of a share a network will actually accept. This is the whole
 * reason the dialog exists: the three buttons look identical but behave
 * nothing alike, and sending someone to Instagram expecting a prefilled post
 * is how a share flow loses people.
 *
 * - `prefilled` — the composer opens with message AND link already typed.
 * - `link-only` — the composer takes the URL but ignores custom text, so the
 *   message goes to the clipboard for pasting.
 * - `manual`    — no web composer exists at all; everything is copied and we
 *   just open the app.
 */
type ShareMode = "prefilled" | "link-only" | "manual";

export interface ShareChannel {
  id: ShareChannelId;
  label: string;
  icon: LucideIcon;
  /** Brand tile, so the dialog is unmistakably about *this* network. */
  tile: string;
  mode: ShareMode;
  /** Stated plainly in the dialog — what this network will and won't take. */
  note: string;
  cta: string;
}

export const SHARE_CHANNELS: ShareChannel[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    tile: "bg-[#25d366]",
    mode: "prefilled",
    note: "WhatsApp takes the whole thing. Pick a chat and it is already typed out — you only press send.",
    cta: "Open WhatsApp",
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: Instagram,
    tile: "bg-[#c13584]",
    mode: "manual",
    note: "Instagram has no web composer, so nothing can be prefilled. We copy the message and link — paste them into a DM, a story sticker, or your bio.",
    cta: "Copy & open Instagram",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    tile: "bg-[#0a66c2]",
    mode: "link-only",
    note: "LinkedIn attaches the link but ignores any text sent with it. We copy your message so you can paste it straight into the post box.",
    cta: "Copy & open LinkedIn",
  },
];

export const DEFAULT_SHARE_MESSAGE =
  "I have been using Remote Worldwide to find remote work — real reviewers put you in front of companies instead of your CV landing in a pile. Worth a look:";

/** Where the button actually sends you, per network. */
function destinationFor(channel: ShareChannel, message: string, url: string): string {
  if (channel.id === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;
  if (channel.id === "linkedin") return `https://www.linkedin.com/feed/?shareActive=true&shareUrl=${encodeURIComponent(url)}`;
  return "https://www.instagram.com/";
}

export interface ShareChannelDialogProps {
  channel: ShareChannel | null;
  onOpenChange: (open: boolean) => void;
  /** Bare link, no scheme — the same string the hero shows. */
  inviteLink: string;
}

const ShareChannelDialog: FC<ShareChannelDialogProps> = ({ channel, onOpenChange, inviteLink }) => {
  const [message, setMessage] = useState(DEFAULT_SHARE_MESSAGE);
  const [copied, setCopied] = useState(false);

  if (!channel) return null;

  const url = `https://${inviteLink}`;
  const Icon = channel.icon;

  function copy(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      // Deliberately not awaited — `window.open` has to run in the same tick
      // as the click or the popup blocker eats it.
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function send() {
    if (!channel) return;
    // Anything the network won't carry goes to the clipboard instead, so the
    // user never arrives at a composer with nothing to paste.
    if (channel.mode === "manual") copy(`${message} ${url}`);
    if (channel.mode === "link-only") copy(message);
    window.open(destinationFor(channel, message, url), "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  return (
    <DialogPrimitive.Root open onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn("grid h-10 w-10 flex-none place-content-center rounded-xl", channel.tile)}>
                <Icon className="h-5 w-5 text-white" />
              </span>
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-lg font-bold leading-tight text-primary">
                  Share on {channel.label}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-0.5 text-xs text-black/60">
                  5 credits when someone you invite subscribes.
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="mx-6 mb-4 rounded-xl border border-black/10 bg-[#fbfbf7] px-4 py-3">
            <p className="text-xs leading-relaxed text-black/70">{channel.note}</p>
          </div>

          <div className="mx-6 mb-4">
            <label htmlFor="share-message" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-black/50">
              Your message
            </label>
            <AutoGrowTextarea
              id="share-message"
              minRows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-black/12 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-primary outline-none transition-colors focus:border-[#222325]"
            />
          </div>

          <div className="mx-6 mb-5">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-black/50">Your invite link</p>
            <div className="flex items-center gap-2 rounded-xl border border-black/12 bg-[#f6f6f6] px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">{inviteLink}</span>
              <button
                type="button"
                onClick={() => copy(url)}
                className="inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-black/60 transition-colors hover:bg-black/[0.06] hover:text-primary">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 border-t border-black/10 px-6 py-4">
            <StickerButton variant="primary" size="md" onClick={send}>
              {channel.cta}
              <ArrowUpRight className="h-4 w-4" />
            </StickerButton>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-black/60 transition-colors hover:bg-[#fdeae6] hover:text-[#b23c26]">
              Cancel
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default ShareChannelDialog;
