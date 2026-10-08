import { countdownGif } from "@/app/lib/email/countdownGif";

// The live countdown image emails carry: GET /api/email/countdown?to=<ISO date>. Drawn fresh on
// every open (never cached), so it shows the time left when the email is read, not when it was sent.
// Public and harmless: it only ever draws four numbers, and `to` is clamped to a year either way.

export const dynamic = "force-dynamic";

const YEAR_MS = 366 * 24 * 60 * 60 * 1000;

export function GET(request: Request): Response {
  const to = new URL(request.url).searchParams.get("to");
  const endsAt = to ? new Date(to) : null;
  const now = Date.now();
  if (!endsAt || Number.isNaN(endsAt.getTime()) || Math.abs(endsAt.getTime() - now) > YEAR_MS) {
    return new Response("Pass ?to=<ISO date> within a year of now.", { status: 400 });
  }

  return new Response(new Uint8Array(countdownGif(endsAt, new Date(now))), {
    headers: {
      "Content-Type": "image/gif",
      // Gmail's image proxy and mail apps honour these; a cached frame would be a stale countdown.
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
