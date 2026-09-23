// Wakes the automation bot so the first "Trigger Automation" of the day is not a
// cold boot. The bot's host sleeps when idle and takes the better part of a minute
// to come back.
//
// This replaces `BotKeepAlive`, a temporary component mounted on *every* admin route
// that pinged the bot from the browser every 30 seconds, using a public env var for
// the bot's URL. One request when the automation page opens buys the same warm bot —
// the admin still has to pick channels and click — without a polling loop and without
// the bot's address in the bundle.
//
// If you would rather the bot were never cold, point an external pinger (cron-job.org,
// UptimeRobot) or a Vercel Cron at this route instead. Note that keeping it awake
// around the clock burns the host's monthly free hours, which is what the browser
// keep-alive was avoiding.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/require-admin";

// Short: we only need the request to land. Whether the bot answers before we give up
// makes no difference — it is awake either way.
const TIMEOUT_MS = 5_000;

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const baseUrl = process.env.AUTOMATION_URL;
  if (!baseUrl) return new NextResponse(null, { status: 204 });

  try {
    await fetch(baseUrl, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    // A failed or timed-out ping is the expected case while the host is waking —
    // exactly what this exists to start. Never report it to the admin.
  }

  return new NextResponse(null, { status: 204 });
}
