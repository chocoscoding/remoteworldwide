// What this browser agreed to about cookies, in one place every part of the site can read.
//
// The choice lives in a first-party cookie, `rww_consent` (path /, one year, SameSite=Lax), so a
// server component or a route can read it too (`./cookie.ts`), and is mirrored to localStorage, so
// a browser that drops the cookie still remembers. Storage can be missing (private windows, blocked
// site data), so every access is guarded, as in `app/components/waitlist/joinedStore.ts`: a blank
// answer just means "not decided yet", and the card asks again.
//
// A change is announced on this window with `rww:consent` (other tabs hear `storage`), and
// `openConsentSettings()` asks the card to open its settings, from the footer's "Cookie settings".
//
// Browser-only: call these from client components and effects.

import { useMemo, useSyncExternalStore } from "react";
import { CONSENT_COOKIE, CONSENT_VERSION, parseConsent, type Consent } from "./cookie";

export { CONSENT_COOKIE, CONSENT_VERSION, parseConsent, parseConsentCookie, type Consent } from "./cookie";

const STORAGE_KEY = "rww_consent";

/** Fired on this window after a choice is saved. */
export const CONSENT_CHANGED = "rww:consent";
/** Fired to ask the consent card to open its settings. */
export const CONSENT_OPEN_SETTINGS = "rww:consent-settings";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  try {
    const prefix = `${name}=`;
    const found = document.cookie.split("; ").find((part) => part.startsWith(prefix));
    return found ? decodeURIComponent(found.slice(prefix.length)) : null;
  } catch {
    return null;
  }
}

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The raw stored choice: the cookie first, the localStorage mirror when the cookie is gone. */
function readRaw(): string {
  const fromCookie = readCookie(CONSENT_COOKIE);
  if (fromCookie && parseConsent(fromCookie)) return fromCookie;
  return readStorage() ?? "";
}

/** Saves a choice to the cookie and its mirror, and tells this tab; other tabs hear it through `storage`. */
export function saveConsent(choice: { analytics: boolean }): Consent {
  const consent: Consent = { analytics: choice.analytics, decidedAt: new Date().toISOString(), version: CONSENT_VERSION };
  const raw = JSON.stringify(consent);
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(raw)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    // Blocked cookies: the localStorage mirror still remembers.
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Blocked storage too: the choice holds for this page view, and the card asks again next time.
  }
  window.dispatchEvent(new Event(CONSENT_CHANGED));
  return consent;
}

/** Asks the consent card to open its settings (the footer's "Cookie settings"). */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(CONSENT_OPEN_SETTINGS));
}

/** For a listener of `openConsentSettings`; returns the unsubscribe. */
export function onOpenConsentSettings(handler: () => void): () => void {
  window.addEventListener(CONSENT_OPEN_SETTINGS, handler);
  return () => window.removeEventListener(CONSENT_OPEN_SETTINGS, handler);
}

const subscribe = (onChange: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener(CONSENT_CHANGED, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CONSENT_CHANGED, onChange);
    window.removeEventListener("storage", onStorage);
  };
};

/** The server never knows; null keeps "not known yet" apart from "not decided" ("") on the client. */
const serverSnapshot = (): string | null => null;

/**
 * The browser's choice: undefined while it cannot be known yet (the server render and hydration),
 * null when nothing has been decided, and the choice once there is one.
 */
export function useConsent(): Consent | null | undefined {
  const raw = useSyncExternalStore<string | null>(subscribe, readRaw, serverSnapshot);
  return useMemo(() => (raw === null ? undefined : parseConsent(raw)), [raw]);
}

/** Google Analytics' own cookies: `_ga`, `_ga_<id>`, `_gid`, `_gat…`. */
const ANALYTICS_COOKIE = /^(_ga($|_)|_gid$|_gat)/;

/**
 * Expires every Google Analytics cookie this page can see. They are set on the registrable domain
 * (".example.com"), so each parent domain of this host is tried as well as the host itself.
 */
export function clearAnalyticsCookies(): void {
  try {
    const names = document.cookie
      .split("; ")
      .map((part) => part.split("=")[0])
      .filter((name) => ANALYTICS_COOKIE.test(name));
    if (names.length === 0) return;
    const labels = window.location.hostname.split(".");
    const domains = [""];
    for (let i = 0; i < labels.length - 1; i += 1) domains.push(`; Domain=.${labels.slice(i).join(".")}`);
    for (const name of names) {
      for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
    }
  } catch {
    // Cookies unreadable: there is nothing this page could clear anyway.
  }
}
