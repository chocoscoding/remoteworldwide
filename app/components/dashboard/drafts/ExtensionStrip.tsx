"use client";

import { FC } from "react";
import { PlugZap } from "lucide-react";
import { EXTENSION_URL } from "@/app/lib/extension/presence";

/**
 * Drafts are written by the browser extension, never by this site, so when the
 * extension has not answered this browser the drafts page says so above the
 * list. Shown only once the handshake has settled on "absent" — never while it
 * is still checking, which would open on a warning it is about to take back.
 *
 * The dashed, unfilled treatment is the app's "not there yet" look (the
 * extension dialog's status line uses the same). "Get it" appears only when
 * there is somewhere to send people: an unset NEXT_PUBLIC_EXTENSION_URL means
 * the extension is not published yet, and the copy says that instead.
 */
const ExtensionStrip: FC = () => (
  <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-dashed border-black/20 bg-[#fbfbf7] px-4 py-3">
    <span className="grid h-9 w-9 flex-none place-content-center rounded-lg border border-black/10 bg-white">
      <PlugZap className="h-4 w-4 text-black/40" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-primary">Drafts are saved by the browser extension</p>
      <p className="text-xs text-black/50">
        {EXTENSION_URL
          ? "It isn't in this browser. Add it to Chrome and what you type into an application is kept as you go, so a refresh or a closed tab loses nothing."
          : "It isn't available yet. Once it is, what you type into an application is kept as you go, so a refresh or a closed tab loses nothing."}
      </p>
    </div>
    {EXTENSION_URL && (
      <a
        href={EXTENSION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex flex-none cursor-pointer items-center rounded-md border-[1.5px] border-[#222325] bg-white px-2.5 py-1 text-xs font-bold text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
        Get it
        <span className="sr-only"> — the browser extension, in a new tab</span>
      </a>
    )}
  </div>
);

export default ExtensionStrip;
