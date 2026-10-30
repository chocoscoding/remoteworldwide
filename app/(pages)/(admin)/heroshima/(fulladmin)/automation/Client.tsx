"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { DEFAULT_POST_LIMIT, MAX_POST_LIMIT, parsePostLimit } from "@/app/lib/automation/limit";

// Same-origin, so the browser never holds the bot's token: the route checks the
// admin session and calls the bot with a token only the server can read.
async function triggerJobPosting(channels: Channel[], limit: number) {
  try {
    const res = await fetch("/api/admin/automation/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels, limit }),
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || "Unknown error while triggering job posting" };
  }
}

const COOLDOWN_KEY = "automation_cooldown_until";
const CHANNELS_KEY = "automation_channels";
const LIMIT_KEY = "automation_limit";

type Channel = "twitter" | "linkedin" | "telegram";

/**
 * The channels a run can post to. X is wired end-to-end on the bot (OAuth 1.0a,
 * tokens that don't expire) but is switched off here for now — flip `disabled`
 * to false to bring it back; nothing else needs changing.
 */
const CHANNEL_OPTIONS: { id: Channel; label: string; disabled?: boolean; note?: string }[] = [
  { id: "twitter", label: "X (Twitter)", disabled: true, note: "Temporarily disabled" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "telegram", label: "Telegram" },
];

const DEFAULT_CHANNELS: Channel[] = ["linkedin", "telegram"];

const AutomationClient = () => {
  const [cooldownUntil, setCooldownUntil] = useState(() => {
    if (typeof window === "undefined") return 0;
    const stored = localStorage.getItem(COOLDOWN_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [channels, setChannels] = useState<Channel[]>(() => {
    if (typeof window === "undefined") return DEFAULT_CHANNELS;
    try {
      const stored = localStorage.getItem(CHANNELS_KEY);
      if (!stored) return DEFAULT_CHANNELS;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return DEFAULT_CHANNELS;
      // Never restore a channel that's currently switched off.
      const enabled = CHANNEL_OPTIONS.filter((c) => !c.disabled).map((c) => c.id);
      return parsed.filter((c: Channel) => enabled.includes(c));
    } catch {
      return DEFAULT_CHANNELS;
    }
  });
  // Kept as typed, so the field can be cleared and retyped; only a valid number is remembered.
  const [limitInput, setLimitInput] = useState(() => {
    if (typeof window === "undefined") return String(DEFAULT_POST_LIMIT);
    const stored = parsePostLimit(localStorage.getItem(LIMIT_KEY));
    return String(stored ?? DEFAULT_POST_LIMIT);
  });
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);

  // The bot's host sleeps when idle, so start it waking as soon as this page opens:
  // by the time channels are picked and the button is clicked, it is up. Fire and
  // forget — the server does the ping, and a failure here changes nothing.
  useEffect(() => {
    fetch("/api/admin/automation/wake", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldownUntil > now) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [cooldownUntil, now]);
  useEffect(() => {
    if (cooldownUntil > now) {
      const timeout = setTimeout(() => setCooldownUntil(0), cooldownUntil - now);
      return () => clearTimeout(timeout);
    }
  }, [cooldownUntil, now]);

  const toggleChannel = (id: Channel) => {
    setChannels((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      localStorage.setItem(CHANNELS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const limit = limitInput.trim() === "" ? null : parsePostLimit(limitInput);

  const changeLimit = (value: string) => {
    setLimitInput(value);
    const parsed = value.trim() === "" ? null : parsePostLimit(value);
    if (parsed !== null) localStorage.setItem(LIMIT_KEY, String(parsed));
  };

  const handleTrigger = async () => {
    if (channels.length === 0 || limit === null) return;
    setLoading(true);
    const toast1 = toast.info("Triggering automation...");

    try {
      const res = await triggerJobPosting(channels, limit);
      if (res.success) {
        // `posted` is how many the bot picked; an older bot does not send it.
        const posted = typeof res.posted === "number" ? res.posted : null;
        const message =
          posted === null
            ? "Jobs posted successfully!"
            : posted === 0
              ? "Nothing posted: no jobs were added today, or the bot could not read them."
              : `Posted ${posted} job${posted === 1 ? "" : "s"} from today.`;
        toast.success(message, {
          updateId: toast1,
          position: "bottom-right",
          autoClose: 3500,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "dark",
        });
        const until = Date.now() + 60 * 1000;
        setCooldownUntil(until);
        localStorage.setItem(COOLDOWN_KEY, until.toString());
      } else {
        toast.error(res.message || "Failed.", { updateId: toast1, autoClose: 3500 });
      }
    } catch (e: any) {
      toast.error("Error: " + e.message, { updateId: toast1, autoClose: 3500 });
    }
    setLoading(false);
  };

  const isCooldown = cooldownUntil > now;

  return (
    <div className="w-full p-4">
      <h1 className="text-2xl font-bold mb-4">Automation Controls</h1>

      <section className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm max-w-screen-lg mb-6">
        <h2 className="text-lg font-semibold mb-1 text-primary">Job Posting Automation</h2>
        <p className="text-sm text-gray-600 mb-3">
          Time zone: <span className="font-medium text-gray-800">GMT+1</span>. A run picks jobs added today, from midnight to midnight GMT+1.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTrigger();
          }}
          className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Post to</label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {CHANNEL_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`inline-flex items-center gap-2 text-sm ${
                    option.disabled ? "text-gray-400 cursor-not-allowed" : "text-gray-800 cursor-pointer"
                  }`}>
                  <input
                    type="checkbox"
                    checked={channels.includes(option.id)}
                    disabled={option.disabled}
                    onChange={() => toggleChannel(option.id)}
                    className="h-4 w-4 rounded border-gray-300 accent-black disabled:cursor-not-allowed"
                  />
                  {option.label}
                  {option.note && <span className="text-xs text-gray-400">({option.note})</span>}
                </label>
              ))}
            </div>
            {channels.length === 0 && <p className="text-sm text-red-500 mt-2">Pick at least one channel.</p>}
          </div>

          <div>
            <label htmlFor="automation-limit" className="block text-sm font-medium text-primary mb-2">
              Most jobs per run
            </label>
            <input
              id="automation-limit"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_POST_LIMIT}
              step={1}
              value={limitInput}
              onChange={(e) => changeLimit(e.target.value)}
              className="w-24 h-10 rounded border border-gray-300 px-3 text-sm text-gray-800 focus:outline-none focus:border-black"
            />
            <p className="text-xs text-gray-500 mt-2">
              Posts the newest jobs added today (GMT+1), up to this many. Default {DEFAULT_POST_LIMIT}.
            </p>
            {limit === null && <p className="text-sm text-red-500 mt-2">Pick a whole number from 1 to {MAX_POST_LIMIT}.</p>}
          </div>

          <div className="flex flex-col gap-2 items-stretch">
            <button
              type="submit"
              disabled={loading || isCooldown || channels.length === 0 || limit === null}
              className="drop-shadow-primary2-hover flex items-center justify-center transition-all bg-transparent hover:bg-transparent text-black text-center border-2 border-primary font-bold h-12 rounded px-4 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed w-full">
              Trigger Automation
            </button>
            {isCooldown && <span className="text-sm text-gray-600 mt-2">Cooldown: {Math.ceil((cooldownUntil - now) / 1000)}s</span>}
          </div>
        </form>
      </section>

      {/* The "Generate Admin Token" form lived here. It sent the bot's encryption
          password in a query string and kept the returned token in localStorage,
          which is what put the token in the browser in the first place. The token
          is now server-only: rotate it on the bot itself. */}
    </div>
  );
};

export default AutomationClient;
