// A day of Pro from a streak gift: the backend raises the account's tier until `boostUntil` (ISO)
// and sends that time on the billing overview and the redeem answer. These read it for display.
// Pure, so the time zone and "now" are the caller's.

/** When a running day of Pro ends, or null when none is: absent, unreadable or already over. */
export function boostEndsAt(boostUntil: string | null | undefined, now: number = Date.now()): Date | null {
  if (!boostUntil) return null;
  const ends = new Date(boostUntil);
  return Number.isNaN(ends.getTime()) || ends.getTime() <= now ? null : ends;
}

/** "Tue, Oct 7, 3:45 PM": the end of a day of Pro, in this browser's time zone. */
export function proUntilLabel(until: Date | string): string {
  const date = typeof until === "string" ? new Date(until) : until;
  return date.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
