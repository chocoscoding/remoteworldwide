// The consent cookie's shape, without React, so a server component or a route can read the choice:
//
//   import { cookies } from "next/headers";
//   const consent = parseConsentCookie((await cookies()).get(CONSENT_COOKIE)?.value);
//
// The browser side (saving, the hook, the settings event) is `./consent.ts`.

export const CONSENT_COOKIE = "rww_consent";

/** Bump when the categories change, so everyone is asked again. */
export const CONSENT_VERSION = 1;

export type Consent = {
  /** Google Analytics may set its cookies. Strictly necessary cookies need no consent. */
  analytics: boolean;
  /** ISO time the choice was made. */
  decidedAt: string;
  version: number;
};

/** A stored choice, or null when there is none, it is unreadable, or it was made under an older version. */
export function parseConsent(raw: string | null | undefined): Consent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Consent>;
    if (typeof value.analytics !== "boolean" || typeof value.decidedAt !== "string" || value.version !== CONSENT_VERSION) return null;
    return { analytics: value.analytics, decidedAt: value.decidedAt, version: value.version };
  } catch {
    return null;
  }
}

/** The cookie's value as `cookies().get(CONSENT_COOKIE)?.value` gives it (URI-encoded JSON), decoded. */
export function parseConsentCookie(value: string | null | undefined): Consent | null {
  if (!value) return null;
  try {
    return parseConsent(decodeURIComponent(value));
  } catch {
    return null;
  }
}
