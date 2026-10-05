// Where the browser extension lives, readable from a server component as well
// as a client one: `presence.ts` is a client module, and a server component
// (the footer, the pricing table) importing a constant from it would cross the
// client boundary for one string.

/**
 * The Chrome Web Store listing, published 2026-10-04. In code rather than env
 * so every deploy links the same listing; `NEXT_PUBLIC_EXTENSION_URL` still
 * wins when set (a beta listing, say). Every "Get it" prompt keys off this.
 */
export const EXTENSION_URL =
  process.env.NEXT_PUBLIC_EXTENSION_URL || "https://chromewebstore.google.com/detail/remoteworldwide-autofill/beilfbphhehmlihmpfijjciobcnccecn";
