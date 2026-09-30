import { NextResponse, type NextRequest } from "next/server";
import { CLIENT_IP_HEADER, CLIENT_IP_TOKEN_HEADER, clientIpHeaders } from "@/app/lib/api/clientIp";

// Tells the backend whose request each browser /api call is.
//
// The /api rewrites in next.config.mjs forward the browser's request from this
// server, so without this the backend sees one address for every visitor and
// its rate limits are one bucket for the whole site. Request headers set here
// travel on to rewrite destinations (and to this app's own /api route handlers,
// which build their upstream headers field by field and never pass these on).
//
// Whatever the browser sent under these two names is dropped first: only this
// server may speak for a visitor.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(CLIENT_IP_TOKEN_HEADER);
  for (const [name, value] of Object.entries(clientIpHeaders(request.headers))) headers.set(name, value);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: "/api/:path*",
};
