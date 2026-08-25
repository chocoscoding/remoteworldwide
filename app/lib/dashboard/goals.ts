// Weekly-goal maths.
//
// The bug this file fixes: the old card showed a weekly target of 8 next to a
// daily habit of "apply to 1 role", with Sat/Sun rested. That's 1.6/day — so a
// user could hit their daily habit five days running and still miss the week,
// and nothing in the UI ever said so. `dailyMath` makes the derivation visible.

// ---------------------------------------------------------------------------
// Target range
// ---------------------------------------------------------------------------

export const TARGET_MIN = 1;
/** High-volume applying is a legitimate strategy; the old cap of 20 wasn't. */
export const TARGET_MAX = 400;

/**
 * Above this, the UI stops calling applications "quality" and switches to
 * reporting tailoring rate + median ATS instead. At 60+/week nobody is
 * individually crafting each one, and claiming otherwise is dishonest.
 */
export const HIGH_VOLUME_THRESHOLD = 50;

/**
 * The buttons always move by one. Bigger jumps are handled by holding the
 * button down (which repeats) or by typing the number directly — an adaptive
 * step that silently changed size under the cursor made the control feel
 * unpredictable at the boundaries.
 */
export const TARGET_STEP = 1;

export function clampTarget(n: number): number {
  if (Number.isNaN(n)) return TARGET_MIN;
  return Math.max(TARGET_MIN, Math.min(TARGET_MAX, Math.round(n)));
}

// ---------------------------------------------------------------------------
// Daily derivation
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface DailyMath {
  /** Working days per week, after rest days. */
  workingDays: number;
  /** Applications per working day, rounded up — you can't send 1.6. */
  perDay: number;
  /** Exact figure, for the "1.6" in the caption. */
  perDayExact: number;
  /** e.g. "Mon–Fri", or "Mon, Wed, Fri" when the rest days aren't contiguous. */
  dayRange: string;
  /** The full sentence, e.g. "8 / week = 2 a day, Mon–Fri". */
  sentence: string;
}

/**
 * `restDays` are Monday-first indices (Mon = 0 … Sun = 6), matching
 * `weekdayIndex` in `streak.ts`.
 */
export function dailyMath(target: number, restDays: Set<number> | number[]): DailyMath {
  const rest = restDays instanceof Set ? restDays : new Set(restDays);
  const working = DAY_NAMES.map((_, i) => i).filter((i) => !rest.has(i));
  const workingDays = working.length;

  if (workingDays === 0) {
    return {
      workingDays: 0,
      perDay: 0,
      perDayExact: 0,
      dayRange: "no working days",
      sentence: "Every day is a rest day — no applications scheduled.",
    };
  }

  const perDayExact = target / workingDays;
  const perDay = Math.ceil(perDayExact);

  // Contiguous runs read as a range; anything else lists the days.
  const contiguous = working.every((d, i) => i === 0 || d === working[i - 1] + 1);
  const dayRange =
    workingDays === 7
      ? "every day"
      : contiguous && workingDays > 1
        ? `${DAY_NAMES[working[0]]}–${DAY_NAMES[working[workingDays - 1]]}`
        : working.map((d) => DAY_NAMES[d]).join(", ");

  return {
    workingDays,
    perDay,
    perDayExact,
    dayRange,
    sentence: `${target} / week = ${perDay} a day, ${dayRange}`,
  };
}

/** "Sat & Sun are rest days — your streak is safe." */
export function restDaySentence(restDays: Set<number> | number[]): string | null {
  const rest = (restDays instanceof Set ? [...restDays] : [...restDays]).sort((a, b) => a - b);
  if (rest.length === 0) return null;
  const names = rest.map((d) => DAY_NAMES[d]);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  return `${list} ${names.length === 1 ? "is a rest day" : "are rest days"} — your streak is safe.`;
}

// ---------------------------------------------------------------------------
// Time estimate
// ---------------------------------------------------------------------------

/**
 * Fallback when the user hasn't logged enough applications for a personal
 * median yet. The old code used a bare `13.33` with no comment and no
 * calibration; this at least says what it is and gets replaced by real data
 * after a few logs.
 */
export const DEFAULT_LOG_SECONDS = 800; // ~13m20s, the old magic number, made explicit

/**
 * "3 to go — about 40 minutes". Formats in hours above 90 minutes, because
 * "about 340 minutes" is not a unit anybody thinks in.
 */
export function estimateLabel(toGo: number, medianLogSeconds: number): string {
  if (toGo <= 0) return "Goal hit for the week";

  const seconds = toGo * (medianLogSeconds > 0 ? medianLogSeconds : DEFAULT_LOG_SECONDS);
  const minutes = Math.round(seconds / 60);

  if (minutes < 90) {
    const rounded = Math.max(5, Math.round(minutes / 5) * 5);
    return `${toGo} to go — about ${rounded} minutes`;
  }

  const hours = seconds / 3600;
  // Half-hour precision below 10 hours, whole hours above.
  const shown = hours < 10 ? Math.round(hours * 2) / 2 : Math.round(hours);
  return `${toGo} to go — about ${shown} hour${shown === 1 ? "" : "s"}`;
}
