// Who the backend should count a request against.
//
// Every call reaches the backend from this server — the browser's /api calls
// through the rewrites in next.config.mjs, server components and actions
// through `app/lib/backend.ts` — so the address the backend sees is this
// server's, the same for every visitor. These two headers tell it whose request
// it really is: the visitor's address, and CLIENT_IP_TOKEN to prove this server
// is the one saying so. The backend counts signed-in users by their session and
// signed-out visitors by this address (its middleware/rateLimit.ts).
//
// Server-only by construction: CLIENT_IP_TOKEN has no NEXT_PUBLIC_ prefix, so a
// client bundle that imported this would read undefined and send nothing.

/** The visitor's address, as the backend reads it. Its own name, so nothing confuses it with X-Forwarded-For. */
export const CLIENT_IP_HEADER = "x-rww-client-ip";
/** The proof, carrying CLIENT_IP_TOKEN. */
export const CLIENT_IP_TOKEN_HEADER = "x-rww-client-ip-token";

/**
 * The visitor's address from the request that reached this server.
 *
 * Only as honest as the edge in front of it: Vercel overwrites both headers
 * with the real client address, so a visitor cannot choose theirs. Behind any
 * other proxy, that proxy must set X-Real-IP or X-Forwarded-For itself.
 */
export function visitorIpOf(incoming: Headers): string | null {
  const real = incoming.get("x-real-ip")?.trim();
  if (real) return real;
  const first = incoming.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || null;
}

/**
 * The headers to add to a backend call made on behalf of `incoming`: both, or
 * the proof alone when there is no visitor address (the backend then counts it
 * as this server speaking for itself), or none when no token is configured.
 */
export function clientIpHeaders(incoming: Headers): Record<string, string> {
  const token = process.env.CLIENT_IP_TOKEN;
  if (!token) return {};
  const ip = visitorIpOf(incoming);
  return ip ? { [CLIENT_IP_TOKEN_HEADER]: token, [CLIENT_IP_HEADER]: ip } : { [CLIENT_IP_TOKEN_HEADER]: token };
}
