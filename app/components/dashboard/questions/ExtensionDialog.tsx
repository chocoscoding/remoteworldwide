"use client";

import { FC } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, PlugZap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnswers, type ExtensionSettings } from "@/app/components/dashboard/answers/AnswersProvider";

/**
 * What the "Extension connected" chip used to only claim. Radix primitives
 * directly, so the overlay can blur — the shared DialogContent hardcodes a
 * flat scrim and changing it there would repaint every modal in the app.
 */
export interface ExtensionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TOGGLES: { key: keyof ExtensionSettings; label: string; hint: string }[] = [
  { key: "autoFill", label: "Fill questions it recognises", hint: "Matches a saved answer and fills it as the form loads." },
  { key: "draftNewQuestions", label: "Draft answers it hasn't seen", hint: "Writes a first pass and flags it for your review — never sends it unread." },
  { key: "fillDemographics", label: "Fill demographic questions", hint: "Off by default. These stay blank unless you say otherwise." },
];

const ExtensionDialog: FC<ExtensionDialogProps> = ({ open, onOpenChange }) => {
  const { extension, setExtension } = useAnswers();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">Browser extension</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-black/50">
                It fills application forms on company sites from this library.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="mx-6 mb-5 flex items-center gap-3 rounded-xl border border-black/10 bg-[#fbfbf7] px-4 py-3">
            <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#e1f073]">
              <PlugZap className="h-4 w-4 text-[#222325]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">Connected · Chrome</p>
              <p className="text-xs text-black/45">Recognises questions across 200+ applicant-tracking platforms.</p>
            </div>
          </div>

          <div className="border-t border-black/10">
            {TOGGLES.map((t) => {
              const on = extension[t.key] as boolean;
              return (
                <div key={t.key} className="flex items-center justify-between gap-5 border-b border-black/8 px-6 py-3.5 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary">{t.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-black/45">{t.hint}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={t.label}
                    onClick={() => setExtension({ [t.key]: !on } as Partial<ExtensionSettings>)}
                    className={cn(
                      "relative inline-flex h-6 w-11 flex-none cursor-pointer items-center rounded-full border-[1.5px] border-[#222325] transition-colors",
                      on ? "bg-[#e1f073]" : "bg-white"
                    )}>
                    <span
                      className={cn(
                        "block h-4 w-4 rounded-full border-[1.5px] border-[#222325] bg-white transition-transform duration-150 ease-out",
                        on ? "translate-x-[22px]" : "translate-x-[3px]"
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 border-t border-black/10 px-6 py-4">
            <Check className="h-3.5 w-3.5 flex-none text-[#6c7a1e]" />
            <p className="text-xs text-black/50">Changes apply to your next application. Nothing is sent without your review.</p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default ExtensionDialog;
