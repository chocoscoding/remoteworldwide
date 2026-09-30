// The print token: a short-lived pass that lets Chromium on the AI host open ONE
// print page for ONE user.
//
// Why a token at all. `/print/resume/[id]` and `/print/letter/[id]` render
// someone's CV, and the browser that loads them (headless Chromium, driven by
// the AI service's renderer) has no session cookie — it is not the user's
// browser, and handing it their cookie would hand it their whole account. So
// the website signs a statement instead: "user u may print document d of kind k
// until exp". The print page checks the signature and fetches the document AS
// that user, with the service token, exactly like any other server-side call.
//
// The rules that make it safe to give to another machine:
//  - HMAC-SHA256 with `PRINT_TOKEN_SECRET`, a secret only this app holds (not
//    the AI service's token: the renderer must not be able to mint its own).
//  - It names one kind and one id, and `verifyPrintToken` refuses it for any
//    other page, so a token for a letter cannot open a resume.
//  - It lives at most 120 seconds — a render takes about one.
//  - It travels as the `x-rww-print-token` request header on the one navigation,
//    never in a URL, so it is in no log line, history entry or Referer.
//  - The signature is compared with `timingSafeEqual`.
//
// Server-only by construction: it needs `node:crypto` and a secret that is not
// NEXT_PUBLIC_, and only route handlers and server components import it. (The
// `server-only` package is not installed here, so there is no build-time fence;
// a client import would fail on `node:crypto` instead.)
//
// Payload `{ u, k, d, v, exp, lh? }`:
//   u   the user id (session.user.id) the page fetches as
//   k   "resume" | "letter"
//   d   the ai_documents id (24 hex)
//   v   the token format, 1 — a later format is refused rather than misread
//   exp expiry, epoch SECONDS
//   lh  a letter's letterhead, resolved from the profile when minted: the
//       renderer's browser has no session to read the profile with, so the name
//       and contacts ride in the signed payload instead
//
// Pure apart from node:crypto, and reads the secret per call, so
// `tests/print.test.mjs` can load it directly.

import { createHmac, timingSafeEqual } from "node:crypto";

export const PRINT_TOKEN_HEADER = "x-rww-print-token";

/** Long enough to cover the renderer's queue and the render; short enough to be worthless once it is done. */
export const PRINT_TOKEN_TTL_SECONDS = 120;

const VERSION = 1;
/** A secret shorter than this is a misconfiguration, not a secret. 32 bytes of randomness is ~43 base64 characters. */
const MIN_SECRET_LENGTH = 32;
/** The renderer refuses a token past 2048 characters; the letterhead is capped so a long profile cannot get near it. */
const MAX_TOKEN_LENGTH = 2048;
const MAX_NAME = 120;
const MAX_CONTACT = 160;
const MAX_CONTACTS = 4;

export type PrintKind = "resume" | "letter";

export interface PrintLetterhead {
  name: string;
  contact: string[];
}

export interface PrintTokenPayload {
  u: string;
  k: PrintKind;
  d: string;
  v: number;
  exp: number;
  lh?: PrintLetterhead;
}

const OBJECT_ID = /^[a-f\d]{24}$/i;
/** A session user id. Mongo ids in practice; bounded to a safe alphabet either way. */
const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

const secret = (): string | null => {
  const value = process.env.PRINT_TOKEN_SECRET ?? "";
  return value.length >= MIN_SECRET_LENGTH ? value : null;
};

/** True when tokens can be minted here — `renderPdf` checks it before asking for a render that could only 404. */
export const printTokensConfigured = (): boolean => secret() !== null;

const sign = (key: string, body: string): Buffer => createHmac("sha256", key).update(`rww-print.v${VERSION}.${body}`).digest();

const clampLetterhead = (lh: PrintLetterhead): PrintLetterhead => ({
  name: lh.name.trim().slice(0, MAX_NAME),
  contact: lh.contact
    .map((c) => c.trim().slice(0, MAX_CONTACT))
    .filter(Boolean)
    .slice(0, MAX_CONTACTS),
});

export interface MintInput {
  userId: string;
  kind: PrintKind;
  id: string;
  letterhead?: PrintLetterhead | null;
  /** Epoch ms; tests pass one. */
  now?: number;
}

/** Signs a pass for one print page. Throws when the secret is missing or the input is not a real user/document pair. */
export function mintPrintToken({ userId, kind, id, letterhead, now = Date.now() }: MintInput): string {
  const key = secret();
  if (!key) throw new Error("PRINT_TOKEN_SECRET is not configured");
  if (!USER_ID.test(userId) || !OBJECT_ID.test(id) || (kind !== "resume" && kind !== "letter")) throw new Error("Not a printable document");

  const payload: PrintTokenPayload = { u: userId, k: kind, d: id, v: VERSION, exp: Math.floor(now / 1000) + PRINT_TOKEN_TTL_SECONDS };
  if (kind === "letter" && letterhead && letterhead.name.trim()) payload.lh = clampLetterhead(letterhead);

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const token = `${body}.${sign(key, body).toString("base64url")}`;
  if (token.length > MAX_TOKEN_LENGTH) throw new Error("The print token is too long");
  return token;
}

const isLetterhead = (value: unknown): value is PrintLetterhead =>
  !!value &&
  typeof value === "object" &&
  typeof (value as PrintLetterhead).name === "string" &&
  Array.isArray((value as PrintLetterhead).contact) &&
  (value as PrintLetterhead).contact.every((c) => typeof c === "string");

/**
 * The payload, when `token` is a genuine, unexpired pass for exactly this page.
 * Null for anything else — a missing header, a bad signature, another kind or
 * id, an expired or over-long-lived token — and the page answers 404 for all of
 * them alike, so a probe learns nothing about which check failed.
 */
export function verifyPrintToken(token: string | null | undefined, expect: { kind: PrintKind; id: string; now?: number }): PrintTokenPayload | null {
  const key = secret();
  if (!key || typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return null;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null;
  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const wanted = sign(key, body);
  // timingSafeEqual throws on unequal lengths; a wrong length is simply wrong.
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Partial<PrintTokenPayload>;

  const nowSeconds = Math.floor((expect.now ?? Date.now()) / 1000);
  if (p.v !== VERSION) return null;
  if (typeof p.u !== "string" || !USER_ID.test(p.u)) return null;
  if (p.k !== expect.kind || typeof p.d !== "string" || p.d.toLowerCase() !== expect.id.toLowerCase()) return null;
  if (typeof p.exp !== "number" || !Number.isFinite(p.exp) || p.exp <= nowSeconds) return null;
  // Signed by us, but never with a life this long: refuse rather than honour a
  // token minted under a clock or a constant that was wrong.
  if (p.exp - nowSeconds > PRINT_TOKEN_TTL_SECONDS + 5) return null;
  if (p.lh !== undefined && !isLetterhead(p.lh)) return null;

  return { u: p.u, k: p.k, d: p.d, v: p.v, exp: p.exp, ...(p.lh ? { lh: p.lh } : {}) };
}
