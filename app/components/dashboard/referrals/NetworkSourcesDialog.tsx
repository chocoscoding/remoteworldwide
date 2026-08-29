"use client";

import { FC } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Linkedin, Mail, Upload, X } from "lucide-react";

/**
 * Replaces the dead "Add a network" button and the decorative
 * "Connected: LinkedIn, Gmail" pill, both of which claimed a sync that never
 * existed. Says plainly what this build does and doesn't do.
 */
export interface NetworkSourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SOURCES: { icon: typeof Linkedin; name: string; body: string }[] = [
  { icon: Linkedin, name: "LinkedIn", body: "Your connections, their companies, and who you share a mutual with." },
  { icon: Mail, name: "Gmail", body: "People you've actually corresponded with — the warmest signal there is." },
  { icon: Upload, name: "Upload a CSV", body: "Export from anywhere else and bring the columns we recognise." },
];

const NetworkSourcesDialog: FC<NetworkSourcesDialogProps> = ({ open, onOpenChange }) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
          <div>
            <DialogPrimitive.Title className="text-lg font-bold text-primary">Where your contacts come from</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-black/55">
              The more we can see, the more warm paths we can find.
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            <X className="h-3.5 w-3.5" strokeWidth={3} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>

        <div className="border-t border-black/10">
          {SOURCES.map((s) => (
            <div key={s.name} className="flex items-start gap-3 border-b border-black/8 px-6 py-3.5 last:border-b-0">
              <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
                <s.icon className="h-4 w-4 text-black/55" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">{s.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-black/55">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mx-6 my-5 rounded-lg bg-[#f0f0ea] px-3.5 py-2.5 text-xs leading-relaxed text-black/60">
          None of these are connected in this build — the contacts you see are sample data. Connecting a real source is what
          turns this list into your actual network.
        </p>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

export default NetworkSourcesDialog;
