"use client";

import { useState, type FC } from "react";
import type { IconType } from "react-icons";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaTelegram, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * "Share on" — one tile per network, then Download / Copy caption / More.
 *
 * Share strategy, per platform reality (the win card set this precedent):
 * - A phone or tablet with the Web Share API: every tile opens the native
 *   sheet with the PNG itself — a web composer there can't take an image.
 * - Desktop: the PNG downloads, the caption goes to the clipboard, and the
 *   network's composer opens, prefilled where a URL can carry text (WhatsApp,
 *   X, Telegram). LinkedIn and Facebook take only the link, so the caption is
 *   there to paste; Instagram has no web composer at all, so its tile saves the
 *   image and says to post it from the app.
 * Nothing here claims a post went out: an opened composer is "opened", and
 * only a native sheet that resolved is "shared".
 */

export interface ShareTarget {
  id: string;
  label: string;
  icon: IconType;
  /** The tile's brand fill. */
  tile: string;
  /** The desktop composer for a caption and tracked link; null when the network has none on the web. */
  url: ((caption: string, link: string) => string) | null;
  /** Said after the desktop flow, where the caption has to be pasted rather than prefilled. */
  hint: string;
}

const PREFILLED = "Image saved and caption copied — attach the image in the composer; your caption is already there.";
const PASTE = "Image saved and caption copied — paste the caption and attach the image.";

export const SHARE_TARGETS: ShareTarget[] = [
  { id: "whatsapp", label: "WhatsApp", icon: FaWhatsapp, tile: "bg-[#25d366]", url: (c) => `https://wa.me/?text=${encodeURIComponent(c)}`, hint: PREFILLED },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: FaLinkedinIn,
    tile: "bg-[#0a66c2]",
    url: (_c, link) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
    hint: PASTE,
  },
  { id: "x", label: "X", icon: FaXTwitter, tile: "bg-[#000000]", url: (c) => `https://x.com/intent/tweet?text=${encodeURIComponent(c)}`, hint: PREFILLED },
  {
    id: "facebook",
    label: "Facebook",
    icon: FaFacebookF,
    tile: "bg-[#1877f2]",
    url: (_c, link) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    hint: PASTE,
  },
  {
    id: "telegram",
    label: "Telegram",
    icon: FaTelegram,
    tile: "bg-[#229ed9]",
    url: (c, link) => `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(c)}`,
    hint: PREFILLED,
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: FaInstagram,
    tile: "bg-[linear-gradient(45deg,#f9ce34,#ee2a7b_50%,#6228d7)]",
    url: null,
    hint: "Image saved and caption copied — Instagram posts from its app, so add it there (Story size fits best).",
  },
];

export interface ShareRowProps {
  /** The PNG to share — the preview canvas's own pixels. */
  getBlob: () => Promise<Blob | null>;
  fileName: string;
  /** The caption for a network (its UTM on the link), or the plain one without an id. */
  caption: (targetId?: string) => string;
  /** The tracked link for a network. */
  link: (targetId: string) => string;
  className?: string;
}

/** Touch-first devices get the native sheet; a desktop with a share API still gets the composers, which is what the tiles promise. */
const prefersNativeSheet = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

const ShareRow: FC<ShareRowProps> = ({ getBlob, fileName, caption, link, className }) => {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function flagCopied() {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    flagCopied();
  }

  async function download() {
    const blob = await getBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** The native sheet with the image. True when it was handled (shared or declined); false to fall back. */
  async function nativeShare(text: string): Promise<boolean> {
    const blob = await getBlob();
    if (!blob || typeof navigator === "undefined" || !navigator.canShare) return false;
    const file = new File([blob], fileName, { type: "image/png" });
    if (!navigator.canShare({ files: [file] })) return false;
    try {
      await navigator.share({ files: [file], text });
      // Resolving means a target was picked — the one moment we can say it.
      toast.success("Shared");
      return true;
    } catch (error) {
      // Closing the sheet is a decision, not a failure to route around.
      if (error instanceof DOMException && error.name === "AbortError") return true;
      return false;
    }
  }

  async function shareTo(target: ShareTarget) {
    const text = caption(target.id);
    if (prefersNativeSheet() && (await nativeShare(text))) return;

    await download();
    copy(text);
    if (target.url) window.open(target.url(text, link(target.id)), "_blank", "noopener,noreferrer");
    toast.success(target.url ? `Opened ${target.label}` : "Ready for Instagram", { description: target.hint });
  }

  async function shareMore() {
    if (await nativeShare(caption("more"))) return;
    await download();
    copy(caption("more"));
    toast.success("Image saved and caption copied");
  }

  return (
    <div className={className}>
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-black/50">Share on</p>
      <div className="grid grid-cols-3 gap-x-2 gap-y-3 xs:grid-cols-6">
        {SHARE_TARGETS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => shareTo(t)}
              aria-label={`Share on ${t.label}`}
              className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-lg py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <span
                className={cn(
                  "grid h-11 w-11 place-content-center rounded-full text-white transition-transform duration-150 ease-out group-hover:-translate-y-0.5 group-active:translate-y-0",
                  t.tile,
                )}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-[11px] font-semibold text-black/70 group-hover:text-primary">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={download}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary br-shadow-press">
          <Download className="h-3.5 w-3.5" />
          Download PNG
        </button>
        <button
          type="button"
          onClick={() => copy(caption())}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy caption"}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={shareMore}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary">
            <Share2 className="h-3.5 w-3.5" />
            More
          </button>
        )}
      </div>
    </div>
  );
};

export default ShareRow;
