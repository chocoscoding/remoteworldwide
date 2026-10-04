"use client";

import { FC, useSyncExternalStore } from "react";
import { Chrome, X } from "lucide-react";
import { useAnswers } from "./answers/AnswersProvider";
import { EXTENSION_URL } from "@/app/lib/extension/presence";

/**
 * The "get the extension" card at the foot of the sidebar, right above the
 * account row. It shows for anyone whose browser the extension has not answered
 * — only once the handshake settles on "absent", so someone who has it never
 * sees it flash in and back out.
 *
 * Closing it lasts until a deliberate refresh (owner, 2026-10-04). A
 * remount after a crash, a client-side route change, even Next falling back to
 * a full page load: none of those bring it back. The flag sits in
 * sessionStorage so a fallback load keeps it, and a "reload" navigation clears
 * it. That check runs once per document, not per mount: a page that was itself
 * opened by a refresh stays a "reload" for its whole life, and a remount on it
 * must not count as a second refresh.
 */

const DISMISSED_KEY = "rww:extension-card-dismissed";

/** Undefined until the browser is first asked; then the one answer every mount shares. */
let dismissed: boolean | undefined;
const listeners = new Set<() => void>();

function readDismissed(): boolean {
  if (dismissed !== undefined) return dismissed;
  try {
    const [navigation] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (navigation?.type === "reload") window.sessionStorage.removeItem(DISMISSED_KEY);
    dismissed = window.sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Storage blocked: the card shows, and closing it still holds for this page.
    dismissed = false;
  }
  return dismissed;
}

function dismiss() {
  dismissed = true;
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Kept in memory only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Hidden on the server and through hydration; the browser's answer comes after. */
const hiddenOnServer = () => true;

const ExtensionCard: FC = () => {
  const { extension } = useAnswers();
  const closed = useSyncExternalStore(subscribe, readDismissed, hiddenOnServer);

  if (closed || extension.status !== "absent") return null;

  return (
    <div className="mx-2 mb-2 flex flex-none items-center gap-2 rounded-xl border border-black/8 bg-[#f6f6f2] py-1.5 pl-2 pr-1 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      <span className="grid h-6 w-6 flex-none place-content-center rounded-md bg-[#222325]">
        <Chrome className="h-3.5 w-3.5 text-[#e1f073]" />
      </span>
      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-primary">Autofill in Chrome</p>
      <a
        href={EXTENSION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-none text-[12.5px] font-bold text-[#222325] underline decoration-black/30 underline-offset-2 transition-colors hover:decoration-[#222325]">
        Get it
        <span className="sr-only"> (the RemoteWorldwide extension, in a new tab)</span>
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide the extension card"
        className="grid h-6 w-6 flex-none cursor-pointer place-content-center rounded-md text-black/40 transition-colors hover:bg-black/5 hover:text-black/70">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default ExtensionCard;
