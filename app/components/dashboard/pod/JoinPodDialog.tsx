"use client";

// Joining someone's pod.
//
// The field takes the code or the whole link, because people paste whichever
// they were sent and correcting them is not a feature. Everything else is the
// refusal: a pod that is full, a code that is not a code, and the one rule
// that matters — you cannot take a second pod while you are in one.

import { useState, type FC } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { KeyRound, X } from "lucide-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { usePod } from "./PodProvider";
import { JOIN_REFUSAL } from "@/app/lib/dashboard/pod-invite";

export interface JoinPodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const JoinPodDialog: FC<JoinPodDialogProps> = ({ open, onOpenChange }) => {
  const { joinWithCode } = usePod();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const result = joinWithCode(value);
    if (result !== "joined") {
      setError(JOIN_REFUSAL[result]);
      return;
    }
    setError(null);
    setValue("");
    onOpenChange(false);
    toast.success("You're in", { description: "Say hello on What's moving — a pod notices a new name." });
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[15px] font-bold text-primary">Join with an invite</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs leading-relaxed text-black/55">
                Paste the code someone sent you, or the whole link.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="border-t border-black/10 px-6 py-5">
            <label htmlFor="pod-invite" className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">
              Invite code or link
            </label>
            <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-black/15 bg-white px-3 py-2 focus-within:border-[#222325]">
              <KeyRound className="h-3.5 w-3.5 flex-none text-black/35" aria-hidden />
              <input
                id="pod-invite"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="RWW-XXXXXX-XXXXXX…  or  https://…/dashboard/pod?join=…"
                className="min-w-0 flex-1 bg-transparent font-mono text-xs text-primary outline-none placeholder:font-sans placeholder:text-black/30"
              />
            </div>

            {error && <p className="mt-2 text-[11px] font-semibold leading-relaxed text-[#b23c26]">{error}</p>}

            <div className="mt-4 flex justify-end">
              <StickerButton variant="primary" size="md" onClick={submit} disabled={!value.trim()}>
                Join this pod
              </StickerButton>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default JoinPodDialog;
