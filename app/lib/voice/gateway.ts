// Where the live-caption socket goes, and how it says who it is.
//
// The AI service hands the browser the voice gateway's public URL
// (`CreatePrepSessionResult.gatewayUrl`). Operators may write it as http(s) or
// ws(s), so the scheme is normalised here rather than trusted: a page served
// over https can only open `wss:`, and the browser refuses the socket outright
// otherwise.
//
// The ticket never goes in the URL. URLs end up in proxy logs, browser history
// and error reports; a subprotocol does not. The browser offers two
// subprotocols, ours and `ticket.<ticket>`, and the gateway selects ours, so the
// ticket is not even echoed back in the handshake response.

import { STREAM_PATH, STREAM_SUBPROTOCOL, STREAM_TICKET_PREFIX } from "@/app/lib/voice/types";

// Re-exported for existing importers; the contract owns the value.
export { STREAM_PATH };

// RFC 7230 `token`: what a Sec-WebSocket-Protocol entry may contain. A ticket
// with anything else makes the WebSocket constructor throw a SyntaxError, so it
// is checked here, where the error can say what went wrong without quoting it.
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * The gateway URL with a WebSocket scheme: `http:` becomes `ws:`, `https:`
 * becomes `wss:`, and `ws:`/`wss:` pass through. Any credentials and fragment
 * are dropped. Throws a TypeError for anything that is not an absolute
 * http(s)/ws(s) URL.
 */
export function wsUrlFor(gatewayUrl: string): string {
  let url: URL;
  try {
    url = new URL(gatewayUrl);
  } catch {
    throw new TypeError("The voice gateway URL is not an absolute URL.");
  }
  switch (url.protocol) {
    case "http:":
      url.protocol = "ws:";
      break;
    case "https:":
      url.protocol = "wss:";
      break;
    case "ws:":
    case "wss:":
      break;
    default:
      throw new TypeError(`The voice gateway URL must be http(s) or ws(s), not ${url.protocol}`);
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  return url.toString();
}

/**
 * The stream route on the gateway, as a WebSocket URL. The configured URL is a
 * base (it may carry a path prefix when the gateway sits behind a router), so
 * the route is appended once; a URL that already ends in it is left alone.
 */
export function streamUrlFor(gatewayUrl: string): string {
  const url = new URL(wsUrlFor(gatewayUrl));
  const base = url.pathname.replace(/\/+$/, "");
  url.pathname = base.endsWith(STREAM_PATH) ? base : `${base}${STREAM_PATH}`;
  return url.toString();
}

/**
 * The two subprotocols the browser offers: ours first, then the ticket.
 * Throws a TypeError (which never contains the ticket) when the ticket is empty
 * or could not travel in the handshake header.
 */
export function subprotocolsFor(ticket: string): [typeof STREAM_SUBPROTOCOL, string] {
  const entry = `${STREAM_TICKET_PREFIX}${ticket}`;
  if (!ticket || !TOKEN.test(entry)) throw new TypeError("The stream ticket is not a valid WebSocket subprotocol.");
  return [STREAM_SUBPROTOCOL, entry];
}
