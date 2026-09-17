"use client";

// Leaving, and the two very different things that means.
//
// If anyone else is in the pod, leaving is reversible in every way that matters
// — the pod carries on and ownership passes to whoever has been there longest.
// If you are the last one in it, leaving destroys it, along with its feed, its
// goals and its invite code.
//
// The server tells us which case this is (`soleMember` on the overview), so the
// dialog can say the true thing before the click rather than after it.

import type { FC } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import EmptyStateLottie from "@/app/components/dashboard/ui/EmptyStateLottie";
import { usePod } from "./PodProvider";

export interface LeavePodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LeavePodDialog: FC<LeavePodDialogProps> = ({ open, onOpenChange }) => {
  const { leavePod, soleMember, isOwner, podName, memberCount } = usePod();

  const name = podName || "this pod";
  const others = Math.max(0, memberCount - 1);

  function confirm() {
    leavePod();
    onOpenChange(false);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[15px] font-bold text-primary">
                {soleMember ? `Delete ${name}?` : `Leave ${name}?`}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs leading-relaxed text-black/55">
                {soleMember
                  ? "You're the only one here, so leaving ends the pod."
                  : isOwner
                    ? "The pod carries on without you."
                    : "You can join or start another whenever you want."}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="border-t border-black/10 px-6 py-5">
            {soleMember ? (
              <div className="flex flex-col items-center gap-2">
                <EmptyStateLottie src="/Lottie/neobrutalism/Delete_Bin_Full_lottie.json" size={110} />
                <p className="text-center text-[13px] leading-relaxed text-black/65">
                  Its feed, its goals and its invite code go with it. This can&apos;t be undone.
                </p>
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed text-black/65">
                {isOwner
                  ? `${name} passes to whoever has been there longest, and the other ${others === 1 ? "member keeps" : `${others} members keep`} everything as it is.`
                  : "Your streak and your board are yours — they stay with you."}
              </p>
            )}

            <p className="mt-3 text-[11px] leading-relaxed text-black/45">
              Leaving too often pauses your next join, so a pod is worth staying in.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <StickerButton variant="outline" size="md" onClick={() => onOpenChange(false)}>
                Stay
              </StickerButton>
              {/* There is no danger variant in the kit, so the destructive case is the primary
                  sticker recoloured — same press behaviour, unmistakably different button. */}
              <StickerButton
                variant="primary"
                size="md"
                onClick={confirm}
                className={soleMember ? "bg-[#b23c26] text-white" : undefined}>
                {soleMember ? "Delete this pod" : "Leave this pod"}
              </StickerButton>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default LeavePodDialog;
