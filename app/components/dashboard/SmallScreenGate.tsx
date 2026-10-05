"use client";

// Covers a desktop-only area on phones. Visibility is pure CSS (`md:hidden`), so the server and
// the browser render the same markup and there is no flash: below 768px this panel shows and the
// caller hides its own content (`hidden md:flex` or `hidden md:block`); from tablets up this panel
// is display:none and the area works exactly as before. Reusable: pass your own copy for another area.
//
// Popups that open by themselves (the Monday week card, a streak celebration, toasts) portal to
// <body>, out of reach of the caller's `hidden`, and a Radix modal would take focus and clicks
// from this panel. Wrap those in `DesktopOnly`: below md they stay unmounted, their state waits
// in its provider, and they come up once the screen is wide enough.

import { useEffect, useRef, useState, useSyncExternalStore, type FC, type ReactNode } from "react";
import Link from "next/link";
import { Check, Link2, LogOut, MonitorSmartphone } from "lucide-react";
import LogoFull from "@/app/components/svg/LogoFull";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { signOut } from "@/app/lib/authClient";

export interface SmallScreenGateCopy {
  title: string;
  body: string;
}

export const DASHBOARD_SMALL_SCREEN_COPY: SmallScreenGateCopy = {
  title: "Made for bigger screens",
  body: "Remote Worldwide's workspace needs more room than a phone gives it. Open it on a laptop, desktop or tablet to keep going.",
};

/** Tailwind's `md` breakpoint: below it the gate shows. */
const SMALL_SCREEN_QUERY = "(max-width: 767.98px)";

const subscribeSmallScreen = (onChange: () => void) => {
  const query = window.matchMedia(SMALL_SCREEN_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** True below md. On the server, and while hydrating, it answers false (the desktop layout). */
export const useSmallScreen = (): boolean =>
  useSyncExternalStore(
    subscribeSmallScreen,
    () => window.matchMedia(SMALL_SCREEN_QUERY).matches,
    () => false,
  );

/** Renders its children only from md up; see the note at the top of this file. */
export const DesktopOnly: FC<{ children: ReactNode }> = ({ children }) => (useSmallScreen() ? null : <>{children}</>);

const SmallScreenGate: FC<{ copy?: SmallScreenGateCopy; showSignOut?: boolean }> = ({
  copy = DASHBOARD_SMALL_SCREEN_COPY,
  showSignOut = true,
}) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older or locked-down browsers: fall back to a hidden textarea.
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
      } finally {
        field.remove();
      }
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  // pointer-events-auto: an open Radix modal elsewhere sets `pointer-events: none` on <body>.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="small-screen-gate-title"
      aria-describedby="small-screen-gate-body"
      className="md:hidden pointer-events-auto fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#fbfbf7] text-[#222325]"
    >
      <div className="flex min-h-full flex-col items-center justify-center px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="br-shadow w-full max-w-sm rounded-xl bg-white p-6">
          <LogoFull className="h-[18px] w-auto" aria-label="Remote Worldwide" role="img" />
          <div className="mt-6 flex h-11 w-11 items-center justify-center rounded-lg bg-[#e1f073]">
            <MonitorSmartphone className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 id="small-screen-gate-title" className="mt-4 text-xl font-bold tracking-tight text-balance">
            {copy.title}
          </h1>
          <p id="small-screen-gate-body" className="mt-2 text-sm leading-relaxed text-[#222325]/70 text-pretty">
            {copy.body}
          </p>
          <StickerButton size="lg" className="mt-6 w-full" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
            {copied ? "Copied" : "Copy link"}
          </StickerButton>
          <p className="mt-2 text-center text-xs text-[#222325]/55" role="status">
            {copied ? "Link copied. Paste it on your computer." : "Paste it on your computer to pick up where you are."}
          </p>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-[rgba(34,35,37,.12)] pt-4 text-sm">
            <Link href="/jobs" className="font-medium underline decoration-1 underline-offset-2 hover:bg-[#e1f073]">
              Browse jobs
            </Link>
            {showSignOut && (
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="inline-flex items-center gap-1.5 font-medium text-[#222325]/70 hover:text-[#222325]"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmallScreenGate;
