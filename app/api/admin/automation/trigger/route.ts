// Triggers a posting run on the automation bot (rwwbot, hosted separately).
//
// The admin page used to call the bot straight from the browser, holding the bot's
// admin token in `NEXT_PUBLIC_AUTOMATION_TOKEN` — which means the token shipped in
// the JS bundle to every visitor of the site, not just to admins. Anyone could read
// it out and post to the company's LinkedIn, X and Telegram.
//
// So the token lives here now, server-side, and the gate is the admin session
// itself: `requireAdmin()` decides who may trigger a run, and only this route ever
// sees the bot's token. The browser sends nothing but the channel list.
//
// The bot's token must still be rotated — the old one shipped publicly and has to be
// assumed compromised (OWNER-TASKS.md § 1.1).

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/require-admin";

const CHANNELS = ["twitter", "linkedin", "telegram"] as const;
type Channel = (typeof CHANNELS)[number];

// The bot wakes from sleep on the first request after a quiet spell, so it needs
// longer than a normal upstream call before we give up on it.
const TIMEOUT_MS = 30_000;

const isChannel = (value: unknown): value is Channel => CHANNELS.includes(value as Channel);

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const baseUrl = process.env.AUTOMATION_URL;
  const token = process.env.AUTOMATION_TOKEN;
  if (!baseUrl || !token) {
    return NextResponse.json({ success: false, message: "Automation is not configured on this environment." }, { status: 503 });
  }

  let channels: unknown;
  try {
    ({ channels } = await request.json());
  } catch {
    return NextResponse.json({ success: false, message: "Expected a JSON body." }, { status: 400 });
  }

  // Validated against the known list rather than passed through: these values are
  // interpolated into the bot's query string, and the bot acts on each one.
  if (!Array.isArray(channels) || channels.length === 0 || !channels.every(isChannel)) {
    return NextResponse.json({ success: false, message: "Pick at least one valid channel." }, { status: 400 });
  }

  const unique = [...new Set(channels)];

  try {
    const res = await fetch(`${baseUrl}/trigger?channels=${unique.join(",")}`, {
      headers: { "x-admin-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // The bot answers JSON on success and, on some failures, plain text — so read it
    // defensively and never let a parse error surface as a 500 from our own origin.
    const body = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = { success: res.ok, message: body.slice(0, 500) || res.statusText };
    }

    return NextResponse.json(parsed, { status: res.ok ? 200 : 502 });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { success: false, message: timedOut ? "The automation bot did not respond in time." : "Could not reach the automation bot." },
      { status: 504 }
    );
  }
}
