"use client";

import { useEffect } from "react";

/**
 * ⚠️ TEMPORARY — automation-bot keep-alive. Delete when the bot has real uptime.
 *
 * WHY THIS EXISTS
 * The automation bot is on a host that sleeps when idle, so the first
 * "Trigger Automation" after a quiet spell either times out or waits on a cold
 * boot. Budget rules out an always-on plan or an external uptime monitor, so
 * while an admin has an admin route open we poke the bot's root endpoint
 * (`GET /` → "Bot is running.") every 30s to keep it awake.
 *
 * This is a stopgap, not architecture. It is deliberately one self-contained
 * file with a single mount point so it can be pulled out cleanly:
 *
 *   TO REMOVE (two steps, no other traces):
 *     1. Delete this file.
 *     2. Delete the <BotKeepAlive /> line and its import from
 *        app/(pages)/(admin)/layout.tsx
 *
 * It touches no shared state, exports nothing else, renders nothing, and no
 * other module imports it. Nothing can grow to depend on it.
 *
 * PROPER FIXES, when there's budget: a paid always-on dyno/instance, an
 * external cron pinger (UptimeRobot/cron-job.org), or moving the trigger to a
 * serverless function that has no cold-sleep problem.
 */

const PING_INTERVAL_MS = 50_000;

export default function BotKeepAlive() {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_AUTOMATION_URL;

    // Without this guard `fetch(undefined)` would hammer our own origin every
    // 30 seconds. The var is unset in local dev, so this is the normal path there.
    if (!url) return;

    // Says out loud that a temporary thing is running, so it doesn't quietly
    // become permanent.
    console.info("[keep-alive] TEMPORARY bot ping active (30s). Remove: app/components/ADMIN/BotKeepAlive.tsx");

    let cancelled = false;

    const ping = () => {
      if (cancelled) return;
      // no-cors: we only need the request to leave the browser. We never read
      // the response, and this keeps a CORS change on the bot from filling the
      // admin's console with errors.
      fetch(url, { method: "GET", mode: "no-cors", cache: "no-store" }).catch(() => {
        // A failed ping is expected while the host is waking — the exact
        // condition this exists to fix. Never surface it to the admin.
      });
    };

    ping();
    const id = setInterval(ping, PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return null;
}
