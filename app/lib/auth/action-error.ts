// What a failed server-action call tells the person who clicked.
//
// A thrown action error reaches the browser with its own message in development
// only. A production build replaces every message with React's generic "An error
// occurred in the Server Components render…" paragraph and a digest, so a refusal
// from action-guards.ts (Unauthorized, Forbidden, Account locked) and a failed
// write look the same, and that whole paragraph ended up in the admin's toast.
// This swaps the masked text for one short line naming the likely cause (an ended
// session). Any other message passes through unchanged, which in development is
// every message. Client-safe on purpose: action-guards.ts imports next/headers.

// The same marker Next's own runtime checks for to recognise a masked error.
const MASKED = "The specific message is omitted in production builds";

export const actionErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : "";
  if (!message || message.includes(MASKED)) return "the server refused or could not finish it. If you were signed out, sign in again and retry.";
  return message;
};
