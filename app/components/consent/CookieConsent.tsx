"use client";

// The cookie choice: a compact card bottom-left until someone decides, and a small settings dialog
// that the card's "Settings" and the footer's "Cookie settings" both open.
//
// Two kinds of cookie, and only one needs asking about: strictly necessary ones (signing in, form
// protection, this choice itself) are always on; analytics (Google Analytics) stays off until
// someone accepts. The choice lives in `app/lib/consent/consent.ts`, which `ConsentScripts` reads to
// load GA, so the card needs nothing but `saveConsent`.
//
// Nothing renders until the browser's choice is known (the server never knows it), so someone who
// already decided never sees the card flash. Never on /print/*: those pages are paper.
// z-40: above the page and its back-to-top button, below every dialog (z-50). Bottom-left, so the
// extension's floating button (bottom-right) stays clear on a desktop; on a phone the card spans
// the width, and "Settings" sits beside Reject rather than in the corner.

import { useEffect, useId, useState, type FC } from "react";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUpRight, X } from "lucide-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { Toggle } from "@/app/components/dashboard/settings/settings-ui";
import { onOpenConsentSettings, saveConsent, useConsent } from "@/app/lib/consent/consent";

const PRIVACY_HREF = "/privacy-policy#cookies";

const CookieConsent: FC = () => {
  const pathname = usePathname() ?? "";
  const consent = useConsent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** The settings dialog's switch, saved only on Save. */
  const [analytics, setAnalytics] = useState(false);
  const titleId = useId();

  const current = consent?.analytics ?? false;
  useEffect(
    () =>
      onOpenConsentSettings(() => {
        setAnalytics(current);
        setSettingsOpen(true);
      }),
    [current],
  );

  if (pathname.startsWith("/print/")) return null;

  const openSettings = () => {
    setAnalytics(current);
    setSettingsOpen(true);
  };

  const save = (choice: boolean) => {
    saveConsent({ analytics: choice });
    setSettingsOpen(false);
  };

  // undefined: not known yet (server render, hydration). Decided: only the dialog can show. The card
  // stays under an open dialog, so closing it hands focus back to "Settings".
  const showCard = consent === null;

  return (
    <>
      {showCard && (
        <section
          role="region"
          aria-labelledby={titleId}
          className="fixed bottom-4 left-4 right-4 z-40 rounded-xl border-[1.5px] bg-white p-4 text-[#222325] br-shadow sm:right-auto sm:w-[360px]">
          <h2 id={titleId} className="sr-only">
            Cookies
          </h2>
          <p className="text-[13px] leading-relaxed">
            We use analytics cookies to improve the site.{" "}
            <a
              href={PRIVACY_HREF}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-0.5 whitespace-nowrap font-bold underline decoration-black/30 underline-offset-2 hover:decoration-[#222325]">
              Privacy
              <ArrowUpRight className="h-3 w-3" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StickerButton variant="primary" size="sm" onClick={() => save(true)}>
              Accept
            </StickerButton>
            <StickerButton variant="outline" size="sm" onClick={() => save(false)}>
              Reject
            </StickerButton>
            <button
              type="button"
              onClick={openSettings}
              className="cursor-pointer rounded px-1 text-xs font-semibold sm:ml-auto text-black/60 underline decoration-black/25 underline-offset-2 hover:text-[#222325] hover:decoration-[#222325] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]">
              Settings
            </button>
          </div>
        </section>
      )}

      <DialogPrimitive.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white text-[#222325] br-bold duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-[15px] font-bold text-primary">Cookie settings</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-0.5 text-xs leading-relaxed text-black/55">
                  Change this any time from &quot;Cookie settings&quot; at the bottom of the site.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md bg-white text-[#222325] br-shadow-press">
                <X className="h-3.5 w-3.5" strokeWidth={3} />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            <div className="border-t border-black/10 px-6">
              <div className="flex items-start justify-between gap-6 border-b border-black/8 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">Strictly necessary</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-black/50">
                    Keep you signed in, protect forms and remember this choice. The site can&apos;t work without them.
                  </p>
                </div>
                <span className="mt-0.5 flex-none rounded-full bg-[#f0f0ea] px-2.5 py-1 text-[11px] font-bold text-black/60">Always on</span>
              </div>
              <div className="flex items-start justify-between gap-6 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary">Analytics</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-black/50">
                    Google Analytics counts visits and pages so we can see what helps. Off unless you turn it on.
                  </p>
                </div>
                <Toggle checked={analytics} onChange={setAnalytics} label="Analytics cookies" className="mt-0.5" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-black/10 px-6 py-4">
              <a href={PRIVACY_HREF} target="_blank" rel="noopener" className="text-xs font-semibold text-black/55 underline underline-offset-2 hover:text-primary">
                Privacy policy
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <StickerButton variant="primary" size="md" onClick={() => save(analytics)}>
                Save
              </StickerButton>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};

export default CookieConsent;
