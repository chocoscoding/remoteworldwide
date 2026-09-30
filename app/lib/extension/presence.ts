"use client";

// Is the browser extension actually here?
//
// The site has no other way to know. An extension is not on the page's origin
// and Chrome's `chrome.runtime.sendMessage` from a web page needs the
// extension's id baked in plus `externally_connectable`, which is a second
// place to keep the id in sync and a release-channel trap. So the extension's
// content script and this hook talk over `window.postMessage`, the one channel
// both halves already share:
//
//   web → *          { source: "rww-web",       type: "extension:ping" }
//   extension → web  { source: "rww-extension", type: "extension:pong", version }
//
// The extension also sends one unprompted pong when its content script loads,
// which is usually before this even mounts — so the listener goes on BEFORE the
// ping and stays on for the life of the hook. A pong that arrives after the
// give-up window still flips the state; a slow first paint must not end up
// telling someone their extension is missing.
//
// A pong is accepted only from this very window and this very origin. Anything
// posted by an iframe, an opener or another origin is somebody else's message,
// however well it matches the shape.
//
// Nothing here reads or writes an attribute on <html> or <body>: React 19
// treats a DOM attribute that appeared between the server's render and
// hydration as a mismatch, and the handshake needs no marker in the document
// anyway. The state starts at "checking" on the server AND on the first client
// render, so the two agree.

import { useEffect, useState } from "react";

/**
 * The Chrome Web Store listing. Empty until the extension is published —
 * every "Get it" prompt stays hidden while it is, which is the honest default
 * for a link that would 404.
 */
export const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL ?? "";

export type ExtensionStatus = "checking" | "installed" | "absent";

export interface ExtensionPresence {
  status: ExtensionStatus;
  /** The extension's own version string, from its pong. Null until one answers. */
  version: string | null;
}

/** Generous: a content script answers in a frame or two, so this only bounds the wait. */
const ANSWER_WINDOW_MS = 2000;

const CHECKING: ExtensionPresence = { status: "checking", version: null };
const ABSENT: ExtensionPresence = { status: "absent", version: null };

const PING = { source: "rww-web", type: "extension:ping" } as const;

interface Pong {
  source: "rww-extension";
  type: "extension:pong";
  version: string;
}

/** The whole trust check on the payload — everything else on the event is checked by the caller. */
function isPong(data: unknown): data is Pong {
  if (typeof data !== "object" || data === null) return false;
  const message = data as Partial<Pong>;
  return message.source === "rww-extension" && message.type === "extension:pong" && typeof message.version === "string";
}

export function useExtensionPresence(): ExtensionPresence {
  const [presence, setPresence] = useState<ExtensionPresence>(CHECKING);

  useEffect(() => {
    // Read once: `window.location.origin` is the only origin a pong may come
    // from, and a client-side navigation cannot change it.
    const origin = window.location.origin;
    let timer: number | undefined;

    function onMessage(event: MessageEvent) {
      // `event.source !== window` rejects an iframe or an opener; the origin
      // check rejects a third party that guessed the shape.
      if (event.source !== window || event.origin !== origin) return;
      if (!isPong(event.data)) return;
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
      setPresence({ status: "installed", version: event.data.version });
    }

    window.addEventListener("message", onMessage);
    // Our own ping comes back to this listener too; `isPong` drops it.
    window.postMessage(PING, origin);
    timer = window.setTimeout(() => {
      timer = undefined;
      // Only a still-unanswered check gives up — never an answered one.
      setPresence((current) => (current.status === "checking" ? ABSENT : current));
    }, ANSWER_WINDOW_MS);

    return () => {
      window.removeEventListener("message", onMessage);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return presence;
}
