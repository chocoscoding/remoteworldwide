// Streak engine for the Job Seeker Dashboard.
//
// Pure, dependency-free helpers: tier lookup, milestone ladder, calendar
// layout and the mock-history generator. Nothing here touches React or the
// DOM — `StreakProvider` owns all the state, this file just does the maths.
//
// Every Tailwind class below is written out as a literal string inside a
// lookup map rather than assembled at runtime, so Tailwind's build-time
// scanner sees each one and no streak visual ever needs an inline `style`.

import type { StreakDay, StreakDayStatus, StreakMilestone, StreakState } from "./types";

// ---------------------------------------------------------------------------
// Date helpers — all local-time, no UTC conversion, so "today" means the
// user's today and a day key never drifts across a timezone boundary.
// ---------------------------------------------------------------------------

/** Local calendar date as `yyyy-mm-dd`. The canonical key for a day. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parses a `yyyy-mm-dd` key back into a local-midnight Date. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** `n` days after `d` (negative `n` goes backwards). Never mutates `d`. */
export function addDays(d: Date, n: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + n);
  return next;
}

/** Monday-first weekday index: Mon = 0 … Sun = 6. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** e.g. "August 2026" — the calendar's month caption. */
export function monthLabel(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** e.g. "Tue 25 Aug" — used in day tooltips and the milestone modal. */
export function shortDateLabel(key: string): string {
  const d = fromDayKey(key);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  return `${weekday} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

/** Monday-first weekday headers for the calendar grid. */
export const WEEKDAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

// ---------------------------------------------------------------------------
// Tiers — the visual escalation as a streak grows.
// ---------------------------------------------------------------------------

export interface StreakTier {
  id: string;
  /** Lowest streak length that qualifies for this tier. */
  min: number;
  label: string;
  /** The mark shown on the pill and the hero. */
  emoji: string;
  /**
   * Repeat level, for the open-ended tiers past 100 days. 1 for every named
   * tier; 2, 3, … for each further century so the ladder never dead-ends.
   */
  level: number;
  /** Chip background + text, for the header pill and tier badges. */
  chip: string;
  /** Flat offset shadow for the chip, matching the neobrutalist language. */
  shadow: string;
  /**
   * Interaction classes for the chip, in two stages:
   *
   * - **hover** grows the shadow by 0.5px. The chip itself does not move, so
   *   it reads as lifting off the surface rather than sliding across it.
   * - **active** presses it down: it translates by exactly the resting
   *   shadow's offset while that shadow collapses to nothing, landing flush
   *   against the surface. Translating without collapsing the shadow would
   *   just slide the chip — the shadow has to go for the eye to read it as
   *   being pushed *into* something.
   */
  press: string;
  /**
   * Fill for a completed day cell in the calendar, with a dark tick on top.
   *
   * Deliberately low-contrast tints that deepen with the tier. A month grid
   * is ~20 repeated units, so it has to read as quiet texture — a heat map
   * you scan — rather than compete with the reward ladder beside it, where
   * exactly one row (the rung in progress) is allowed to be loud. Every
   * value here still clears 4.5:1 against the tick.
   */
  cell: string;
  /** Seconds for one flicker cycle — hotter tiers flicker faster. */
  flickerSeconds: number;
}

/**
 * The ladder, coldest to hottest. Thresholds line up exactly with the reward
 * rungs, so reaching a tier and earning its reward are the same moment.
 *
 * Icons are drawn by `TierIcon`, not emoji — the old volcano/comet set was
 * off-metaphor and rendered differently on every platform.
 *
 * The palette walks the brand ramp rather than the usual orange/red fire
 * gradient, so a 100-day streak still reads as this product.
 */
export const STREAK_TIERS: StreakTier[] = [
  {
    id: "none",
    min: 0,
    label: "Not started",
    emoji: "🌑",
    level: 1,
    chip: "bg-[#f0f0ea] text-black/50 border-black/15",
    shadow: "shadow-none",
    press: "hover:shadow-[1px_1px_0_0_#222325] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none",
    cell: "bg-[#f0f0ea] text-black/30",
    flickerSeconds: 0,
  },
  {
    id: "warming",
    min: 1,
    label: "Warming up",
    emoji: "🔥",
    level: 1,
    chip: "bg-[#f6f7e8] text-[#222325] border-[#222325]",
    shadow: "shadow-[2px_2px_0_0_#222325]",
    press: "hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    cell: "bg-[#eef5da] text-[#222325]",
    flickerSeconds: 3.4,
  },
  {
    id: "spark",
    min: 3,
    label: "Spark",
    emoji: "🔥",
    level: 1,
    chip: "bg-[#eaf2b8] text-[#222325] border-[#222325]",
    shadow: "shadow-[2px_2px_0_0_#222325]",
    press: "hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    cell: "bg-[#e5f0c6] text-[#222325]",
    flickerSeconds: 3.0,
  },
  {
    id: "ember",
    min: 7,
    label: "Ember",
    emoji: "🔥",
    level: 1,
    chip: "bg-[#e1f073] text-[#222325] border-[#222325]",
    shadow: "shadow-[2px_2px_0_0_#222325]",
    press: "hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    cell: "bg-[#dbebb0] text-[#222325]",
    flickerSeconds: 2.6,
  },
  {
    id: "flame",
    min: 14,
    label: "Flame",
    emoji: "🔥",
    level: 1,
    chip: "bg-[#cddd54] text-[#222325] border-[#222325]",
    shadow: "shadow-[3px_3px_0_0_#222325]",
    press: "hover:shadow-[3.5px_3.5px_0_0_#222325] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
    cell: "bg-[#d0e69b] text-[#222325]",
    flickerSeconds: 2.2,
  },
  {
    id: "blaze",
    min: 30,
    label: "Blaze",
    emoji: "🔥",
    level: 1,
    chip: "bg-[#222325] text-[#e1f073] border-[#222325]",
    shadow: "shadow-[3px_3px_0_0_#e1f073]",
    press: "hover:shadow-[3.5px_3.5px_0_0_#e1f073] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
    cell: "bg-[#c6e087] text-[#222325]",
    flickerSeconds: 1.8,
  },
  {
    id: "wildfire",
    min: 60,
    label: "Wildfire",
    emoji: "🔥",
    level: 1,
    chip: "bg-[#222325] text-[#e1f073] border-[#e1f073]",
    shadow: "shadow-[3px_3px_0_0_#e1f073]",
    press: "hover:shadow-[3.5px_3.5px_0_0_#e1f073] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
    cell: "bg-[#bcda75] text-[#222325]",
    flickerSeconds: 1.4,
  },
  {
    id: "firestorm",
    min: 100,
    label: "Firestorm",
    emoji: "🔥",
    level: 1,
    chip: "bg-[#222325] text-[#e1f073] border-[#e1f073]",
    shadow: "shadow-[4px_4px_0_0_#e1f073]",
    press: "hover:shadow-[4.5px_4.5px_0_0_#e1f073] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
    cell: "bg-[#b2d463] text-[#222325]",
    flickerSeconds: 1.1,
  },
];

/** How often the ladder repeats once the named tiers run out. */
export const TIER_REPEAT_DAYS = 100;

/**
 * The hottest tier a streak qualifies for. Past the last named tier the ladder
 * keeps going: every further century is Firestorm at the next level, so a
 * long-running streak never hits a ceiling and stops meaning anything.
 */
export function tierFor(days: number): StreakTier {
  const top = STREAK_TIERS[STREAK_TIERS.length - 1];
  if (days >= top.min + TIER_REPEAT_DAYS) {
    const level = Math.floor(days / TIER_REPEAT_DAYS);
    return { ...top, min: level * TIER_REPEAT_DAYS, level, label: `${top.label} ${romanNumeral(level)}` };
  }
  let tier = STREAK_TIERS[0];
  for (const t of STREAK_TIERS) if (days >= t.min) tier = t;
  return tier;
}

/** The next tier up. Never null — the ladder is open-ended. */
export function nextTier(days: number): StreakTier {
  const named = STREAK_TIERS.find((t) => t.min > days);
  if (named) return named;
  const top = STREAK_TIERS[STREAK_TIERS.length - 1];
  const level = Math.floor(days / TIER_REPEAT_DAYS) + 1;
  return { ...top, min: level * TIER_REPEAT_DAYS, level, label: `${top.label} ${romanNumeral(level)}` };
}

/** Small numerals only — the ladder is open-ended but nobody reaches MMM. */
function romanNumeral(n: number): string {
  const table: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let left = n;
  for (const [value, glyph] of table) {
    while (left >= value) {
      out += glyph;
      left -= value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reward ladder
// ---------------------------------------------------------------------------

/**
 * Each rung fires exactly once, the day the streak first reaches `days`.
 * Credit amounts climb faster than the day counts so the later rungs stay
 * worth chasing.
 */
export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3, tierId: "spark", emoji: "🔥", label: "Spark", blurb: "Three days back to back.", credits: 2 },
  { days: 7, tierId: "ember", emoji: "🔥", label: "Ember", blurb: "Seven days without dropping it.", credits: 5, perk: "+1 streak freeze" },
  { days: 14, tierId: "flame", emoji: "🔥", label: "Flame", blurb: "A fortnight of showing up.", credits: 10, perk: "+1 streak freeze" },
  {
    days: 30,
    tierId: "blaze",
    emoji: "🔥",
    label: "Blaze",
    blurb: "Thirty days. This is a habit now.",
    credits: 25,
    // Deliberately not a free week of Pro. That lands on your most engaged
    // user at precisely the moment they were about to convert, and trades a
    // subscription for a week of goodwill. A permanent unlock rewards the
    // streak without cannibalising the upgrade.
    perk: "Unlimited resume tailoring, permanently",
  },
  { days: 60, tierId: "wildfire", emoji: "🔥", label: "Wildfire", blurb: "Sixty days of steady work.", credits: 50, perk: "+2 streak freezes" },
  { days: 100, tierId: "firestorm", emoji: "🔥", label: "Firestorm", blurb: "One hundred days. Very few get here.", credits: 100, perk: "Profile badge" },
];

/**
 * Rungs past the last fixed one, generated every 100 days so the ladder never
 * dead-ends. Credits keep climbing so the later rungs stay worth chasing.
 */
function generatedMilestone(level: number): StreakMilestone {
  const days = level * TIER_REPEAT_DAYS;
  return {
    days,
    tierId: "firestorm",
    emoji: "🔥",
    label: `Firestorm ${romanNumeral(level)}`,
    blurb: `${days} days. This is who you are now.`,
    credits: level * 100,
    perk: "+2 streak freezes",
  };
}

/** Every rung relevant to a streak of `days`, fixed plus generated. */
export function milestonesUpTo(days: number): StreakMilestone[] {
  const extraLevels = Math.max(0, Math.floor(days / TIER_REPEAT_DAYS) + 1 - 1);
  const generated = Array.from({ length: extraLevels }, (_, i) => generatedMilestone(i + 2)).filter((m) => m.days > 100);
  return [...STREAK_MILESTONES, ...generated];
}

/** The next unreached rung. Never null — the ladder is open-ended. */
export function nextMilestone(days: number): StreakMilestone {
  const fixed = STREAK_MILESTONES.find((m) => m.days > days);
  if (fixed) return fixed;
  return generatedMilestone(Math.floor(days / TIER_REPEAT_DAYS) + 1);
}

/**
 * Rungs crossed by growing from `from` to `to` that haven't been claimed yet.
 * Returns them in ascending order, so a single jump that clears two rungs
 * celebrates them in the order they were earned.
 */
export function milestonesCrossed(from: number, to: number, claimed: number[]): StreakMilestone[] {
  return milestonesUpTo(to).filter((m) => m.days > from && m.days <= to && !claimed.includes(m.days));
}

/** 0–100 progress from the previous rung to the next one. */
export function milestoneProgress(days: number): number {
  const next = nextMilestone(days);
  const prevRungs = milestonesUpTo(days).filter((m) => m.days <= days);
  const floor = prevRungs.length > 0 ? prevRungs[prevRungs.length - 1].days : 0;
  const span = next.days - floor;
  return span <= 0 ? 100 : Math.round(((days - floor) / span) * 100);
}

// ---------------------------------------------------------------------------
// Day-status presentation
// ---------------------------------------------------------------------------

/** How a day cell renders its contents. */
export type DayGlyphKind = "check" | "emoji" | "number";

export interface DayVisual {
  /**
   * `"check"` — render a solid tick icon (logged days).
   * `"emoji"` — render `glyph`.
   * `"number"` — render the date number.
   *
   * A `kind` rather than a glyph string because a logged day now renders a
   * lucide icon, and this module is deliberately React-free — it can describe
   * what to draw but must not return JSX.
   */
  kind: DayGlyphKind;
  /** Emoji shown when `kind` is `"emoji"`, otherwise "". */
  glyph: string;
  /** Cell background/border/text classes. */
  cell: string;
  /** Human-readable status for the cell's `title` and screen readers. */
  label: string;
}

/** Non-`done` statuses have fixed visuals; `done` takes its fill from the tier. */
const DAY_VISUALS: Record<Exclude<StreakDayStatus, "logged">, DayVisual> = {
  // Backfilled days count toward the streak but are drawn outlined rather
  // than filled, so a paid-for retroactive day is never passed off as one
  // you actually showed up for.
  backfilled: { kind: "check", glyph: "", cell: "bg-white text-[#222325] border-[#222325] border-dashed", label: "Backfilled" },
  rest: { kind: "emoji", glyph: "💤", cell: "bg-[#f0f0ea] text-black/40 border-transparent", label: "Rest day" },
  freeze: { kind: "emoji", glyph: "❄️", cell: "bg-[#e8eef7] text-[#2f5d8a] border-[#2f5d8a]/30", label: "Streak freeze used" },
  missed: { kind: "number", glyph: "", cell: "bg-white text-black/25 border-black/10 border-dashed", label: "Missed" },
  today: { kind: "number", glyph: "", cell: "bg-white text-[#222325] border-[#222325]", label: "Today — still open" },
  future: { kind: "number", glyph: "", cell: "bg-transparent text-black/20 border-transparent", label: "Upcoming" },
};

/**
 * Resolves a day to what it draws + the classes to draw it with. A logged day
 * takes its green fill from the current tier and marks itself with a solid
 * black tick; the tier ramp is floored so that tick clears 4.5:1 contrast even
 * at the darkest (Legend) green.
 */
export function dayVisual(status: StreakDayStatus, tier: StreakTier): DayVisual {
  if (status === "logged") return { kind: "check", glyph: "", cell: `${tier.cell} border-transparent`, label: "Logged" };
  return DAY_VISUALS[status];
}

// ---------------------------------------------------------------------------
// Streak arithmetic
// ---------------------------------------------------------------------------

/**
 * Counts back from the most recent day to find the live streak. `rest` and
 * `freeze` days are transparent — they neither add to the count nor end it.
 * An open `today` is skipped so the number doesn't drop to 0 every midnight.
 */
export function computeStreak(days: StreakDay[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const { status } = days[i];
    if (status === "logged" || status === "backfilled") streak += 1;
    else if (status === "rest" || status === "freeze" || status === "today") continue;
    else break;
  }
  return streak;
}

/** Longest `done` run anywhere in the history, with the same pass-through rules. */
export function computeLongest(days: StreakDay[]): number {
  let best = 0;
  let run = 0;
  for (const { status } of days) {
    if (status === "logged" || status === "backfilled") {
      run += 1;
      best = Math.max(best, run);
    } else if (status === "rest" || status === "freeze" || status === "today") {
      continue;
    } else {
      run = 0;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Calendar layout
// ---------------------------------------------------------------------------

export interface CalendarCell {
  key: string;
  date: Date;
  /** Null for days with no recorded history (before the window, or padding). */
  day: StreakDay | null;
  inMonth: boolean;
  isToday: boolean;
}

/**
 * Lays out one month as a Monday-first grid, padded with the surrounding
 * month's dates so every row holds seven cells. Days outside `byKey` fall
 * back to `future` when they're ahead of today, or `null` when they predate
 * the history window.
 */
export function buildMonthGrid(month: Date, byKey: Map<string, StreakDay>, today: Date): CalendarCell[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = addDays(first, -weekdayIndex(first));
  const todayKey = dayKey(today);

  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    const key = dayKey(date);
    const known = byKey.get(key);
    const isFuture = date.getTime() > today.getTime();
    return {
      key,
      date,
      day: known ?? (isFuture ? { date: key, status: "future" as const, count: 0 } : null),
      inMonth: date.getMonth() === month.getMonth(),
      isToday: key === todayKey,
    };
  });
}

// ---------------------------------------------------------------------------
// Mock history
// ---------------------------------------------------------------------------

/**
 * Deterministic 0–1 generator. Seeded off the day index so the generated
 * history is byte-identical on the server and on the client, which keeps
 * hydration quiet — `Math.random()` here would mismatch on every reload.
 */
function seeded(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export interface BuildHistoryOptions {
  /** Days of history to generate, ending today. */
  span?: number;
  /** Length of the unbroken run ending today. */
  currentStreak?: number;
  /** Monday-first indices treated as scheduled rest days. */
  restDays?: number[];
}

/**
 * Builds a believable history: an unbroken `currentStreak` run ending
 * yesterday (today is left open so the user has something to log), a clean
 * break before it, then sparser earlier activity with one absorbed freeze.
 */
export function buildStreakHistory(today: Date, options: BuildHistoryOptions = {}): StreakDay[] {
  const { span = 126, currentStreak = 12, restDays = [6] } = options;
  const days: StreakDay[] = [];

  for (let offset = span - 1; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    const key = dayKey(date);
    const isRest = restDays.includes(weekdayIndex(date));
    const roll = seeded(offset + 1);

    // Today is always left open — logging is what closes it.
    if (offset === 0) {
      days.push({ date: key, status: "today", count: 0 });
      continue;
    }

    // The live run: everything inside it is done, bar scheduled rest days.
    if (offset <= currentStreak) {
      days.push({ date: key, status: isRest ? "rest" : "logged", count: isRest ? 0 : 1 + Math.floor(roll * 3) });
      continue;
    }

    // The miss that ended the previous run.
    if (offset === currentStreak + 1) {
      days.push({ date: key, status: "missed", count: 0 });
      continue;
    }

    // One freeze absorbed a miss a few weeks back — shows the mechanic off.
    if (offset === currentStreak + 9) {
      days.push({ date: key, status: "freeze", count: 0 });
      continue;
    }

    if (isRest) {
      days.push({ date: key, status: "rest", count: 0 });
      continue;
    }

    // Earlier history: mostly active, thinning out the further back it goes.
    const activeChance = offset < span * 0.55 ? 0.82 : 0.55;
    days.push(
      roll < activeChance
        ? { date: key, status: "logged", count: 1 + Math.floor(seeded(offset + 99) * 3) }
        : { date: key, status: "missed", count: 0 }
    );
  }

  return days;
}

/**
 * Where the seeded demo streak starts. Deliberately one day short of the
 * 14-day rung: the very first "log today" both crosses a milestone and tips
 * the flame from Blaze to Inferno, so the reward system is reachable in a
 * mock build instead of being theoretical.
 */
export const SEEDED_STREAK = 13;

/**
 * The initial `StreakState` the provider seeds itself from.
 *
 * `buildStreakHistory`'s `currentStreak` counts *calendar* days, but rest
 * days inside the run are transparent to `computeStreak`, so a 13-day window
 * yields fewer than 13 burning days. Widen the window until the computed
 * streak actually lands on `SEEDED_STREAK` rather than hardcoding an offset
 * that silently drifts if the rest-day schedule ever changes.
 */
export function buildInitialStreak(today: Date, restDays: number[] = [5, 6]): StreakState {
  let days = buildStreakHistory(today, { restDays });
  for (let window = SEEDED_STREAK; window <= SEEDED_STREAK * 2; window++) {
    days = buildStreakHistory(today, { currentStreak: window, restDays });
    if (computeStreak(days) >= SEEDED_STREAK) break;
  }

  const current = computeStreak(days);
  return {
    current,
    longest: Math.max(computeLongest(days), current),
    freezes: 2,
    days,
    // Everything already earned by the seeded history counts as celebrated,
    // so opening the screen doesn't replay six old milestone modals.
    claimed: STREAK_MILESTONES.filter((m) => m.days <= current).map((m) => m.days),
    credits: 18,
  };
}
