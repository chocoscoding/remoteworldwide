"use client";

import { useId, useRef, useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { apiMessage } from "@/app/lib/api/core";
import type { PrepSessionMode } from "@/app/lib/voice/types";

/**
 * "Delete this session": a quiet red link, and a small confirm beside it.
 *
 * The confirm says exactly what goes, because it goes for good: the service
 * purges the recording from storage and the transcript and feedback with it.
 * A voice session names the recording; a typed one has none to name. "No" is
 * focused when it opens, so a stray Enter keeps the session.
 */
export interface DeleteSessionButtonProps {
  /** Deletes the session. A returned promise keeps the confirm open until it settles, and shows its failure. */
  onDelete: () => void | Promise<unknown>;
  mode?: PrepSessionMode;
  /** A delete is already in flight elsewhere. */
  deleting?: boolean;
  className?: string;
}

const isThenable = (value: unknown): value is Promise<unknown> => typeof (value as Promise<unknown> | undefined)?.then === "function";

const CONFIRM_BUTTON =
  "inline-flex h-[34px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] px-4 text-[13px] font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60";

const DeleteSessionButton: FC<DeleteSessionButtonProps> = ({ onDelete, mode = "voice", deleting = false, className }) => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const busy = pending || deleting;

  const confirm = () => {
    if (busy) return;
    setError(null);
    const result = onDelete();
    if (!isThenable(result)) {
      setOpen(false);
      return;
    }
    setPending(true);
    result.then(
      () => {
        setPending(false);
        setOpen(false);
      },
      (reason: unknown) => {
        setPending(false);
        setError(apiMessage(reason));
      }
    );
  };

  // A delete in flight can't be walked away from mid-way; the confirm stays
  // until it answers.
  const onOpenChange = (next: boolean) => {
    if (busy && !next) return;
    setOpen(next);
    if (next) setError(null);
  };

  const goes = mode === "voice" ? "The recording, transcript and feedback go with it." : "The transcript and feedback go with it.";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={deleting}
          className={cn(
            "inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded text-xs font-bold text-[#8a2a17] underline decoration-[#8a2a17] underline-offset-[3px] hover:text-[#b23c26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] disabled:cursor-default disabled:opacity-60",
            className
          )}>
          {deleting && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
          {deleting ? "Deleting…" : "Delete this session"}
        </button>
      </PopoverTrigger>
      {/* The content is bare and the card inside carries the outline and hard
          shadow: the popover's own soft shadow would sit over a br-* one. */}
      <PopoverContent
        align="start"
        sideOffset={8}
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          noRef.current?.focus();
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault();
        }}
        className="w-[min(352px,calc(100vw-32px))] border-0 bg-transparent p-0 shadow-none">
        <div className="flex flex-col gap-2.5 rounded-xl bg-white px-4 py-3.5 text-[#222325] br-bold">
          <div className="flex flex-col">
            <p id={titleId} className="text-sm font-extrabold">
              Delete this session?
            </p>
            <p id={bodyId} className="text-xs leading-relaxed text-[#55564f]">
              {goes} This can&apos;t be undone.
            </p>
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-[#c0392b]/25 bg-[#fdeae6] px-3 py-2 text-xs text-[#8f3120]">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={confirm} disabled={busy} aria-busy={busy || undefined} className={cn(CONFIRM_BUTTON, "bg-[#b23c26] text-white hover:bg-[#9c321f]")}>
              {busy && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
              {busy ? "Deleting…" : "Yes"}
            </button>
            <button ref={noRef} type="button" onClick={() => onOpenChange(false)} disabled={busy} className={cn(CONFIRM_BUTTON, "bg-white text-[#222325] hover:bg-[#f6f6f6]")}>
              No
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DeleteSessionButton;
