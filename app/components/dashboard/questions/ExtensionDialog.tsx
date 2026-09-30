"use client";

import { FC } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Loader2, PlugZap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnswers, type SavedExtensionSettings } from "@/app/components/dashboard/answers/AnswersProvider";
import { EXTENSION_URL } from "@/app/lib/extension/presence";

/**
 * Settings for the browser extension, over a status line that reports what this
 * browser actually answered (`app/lib/extension/presence`) — never a decorative
 * "Connected · Chrome", which is what it used to open on for software nobody
 * could install. The switches are real either way: they save to the account as
 * they flip (`settings.extension`), so the choice made today is the one the
 * extension follows from the first form it fills.
 *
 * Radix primitives directly, so the overlay can blur — the shared DialogContent
 * hardcodes a flat scrim and changing it there would repaint every modal in
 * the app.
 */
export interface ExtensionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TOGGLES: { key: keyof SavedExtensionSettings; label: string; hint: string }[] = [
  {
    key: "fillOnLoad",
    label: "Fill as the form loads",
    hint: "Off: nothing is typed until you press the RemoteWorldwide button on the form. On: your profile and saved answers go in as it appears. A saved draft always waits for you.",
  },
  { key: "draftNewQuestions", label: "Draft answers it hasn't seen", hint: "Write a first pass, labelled “AI answered” here so you can check it." },
  { key: "fillDemographics", label: "Fill demographic questions", hint: "Off by default. Only an answer you've saved is ever used — never a guess." },
];

/** What the status line says, in the one state the handshake is actually in. */
function statusCopy(installed: boolean, checking: boolean, version: string | null): { title: string; body: string } {
  if (installed) {
    return {
      title: version ? `Installed · v${version}` : "Installed",
      body: "Your choices below are saved to your account, and it follows them on every form it fills.",
    };
  }
  if (checking) return { title: "Checking…", body: "Looking for the extension in this browser." };
  if (EXTENSION_URL) {
    return {
      title: "Not installed",
      body: "Add it to Chrome and it will follow the choices below from the first form it fills.",
    };
  }
  return {
    title: "Not available yet",
    body: "There's no extension to install yet. Your choices below are saved to your account, and it will follow them from the first form it fills.",
  };
}

const ExtensionDialog: FC<ExtensionDialogProps> = ({ open, onOpenChange }) => {
  const { extension, extensionSaving, setExtension } = useAnswers();

  const installed = extension.connected;
  const checking = extension.status === "checking";
  const status = statusCopy(installed, checking, extension.version ?? null);
  // Only once the handshake has settled, and only when there is somewhere to
  // send people: an unset NEXT_PUBLIC_EXTENSION_URL means it is not published.
  const offerInstall = !installed && !checking && Boolean(EXTENSION_URL);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">Browser extension</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-black/50">
                It will fill application forms on company sites from this library.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* The honest status, in whichever treatment is true. Lime and solid
              only once the extension has answered this browser; otherwise dashed
              and unfilled — the "not there yet" treatment the app uses for the
              Demographics pill. "Checking…" sits between the two so the dialog
              never opens on a "Not installed" it is about to take back. */}
          <div
            className={cn(
              "mx-6 mb-5 flex items-center gap-3 rounded-xl border-[1.5px] px-4 py-3",
              installed ? "border-[#222325] bg-[#f6fbe3]" : "border-dashed border-black/20 bg-[#fbfbf7]",
            )}>
            <span
              className={cn(
                "grid h-9 w-9 flex-none place-content-center rounded-lg border",
                installed ? "border-[#222325]/15 bg-[#e1f073]" : "border-black/10 bg-white",
              )}>
              <PlugZap className={cn("h-4 w-4", installed ? "text-[#222325]" : "text-black/40")} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-primary">{status.title}</p>
              <p className="text-xs text-black/50">{status.body}</p>
            </div>
            {offerInstall && (
              <a
                href={EXTENSION_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-none cursor-pointer items-center rounded-md border-[1.5px] border-[#222325] bg-white px-2.5 py-1 text-xs font-bold text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                Get it
              </a>
            )}
          </div>

          <div className="border-t border-black/10">
            {TOGGLES.map((t) => {
              const on = extension[t.key];
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
                    onClick={() => setExtension({ [t.key]: !on })}
                    className={cn(
                      "relative inline-flex h-6 w-11 flex-none cursor-pointer items-center rounded-full border-[1.5px] border-[#222325] transition-colors",
                      on ? "bg-[#e1f073]" : "bg-white",
                    )}>
                    <span
                      className={cn(
                        "block h-4 w-4 rounded-full border-[1.5px] border-[#222325] bg-white transition-transform duration-150 ease-out",
                        on ? "translate-x-[22px]" : "translate-x-[3px]",
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 border-t border-black/10 px-6 py-4" aria-live="polite">
            {extensionSaving ? (
              <Loader2 className="h-3.5 w-3.5 flex-none animate-spin text-black/40" />
            ) : (
              <Check className="h-3.5 w-3.5 flex-none text-[#6c7a1e]" />
            )}
            <p className="text-xs text-black/50">{extensionSaving ? "Saving to your account…" : "Saved to your account."}</p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default ExtensionDialog;
