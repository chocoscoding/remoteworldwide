// The win record — what "I got the job" actually captures.
//
// Everything on the shareable card comes from here, FROZEN at the moment the
// win is logged. The stats are a snapshot, not live reads, so the card a user
// shared in August still says what it said in August even after their tracker
// moves on. A real `wins` table replaces this module's constants and nothing
// else — the shapes are the schema.

export interface WinFacts {
  company: string;
  role: string;
  /** "2 August" — a label, not a Date. The card is a permanent artifact. */
  offerDateLabel: string;
}

/** The numbers shown back to the user — pulled, never typed. */
export interface WinStats {
  applications: number;
  interviewLoops: number;
  /** Final streak, retired automatically when the win is logged. */
  streak: number;
  referralsUsed: number;
  /** "+$12k" or null — optional in the log flow, hidden on the card by default. */
  salaryDelta: string | null;
}

/**
 * One step of the path they took — the tracker's journey, dated. This is what
 * the voice of the card is: not just "I got the job" but the road there.
 * Derived from the application's tracker history; the mock freezes the
 * Vercel card's story the same way `buildTimeline` derives from `daysAgo`.
 */
export interface WinJourneyStep {
  id: string;
  /** "24 Jun" — short, absolute. Relative labels rot on a shared image. */
  dateLabel: string;
  label: string;
}

export interface WinRecord {
  facts: WinFacts;
  stats: WinStats;
  journey: WinJourneyStep[];
  /** "What actually moved the needle for you?" — may be empty. */
  story: string;
  /** Default on — posts the story to the community without a name. */
  shareAnonymously: boolean;
  /** Default off — explicit consent for RWW to feature it with their name. */
  featureWithName: boolean;
}

/** What the card renderer may hide. Salary starts hidden — opt in, not out. */
export interface WinCardToggles {
  hideSalary: boolean;
  hideCompany: boolean;
  firstNameOnly: boolean;
}

export const DEFAULT_TOGGLES: WinCardToggles = { hideSalary: true, hideCompany: false, firstNameOnly: false };

/** The three render sizes — same card, three canvases. */
export type WinCardFormat = "landscape" | "square" | "story";

export const CARD_DIMENSIONS: Record<WinCardFormat, { width: number; height: number; label: string; hint: string }> = {
  landscape: { width: 1200, height: 627, label: "Landscape", hint: "LinkedIn · X" },
  square: { width: 1080, height: 1080, label: "Square", hint: "WhatsApp · feed" },
  story: { width: 1080, height: 1920, label: "Story", hint: "IG · status" },
};

// ---------------------------------------------------------------------------
// Mock source data — pre-filled from the tracker's Vercel application, which
// is the one the rest of the dashboard already treats as the win.
// ---------------------------------------------------------------------------

/** Pulled stats, shown back in step two — the user types none of these. */
export const WIN_STATS_PULL: Omit<WinStats, "streak" | "salaryDelta"> = {
  applications: 34,
  interviewLoops: 3,
  referralsUsed: 1,
};

export const WIN_SALARY_PREFILL = "+$12k";

// ---------------------------------------------------------------------------
// Share copy
// ---------------------------------------------------------------------------

export const WIN_REFERRAL_LINK = "remoteworldwide.net/j/amara";

/** First name only, for the card toggle — "Amara Okafor" -> "Amara". */
export const firstNameOf = (name: string) => name.split(" ")[0] ?? name;

/**
 * The pre-written caption. One body, small per-platform framing — the
 * platforms differ in what a composer will accept, not in what the story is.
 */
export function winCaption(win: WinRecord, toggles: WinCardToggles): string {
  const where = toggles.hideCompany ? win.facts.role : `${win.facts.role} at ${win.facts.company}`;
  return (
    `I got the job \u{1F389} ${where} — ${win.stats.applications} applications, ` +
    `${win.stats.interviewLoops} interview loops and a ${win.stats.streak}-day streak, tracked end to end. ` +
    `If you're searching, this is where I did it: https://${WIN_REFERRAL_LINK}`
  );
}
