"use client";

// Apply now, on desktop Chrome without the extension.
//
// The job page asks on every press: apply by hand, or with the extension (about a
// minute instead of ten, and progress saved as you go). "With it" leaves the
// application link in localStorage (app/lib/extension/pendingApply.ts) and
// opens the Chrome Web Store in a new tab. On install the extension takes that
// link and opens the application itself, beside this page, so the person lands
// on the form with it already on; this dialog sees the link gone and closes.
//
// An extension from before that hook cannot do it, and Chrome puts no script
// into a page that was open before the install. So "I've added it" reloads the
// page: once the extension's script is in, the page goes straight to the job.
//
// The extension here but nobody signed in asks too: it works from the site's
// own sign-in, so it cannot fill anything yet. "With it" then opens the sign-in
// popup, and once signed in (a Google sign-in comes back with a reload) the
// page goes straight to the job.
//
// A click while either answer is still coming (the extension has two seconds
// to say it is here; the session loads) waits for it, then asks or opens the
// job, instead of slipping through as the plain link.
//
// With the extension here and signed in, on a phone, or in a browser it cannot
// go on, Apply now is the plain link it always was.

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Coffee, Loader2, Timer, X } from "lucide-react";
import { EXTENSION_URL, useExtensionPresence } from "@/app/lib/extension/presence";
import {
  applyPrompt,
  clearPendingApply,
  extensionBrowser,
  readPendingApply,
  recheckFor,
  setPendingApply,
  setRecheck,
  setSignIn,
  signInFor,
} from "@/app/lib/extension/pendingApply";
import motion from "./ApplyWithExtension.module.css";

type Step = "choose" | "waiting" | "not-yet";

const primary =
  "inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-[#e1f073] px-4 py-3 text-sm font-extrabold text-[#222325] br-bold-press";
const secondary =
  "inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#222325] br-plain-press";

export function useApplyWithExtension(
  job: { id: string; applicationUrl: string },
  { account, onSignIn }: { account: "loading" | "signed-in" | "signed-out"; onSignIn: () => void },
) {
  const presence = useExtensionPresence();
  const [step, setStep] = useState<Step | null>(null);
  const prompt = applyPrompt(presence.status, account);
  /** A click that came while an answer was still coming: settled once it is in. */
  const clickWaiting = useRef(false);
  /** "With it" sent this visitor to sign in on this page load (an older flag is a sign-in they gave up on). */
  const signingIn = useRef(false);

  // Back from "I've added it"'s reload: the extension's script is in now, or it is not.
  // (In a frame, cancelled on clean-up, so React's development double run reads the flag once.)
  useEffect(() => {
    const status = presence.status;
    if (status === "checking" || recheckFor() !== job.id) return;
    const frame = requestAnimationFrame(() => {
      setRecheck(null);
      const pending = readPendingApply();
      if (status === "installed") {
        clearPendingApply();
        if (pending?.jobId === job.id) window.location.assign(pending.url);
      } else if (pending?.jobId === job.id) {
        setStep("not-yet");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [presence.status, job.id]);

  // While it installs: the extension takes the link and opens the job itself.
  useEffect(() => {
    if (step !== "waiting" && step !== "not-yet") return;
    const check = () => {
      if (!readPendingApply()) setStep(null);
    };
    const timer = window.setInterval(check, 1500);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [step]);

  // Signed in after "With it": the extension can work now, so straight to the job.
  useEffect(() => {
    if (presence.status !== "installed" || account === "loading" || signInFor() !== job.id) return;
    if (account === "signed-out") {
      if (!signingIn.current) setSignIn(null);
      return;
    }
    setSignIn(null);
    const pending = readPendingApply();
    if (pending?.jobId !== job.id) return;
    clearPendingApply();
    window.location.assign(pending.url);
  }, [presence.status, account, job.id]);

  // The answer a waiting click was held for is in: ask, or open the job as the link would have.
  // (Still inside the click's few seconds of user activation, so the new tab is not blocked.)
  useEffect(() => {
    if (prompt === undefined || !clickWaiting.current) return;
    const frame = requestAnimationFrame(() => {
      clickWaiting.current = false;
      if (prompt === null) window.open(job.applicationUrl, "_blank", "noopener,noreferrer");
      else setStep("choose");
    });
    return () => cancelAnimationFrame(frame);
  }, [prompt, job.applicationUrl]);

  const onApplyClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      // Asked on every press (owner, 2026-11-09): "Apply manually" is not remembered, on this job or the next.
      if (prompt === null || !extensionBrowser()) return;
      event.preventDefault();
      if (prompt === undefined) clickWaiting.current = true;
      else setStep("choose");
    },
    [prompt],
  );

  const applyManually = () => {
    clearPendingApply();
    setStep(null);
    window.open(job.applicationUrl, "_blank", "noopener,noreferrer");
  };

  const withExtension = () => {
    setPendingApply(job.applicationUrl, job.id);
    if (prompt === "sign-in") {
      signingIn.current = true;
      setSignIn(job.id);
      setStep(null);
      onSignIn();
      return;
    }
    window.open(EXTENSION_URL, "_blank", "noopener,noreferrer");
    setStep("waiting");
  };

  const added = () => {
    if (presence.status === "installed") {
      clearPendingApply();
      setStep(null);
      window.open(job.applicationUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!readPendingApply()) setPendingApply(job.applicationUrl, job.id);
    setRecheck(job.id);
    window.location.reload();
  };

  const dialog = (
    <DialogPrimitive.Root open={step !== null} onOpenChange={(open) => !open && setStep(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className={`fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white p-6 ${step === "choose" ? "pt-10" : ""} br-bold duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95`}>
          <DialogPrimitive.Close className="absolute right-4 top-4 z-10 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-white text-[#222325] br-shadow-press">
            <X className="h-3.5 w-3.5" strokeWidth={3} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          <div className="pr-10">
            {step === "choose" ? (
              <DialogPrimitive.Title className="text-2xl font-bold text-primary">
                <span className="sr-only">Apply in 1 minute instead of 10</span>
                {/* "10 minutes" is struck, pushed up and tilted; "1 minute" rises into its place, highlighted. */}
                <span aria-hidden className="flex flex-wrap items-center gap-x-2">
                  Apply in
                  <span className={motion.slot}>
                    <span className={motion.before}>10 minutes</span>
                    <span className={motion.after}>1 minute</span>
                  </span>
                </span>
              </DialogPrimitive.Title>
            ) : (
              <DialogPrimitive.Title className="text-lg font-bold text-primary">Add it to Chrome</DialogPrimitive.Title>
            )}
            {step !== "choose" && (
              <DialogPrimitive.Description className="mt-1 text-sm text-black/55">
                The Chrome Web Store is open in a new tab. Press Add to Chrome there and we&apos;ll take you straight to the application.
              </DialogPrimitive.Description>
            )}
          </div>

          {step === "choose" ? (
            <>
              {/* Two rows of one kind (owner, 2026-11-09): time back, and less stress. */}
              <DialogPrimitive.Description asChild>
                <ul className="mt-4 grid gap-3 text-sm text-primary">
                  <li className="flex items-center gap-3">
                    <span className="grid h-8 w-8 flex-none place-content-center rounded-lg border border-[#222325]/15 bg-[#e1f073]">
                      <Timer className="h-4 w-4" />
                    </span>
                    <span>The extension fills in the form for you.</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="grid h-8 w-8 flex-none place-content-center rounded-lg border border-[#222325]/15 bg-[#e2ebf8]">
                      <Coffee className="h-4 w-4" />
                    </span>
                    <span>No pressure. Your progress saves as you go, so you pick up where you left off.</span>
                  </li>
                </ul>
              </DialogPrimitive.Description>
              {/* Side by side (owner, 2026-11-09); stacked, the extension first, only on a narrow window. */}
              <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
                <button type="button" className={`${secondary} sm:w-auto sm:flex-none`} onClick={applyManually}>
                  Apply manually
                </button>
                <button type="button" className={`${primary} sm:flex-1`} onClick={withExtension}>
                  Yes, apply with the extension
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-5 flex items-center gap-2 rounded-xl border-[1.5px] border-dashed border-black/20 bg-[#fbfbf7] px-4 py-3 text-sm text-black/60" aria-live="polite">
                {step === "waiting" ? (
                  <>
                    <Loader2 className="h-4 w-4 flex-none animate-spin" />
                    Waiting for the extension…
                  </>
                ) : (
                  "We can't see the extension in this browser yet. Add it from the store, then press I've added it."
                )}
              </p>
              <div className="mt-6 grid gap-2.5">
                <button type="button" className={primary} onClick={added}>
                  I&apos;ve added it
                </button>
                <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" className={secondary}>
                  Open the Chrome Web Store again
                </a>
                <button type="button" className="cursor-pointer py-1 text-sm font-semibold text-black/55 underline underline-offset-2" onClick={applyManually}>
                  Apply manually instead
                </button>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );

  return { onApplyClick, dialog };
}
