"use client";

import { FC } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, Linkedin, X } from "lucide-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useDocuments } from "@/app/components/dashboard/documents/DocumentsProvider";

/**
 * What the dead "Import from LinkedIn" button becomes. Honest about scope:
 * LinkedIn isn't connected in this build, and the dialog says so — confirming
 * adds a sample profile document so the whole flow (row treatment, source
 * badge, ATS visibility) is real even though the OAuth round-trip isn't.
 * Radix primitives directly, same recipe as ExtensionDialog: blurred ink
 * overlay, hard border + offset shadow.
 */
export interface LinkedInImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PULLS = [
  "Your profile as a PDF — saved as a resume, scoreable in the ATS",
  "Work history and titles, ready for the resume builder",
  "Skills, matched against the roles you're targeting",
];

const LinkedInImportDialog: FC<LinkedInImportDialogProps> = ({ open, onOpenChange }) => {
  const { importLinkedIn } = useDocuments();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">Import from LinkedIn</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-black/55">
                Pull your profile in once instead of retyping it.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="mx-6 mb-4 flex items-center gap-3 rounded-xl border border-black/10 bg-[#fbfbf7] px-4 py-3">
            <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#0a66c2]">
              <Linkedin className="h-4 w-4 text-white" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">What it pulls in</p>
              <p className="text-xs text-black/55">Nothing is posted to LinkedIn — this only reads.</p>
            </div>
          </div>

          <ul className="mx-6 mb-4 flex flex-col gap-1.5">
            {PULLS.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-black/60">
                <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[#cddd54]" />
                {line}
              </li>
            ))}
          </ul>

          <p className="mx-6 mb-5 rounded-lg bg-[#f0f0ea] px-3.5 py-2.5 text-xs leading-relaxed text-black/60">
            LinkedIn isn&apos;t connected in this build — importing adds a sample profile document so you can see exactly how
            it lands.
          </p>

          <div className="flex items-center gap-2.5 border-t border-black/10 px-6 py-4">
            <StickerButton
              variant="primary"
              size="md"
              onClick={() => {
                importLinkedIn();
                onOpenChange(false);
              }}>
              <Download className="h-4 w-4" />
              Import profile
            </StickerButton>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-black/55 transition-colors hover:bg-[#fdeae6] hover:text-[#b23c26]">
              Cancel
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default LinkedInImportDialog;
