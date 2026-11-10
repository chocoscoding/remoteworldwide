// The job someone chose to apply to with the extension, kept while they install it.
//
// A job page's Apply now asks a desktop Chrome user without the extension
// whether to apply by hand or with it. "With it" sends them to the Chrome Web
// Store and leaves the application link here first. The extension's worker
// reads (and removes) this entry on a fresh install and opens the application
// beside the job page (rwwextension src/background/pendingApply.ts; the key
// and the 30 minutes must match).

export const PENDING_APPLY_KEY = "rww:pending-apply";
export const PENDING_APPLY_TTL_MS = 30 * 60_000;

/** sessionStorage: "I've added it" reloaded the page to let the extension's script in; the job it was for. */
const RECHECK_KEY = "rww:apply-recheck";

export interface PendingApply {
  url: string;
  jobId: string;
  at: number;
}

export function setPendingApply(url: string, jobId: string): void {
  try {
    localStorage.setItem(PENDING_APPLY_KEY, JSON.stringify({ url, jobId, at: Date.now() } satisfies PendingApply));
  } catch {
    /* Storage can be disabled; "I've added it" still works. */
  }
}

/** The entry while it is fresh, else null. */
export function readPendingApply(): PendingApply | null {
  try {
    const raw = localStorage.getItem(PENDING_APPLY_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingApply>;
    if (typeof value.url !== "string" || typeof value.jobId !== "string" || typeof value.at !== "number") return null;
    return Date.now() - value.at <= PENDING_APPLY_TTL_MS ? (value as PendingApply) : null;
  } catch {
    return null;
  }
}

export function clearPendingApply(): void {
  try {
    localStorage.removeItem(PENDING_APPLY_KEY);
  } catch {
    /* Nothing to clear. */
  }
}

function session(key: string, value?: string | null): string | null {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* Storage can be disabled. */
  }
  return null;
}

export const recheckFor = (): string | null => session(RECHECK_KEY);
export const setRecheck = (jobId: string | null): void => void session(RECHECK_KEY, jobId);
/** sessionStorage: "Yes" sent a signed-out visitor to sign in; the job it was for. A Google sign-in comes back with a reload. */
const SIGN_IN_KEY = "rww:apply-sign-in";
export const signInFor = (): string | null => session(SIGN_IN_KEY);
export const setSignIn = (jobId: string | null): void => void session(SIGN_IN_KEY, jobId);

/**
 * What Apply now asks, once both answers are in (owner, 2026-11-09: "check if they have the
 * extension and if it's currently working"). No extension: "install". The extension here but
 * nobody signed in: "sign-in", since it works from the site's own sign-in and cannot fill
 * anything without it. Both: null, the plain link. Undefined: an answer is still coming (the
 * extension has up to two seconds to say it is here; the session loads), so a click waits for it.
 */
export type ApplyPrompt = "install" | "sign-in" | null | undefined;

export function applyPrompt(extension: "checking" | "installed" | "absent", account: "loading" | "signed-in" | "signed-out"): ApplyPrompt {
  if (extension === "checking") return undefined;
  if (extension === "absent") return "install";
  if (account === "loading") return undefined;
  return account === "signed-out" ? "sign-in" : null;
}

/**
 * A browser the extension can go on: desktop Chromium (Chrome, Edge, Brave,
 * Opera all list a "Chromium" brand). Firefox and Safari have no
 * `userAgentData`, so they answer no, as do phones and tablets.
 */
export function extensionBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const data = (navigator as Navigator & { userAgentData?: { mobile?: boolean; brands?: { brand: string }[] } }).userAgentData;
  return Boolean(data && data.mobile === false && data.brands?.some((entry) => entry.brand === "Chromium"));
}
