"use client";

import { FC, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Confetti from "react-confetti";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { Check, Download, Linkedin, MessageCircle, Send, Twitter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CARD_DIMENSIONS,
  DEFAULT_TOGGLES,
  winCaption,
  type WinCardFormat,
  type WinCardToggles,
  type WinRecord,
} from "@/app/lib/dashboard/win";
import { paintWinCard } from "./win-card-render";

/**
 * The celebration popup: confetti, the card, the share row. The preview IS
 * the artifact — one canvas, drawn client-side, and Download/share hand out
 * that same canvas's pixels. Toggles and the size picker just redraw it.
 *
 * Share strategy, per platform reality (the invites dialog set this
 * precedent — say what each network will actually take):
 * - Mobile with the Web Share API: the native sheet gets the PNG itself.
 * - Desktop: the PNG downloads, the caption goes to the clipboard, and the
 *   platform opens — prefilled where a URL can carry text (WhatsApp,
 *   Telegram, X), paste-it-yourself on LinkedIn, which accepts neither.
 */
export interface WinCelebrationDialogProps {
  win: WinRecord;
  /** "Amara Okafor" — the card carries the profile name, not an input. */
  ownerName: string;
  onClose: () => void;
}

// System palette for the react-confetti burst — one full-screen volley on
// mount (`recycle={false}`), because this dialog only mounts at the moment
// worth celebrating.
const CONFETTI_COLORS = ["#e1f073", "#cddd54", "#f0c86a", "#222325"];

interface ShareTarget {
  id: string;
  label: string;
  icon: LucideIcon;
  tile: string;
  /** Builds the URL a desktop share opens; null means download + caption only. */
  url: (caption: string) => string | null;
}

const SHARE_TARGETS: ShareTarget[] = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, tile: "bg-[#25d366]", url: (c) => `https://wa.me/?text=${encodeURIComponent(c)}` },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, tile: "bg-[#0a66c2]", url: () => "https://www.linkedin.com/feed/?shareActive=true" },
  { id: "telegram", label: "Telegram", icon: Send, tile: "bg-[#229ed9]", url: (c) => `https://t.me/share/url?url=${encodeURIComponent("https://remoteworldwide.net/j/amara")}&text=${encodeURIComponent(c)}` },
  { id: "x", label: "X", icon: Twitter, tile: "bg-[#222325]", url: (c) => `https://x.com/intent/tweet?text=${encodeURIComponent(c)}` },
];

const TOGGLE_DEFS: { key: keyof WinCardToggles; onLabel: string; offLabel: string }[] = [
  { key: "hideSalary", onLabel: "Salary hidden", offLabel: "Salary shown" },
  { key: "hideCompany", onLabel: "Company hidden", offLabel: "Company shown" },
  { key: "firstNameOnly", onLabel: "First name only", offLabel: "Full name" },
];

const WinCelebrationDialog: FC<WinCelebrationDialogProps> = ({ win, ownerName, onClose }) => {
  // Measured once at mount — the dialog only ever mounts client-side, on the
  // user's own action, so window is safe to read in a lazy initializer.
  const [viewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [format, setFormat] = useState<WinCardFormat>("landscape");
  const [toggles, setToggles] = useState<WinCardToggles>(DEFAULT_TOGGLES);
  const [copied, setCopied] = useState(false);

  // First paint happens in the ref callback below — the canvas sits inside
  // Radix's portal, which mounts after this component's effects, so a mount
  // effect sees a null ref. This effect only handles prop-driven redraws.
  useEffect(() => {
    const el = canvasRef.current;
    if (el) paintWinCard(el, () => canvasRef.current, { win, toggles, format, ownerName });
  }, [win, toggles, format, ownerName]);

  const caption = winCaption(win, toggles);

  function cardBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob((b) => resolve(b), "image/png");
    });
  }

  async function download() {
    const blob = await cardBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `win-card-${format}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyCaption() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(caption).catch(() => {});
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function shareTo(target: ShareTarget) {
    const blob = await cardBlob();
    // The shared caption carries per-platform UTM on the referral link; the
    // on-screen preview stays clean.
    const platformCaption = winCaption(win, toggles, target.id);

    // Mobile-first: the native sheet takes the actual image.
    if (blob && typeof navigator !== "undefined" && navigator.canShare) {
      const file = new File([blob], `win-card-${format}.png`, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: platformCaption });
          return;
        } catch {
          // Cancelled or unsupported combination — fall through to desktop.
        }
      }
    }

    // Desktop: save the image, copy the caption, open the composer.
    await download();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(platformCaption).catch(() => {});
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
    const url = target.url(platformCaption);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    toast.success(`Image saved + caption copied`, {
      description:
        target.id === "linkedin"
          ? "LinkedIn takes neither from a link — paste the caption and attach the image."
          : "Attach the saved image in the composer; your caption is already there.",
    });
  }

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* One full-screen confetti volley over everything, then done. */}
          <Confetti
            width={viewport.width}
            height={viewport.height}
            numberOfPieces={260}
            recycle={false}
            gravity={0.22}
            colors={CONFETTI_COLORS}
            className="pointer-events-none !fixed inset-0 z-[60]"
          />

          <div className="flex flex-none items-start justify-between gap-4 px-6 pb-3 pt-6">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">
                You did it. Now tell people.
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-black/60">
                Your card carries the whole road — saved, applied, interviewed, offer.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="z-20 inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-neo px-6">
            {/* The card itself — this canvas is the PNG. */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.15 }}
              className={cn("mx-auto", format === "landscape" ? "w-full" : format === "square" ? "max-w-[320px]" : "max-w-[230px]")}>
              <canvas
                ref={(el) => {
                  canvasRef.current = el;
                  if (el) paintWinCard(el, () => canvasRef.current, { win, toggles, format, ownerName });
                }}
                className="h-auto w-full rounded-lg border border-black/15"
              />
            </motion.div>

            {/* Size picker */}
            <div className="mt-4 inline-flex items-center gap-1 rounded-lg border border-black/15 bg-[#f0f0ea] p-1">
              {(Object.keys(CARD_DIMENSIONS) as WinCardFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    "cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    format === f ? "bg-[#222325] text-white" : "text-black/60 hover:text-primary"
                  )}>
                  {CARD_DIMENSIONS[f].label}
                  <span className={cn("ml-1.5 text-[10px] font-medium", format === f ? "text-white/60" : "text-black/40")}>
                    {CARD_DIMENSIONS[f].hint}
                  </span>
                </button>
              ))}
            </div>

            {/* Privacy toggles — each one just redraws the canvas. */}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {TOGGLE_DEFS.map((t) => {
                const on = toggles[t.key];
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setToggles((prev) => ({ ...prev, [t.key]: !prev[t.key] }))}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      on ? "border-[#222325] bg-[#222325] text-white" : "border-black/20 bg-white text-black/60 hover:border-black/40"
                    )}>
                    {on && <Check className="h-3 w-3" />}
                    {on ? t.onLabel : t.offLabel}
                  </button>
                );
              })}
            </div>

            {/* Caption preview — what gets copied/prefilled. */}
            <div className="mt-4 rounded-xl border border-black/10 bg-[#fbfbf7] px-4 py-3">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-black/50">Your caption</p>
                <button
                  type="button"
                  onClick={copyCaption}
                  className="cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-semibold text-black/60 transition-colors hover:bg-black/[0.06] hover:text-primary">
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <p className="text-xs leading-relaxed text-black/70">{caption}</p>
            </div>
          </div>

          {/* Share row — WhatsApp and Telegram lead; that's where this audience shares. */}
          <div className="flex flex-none flex-wrap items-center gap-2 border-t border-black/10 px-6 py-4">
            {SHARE_TARGETS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => shareTo(t)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-black/12 bg-white px-3 py-2 transition-colors hover:border-[#222325]">
                  <span className={cn("grid h-5 w-5 flex-none place-content-center rounded", t.tile)}>
                    <Icon className="h-3 w-3 text-white" />
                  </span>
                  <span className="text-xs font-semibold text-primary">{t.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={download}
              className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] bg-white px-3 py-2 text-xs font-bold text-primary shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <Download className="h-3.5 w-3.5" />
              Download PNG
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default WinCelebrationDialog;
