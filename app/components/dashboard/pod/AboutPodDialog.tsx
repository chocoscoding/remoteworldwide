"use client";

// "About this pod", from the pod's options menu (owner, 2026-10-13 redesign): the pod's name, which
// its owner can change here, how it was matched, and how full it is. These used to sit in a Pod
// settings card and beside the header; the redesigned page keeps them a click away instead.

import { useState, type FC } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useLivePod } from "./LivePodProvider";

export interface AboutPodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AboutPodDialog: FC<AboutPodDialogProps> = ({ open, onOpenChange }) => {
  const { overview, isOwner, renamePod, capacity, seatsLeft } = useLivePod();
  const pod = overview.pod;
  /** Null until the owner starts renaming. */
  const [draft, setDraft] = useState<string | null>(null);

  if (!pod) return null;

  function save() {
    const next = draft?.trim();
    setDraft(null);
    if (next && next !== pod?.name) renamePod(next);
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setDraft(null);
        onOpenChange(next);
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white br-bold duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[15px] font-bold text-primary">About this pod</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs leading-relaxed text-black/55">
                {pod.memberCount} of {capacity} seats taken
                {seatsLeft > 0 ? `, ${seatsLeft} open` : ", full"}.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md bg-white text-[#222325] br-shadow-press">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="border-t border-black/10 px-6 py-5">
            <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">Name</p>
            {draft !== null ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={draft}
                  maxLength={40}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save();
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setDraft(null);
                    }
                  }}
                  aria-label="Pod name"
                  className="h-9 min-w-0 flex-1 rounded-lg border-[1.5px] border-[#222325] bg-white px-3 text-sm font-semibold text-primary outline-none"
                />
                <StickerButton variant="primary" size="md" onClick={save}>
                  Save
                </StickerButton>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-bold text-primary">{pod.name}</p>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setDraft(pod.name)}
                    className="flex-none cursor-pointer text-xs font-semibold text-black/55 underline underline-offset-2 hover:text-primary">
                    Rename
                  </button>
                )}
              </div>
            )}

            <p className="mb-1.5 mt-5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">How you were matched</p>
            <p className="text-[13px] leading-relaxed text-black/65">{pod.criteria}</p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default AboutPodDialog;
