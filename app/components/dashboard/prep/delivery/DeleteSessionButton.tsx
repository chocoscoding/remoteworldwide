"use client";

import { useState, type FC } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiMessage } from "@/app/lib/api/core";
import type { PrepSessionMode } from "@/app/lib/voice/types";

/**
 * Deletes a saved session after a confirm.
 *
 * The dialog says exactly what goes, because it goes for good: the service
 * purges the recording from storage and the transcript and report with it.
 * A voice session names the recording; a typed one has none to name.
 */
export interface DeleteSessionButtonProps {
  /** Deletes the session. A returned promise keeps the dialog open until it settles, and shows its failure. */
  onDelete: () => void | Promise<unknown>;
  mode?: PrepSessionMode;
  /** A delete is already in flight elsewhere. */
  deleting?: boolean;
  className?: string;
}

const DANGER_OUTLINE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#c0392b]/35 bg-white px-3.5 py-2 text-xs font-bold text-[#b23c26] cursor-pointer transition-colors hover:border-[#b23c26] hover:bg-[#fdeae6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] disabled:cursor-default disabled:opacity-50";

const DANGER_SOLID =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-[#8f3120] bg-[#b23c26] px-4 py-2.5 text-sm font-bold text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#222325] hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0";

const isThenable = (value: unknown): value is Promise<unknown> => typeof (value as Promise<unknown> | undefined)?.then === "function";

const DeleteSessionButton: FC<DeleteSessionButtonProps> = ({ onDelete, mode = "voice", deleting = false, className }) => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // A delete in flight can't be walked away from mid-way; the dialog stays
  // until it answers.
  const onOpenChange = (next: boolean) => {
    if (busy && !next) return;
    setOpen(next);
    if (next) setError(null);
  };

  const removed = mode === "voice" ? "The recording, its transcript and the report" : "The transcript and the report";

  return (
    <>
      <button type="button" onClick={() => onOpenChange(true)} disabled={deleting} className={cn(DANGER_OUTLINE, className)}>
        {deleting ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <Trash2 aria-hidden className="h-3.5 w-3.5" />}
        {deleting ? "Deleting…" : "Delete session"}
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md gap-0 overflow-hidden rounded-[20px] border-2 border-[#222325] bg-white p-0">
          <div className="px-7 pb-6 pt-7">
            <div className="mb-3 flex items-center gap-2.5">
              <Trash2 aria-hidden className="h-5 w-5 text-[#b23c26]" />
              <DialogTitle className="text-lg font-bold text-primary">Delete this session?</DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed text-black/60">
              {removed} are removed permanently. This can&apos;t be undone.
            </DialogDescription>

            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-[#c0392b]/25 bg-[#fdeae6] px-3 py-2 text-xs text-[#8f3120]">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={confirm} disabled={busy} aria-busy={busy || undefined} className={DANGER_SOLID}>
                {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={busy}
                className="cursor-pointer text-xs font-semibold text-black/45 hover:text-primary disabled:cursor-default disabled:opacity-50">
                Keep it
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeleteSessionButton;
