// Pod invitations.
//
// A pod holds ten people. We put you in one; if you leave, the way back in is
// either another match or someone's invite. The invite is a 30-character code,
// long enough that guessing one is not a thing anybody will do, and it travels
// as a bare code or as a link — people paste whichever they were handed, so
// both have to work.
//
// Pure and deterministic apart from `generateInviteCode`, which is the one
// place randomness enters. A real build replaces the store this backs onto;
// the parsing and the rules here are the same either way.

/** Ten. The whole design of a pod — small enough that silence is noticed. */
export const POD_CAPACITY = 10;

export const INVITE_CODE_LENGTH = 30;

/**
 * Crockford's alphabet minus the letters that get misread when a code is
 * spoken or retyped: no I, L, O or U.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ0123456789";

/**
 * Where an invite link points: `/pod/<code>`, a public page (owner, 2026-10-08). Public so a link
 * pasted into a chat previews as a pod invite (its own share image, `/api/og/pod`) rather than
 * the login page, and so someone signed out is asked to sign in and comes back to the join. A
 * signed-in visitor goes straight on to `joinHref`.
 */
export const INVITE_PATH = "/pod";

/** Where the join happens: the pod screen, with the code in `?join=`. Older links point here directly. */
export const JOIN_PATH = "/dashboard/pod";
export const JOIN_PARAM = "join";

const INVITE_PATH_CODE = new RegExp(`^${INVITE_PATH}/([^/]+)/?$`);

export function generateInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  // `crypto` exists in the browser and in Node 19+; the fallback keeps a
  // server render (or a test) from throwing rather than pretending to be safe.
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Uppercases and drops the spaces and dashes people add when reading one out. */
export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function isValidInviteCode(code: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${INVITE_CODE_LENGTH}}$`).test(code);
}

/**
 * Takes whatever the user pasted — a bare code, a full invite URL, or a URL
 * with the code in the query — and returns the code, or null.
 */
export function extractInviteCode(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // A URL: the invite page's path (`/pod/<code>`), or an older link's join parameter.
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const found = url.searchParams.get(JOIN_PARAM) ?? INVITE_PATH_CODE.exec(url.pathname)?.[1] ?? null;
      if (found) {
        const code = normalizeInviteCode(decodeURIComponent(found));
        return isValidInviteCode(code) ? code : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  const code = normalizeInviteCode(raw);
  return isValidInviteCode(code) ? code : null;
}

/** Groups of six, which is how people read a long code back to each other. */
export function formatInviteCode(code: string): string {
  return (code.match(/.{1,6}/g) ?? [code]).join("-");
}

/** The link people share: the public invite page. */
export function inviteUrl(code: string, origin: string): string {
  return `${origin}${INVITE_PATH}/${code}`;
}

/** Where the invite page sends someone signed in (and where signing in comes back to): the join itself. */
export function joinHref(code: string): string {
  return `${JOIN_PATH}?${JOIN_PARAM}=${code}`;
}

/**
 * Why a join was refused, or that it went through. Every caller renders its
 * own sentence — the dialog says it in a field, the deep link says it in a
 * toast — so this stays a verdict rather than a message.
 */
export type JoinResult = "joined" | "invalid" | "full" | "already-in-pod" | "pod-closed";

/** What each refusal means, in the one sentence every surface shows. */
export const JOIN_REFUSAL: Record<Exclude<JoinResult, "joined">, string> = {
  invalid: `That doesn't look like an invite. A code is ${INVITE_CODE_LENGTH} characters. Paste the whole thing, or the link you were sent.`,
  full: "That pod is full. Ask whoever invited you, or get matched with one that has room.",
  "already-in-pod": "You're already in a pod. Leave it first, then this will work.",
  // A pod that went quiet is closed during the weekly rotation and its members moved on, which
  // leaves the code resolving to somewhere nobody is any more.
  "pod-closed": "That pod has closed and everyone moved on. Ask for a fresh invite, or get matched with an active one.",
};
