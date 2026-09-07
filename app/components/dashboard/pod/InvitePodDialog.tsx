"use client";

// The invite, as a popup off the member count.
//
// Two ways to hand it over because people share differently: the link for
// anywhere a link works, the code for anywhere it doesn't — a voice note, a
// group chat that eats URLs, a whiteboard. Both carry the same 30 characters.
//
// The seats-left line is the honest constraint, stated before someone spends
// an invite: a pod holds ten, and a full one turns people away.

import { useState, useSyncExternalStore, type FC } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Check, Copy, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePod } from "./PodProvider";
import { formatInviteCode } from "@/app/lib/dashboard/pod-invite";

/** The origin cannot change while the tab is open, so there is nothing to watch. */
const subscribeToNothing = () => () => {};

export interface InvitePodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InvitePodDialog: FC<InvitePodDialogProps> = ({ open, onOpenChange }) => {
  const { inviteCode, invitePath, capacity, memberCount, seatsLeft } = usePod();
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  // The origin is a browser fact that never changes within a session: read it
  // rather than mirroring it into state, and hand the server an empty snapshot
  // so the first paint matches.
  const origin = useSyncExternalStore(subscribeToNothing, () => window.location.origin, () => "");

  const url = origin ? invitePath(origin) : "";

  function copy(kind: "link" | "code", value: string, description: string) {
    void navigator.clipboard?.writeText(value);
    setCopied(kind);
    toast.success("Copied", { description });
  }

  const row = "flex items-center gap-2 rounded-xl border border-black/12 bg-[#fbfbf7] px-3 py-2.5";
  const copyBtn =
    "inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-black";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[15px] font-bold text-primary">Invite to your pod</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs leading-relaxed text-black/55">
                {seatsLeft > 0
                  ? `${memberCount} of ${capacity} seats taken — ${seatsLeft} ${seatsLeft === 1 ? "person" : "people"} can still join.`
                  : `This pod is full — ${capacity} of ${capacity} seats taken.`}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-3 border-t border-black/10 px-6 py-5">
            <div>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">Invite link</p>
              <div className={row}>
                <Link2 className="h-3.5 w-3.5 flex-none text-black/35" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[11px] text-black/70">{url || "…"}</span>
                <button type="button" onClick={() => copy("link", url, "The invite link is on your clipboard.")} disabled={!url} className={cn(copyBtn, !url && "opacity-50")}>
                  {copied === "link" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied === "link" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">Invite code</p>
              <div className={row}>
                <span className="min-w-0 flex-1 break-all font-mono text-[11px] font-semibold tracking-wide text-primary">
                  {formatInviteCode(inviteCode)}
                </span>
                <button type="button" onClick={() => copy("code", inviteCode, "The 30-character code is on your clipboard.")} className={copyBtn}>
                  {copied === "code" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied === "code" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-black/45">
              Anyone with this can take a seat, so send it to people you actually want in the pod. They can only use it while
              they are not already in one.
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default InvitePodDialog;
