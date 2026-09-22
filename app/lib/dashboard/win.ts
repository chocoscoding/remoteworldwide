// The win record — what "I got the job" actually captures.
//
// Everything on the shareable card comes from here, FROZEN at the moment the
// win is logged. The stats are a snapshot, not live reads, so the card a user
// shared in August still says what it said in August even after their tracker
// moves on. The numbers are pulled from the user's own data at log time
// (`pullWinStats`) and the link is their real invite link. There is no `wins`
// table yet, so a record lives as long as the session; the shapes are the
// schema one would take.

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
 * Seeded from the application's tracker history in the win log, the same way
 * `buildTimeline` derives from `daysAgo`, and completed by the user.
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
// Pulled stats — read off the user's own data at log time, never typed
// ---------------------------------------------------------------------------

/** The slice of the applications summary the stats read: the server's funnel. */
export interface WinFunnelStages {
  stages: ReadonlyArray<{ id: string; reached: number }>;
}

/** The slice of a recorded referral ask the stats read. */
export interface WinReferralAsk {
  job: { company: string } | null;
}

/**
 * The numbers step three shows back. Applications and interview loops come
 * from the server's funnel over the whole applications table (`reached` counts
 * every application whose furthest stage got at least that far, so a rejection
 * after two rounds still counts as a loop); referrals are the asks the user
 * recorded for the winning company. Either source still loading reads as 0
 * rather than a guess — the dialog says so while it waits.
 */
export function pullWinStats(
  funnel: WinFunnelStages | undefined,
  referralAsks: readonly WinReferralAsk[] | undefined,
  company: string,
): Omit<WinStats, "streak" | "salaryDelta"> {
  const reached = (id: string) => funnel?.stages.find((s) => s.id === id)?.reached ?? 0;
  const key = company.trim().toLowerCase();
  return {
    applications: reached("applied"),
    interviewLoops: reached("interviewing"),
    referralsUsed: key ? (referralAsks ?? []).filter((ask) => ask.job?.company.trim().toLowerCase() === key).length : 0,
  };
}

// ---------------------------------------------------------------------------
// Share copy
// ---------------------------------------------------------------------------

/**
 * What a logged win posts to the pod (POST /api/pod/wins). The role and
 * company ARE the identity of the win, so the server's idempotency key is
 * built from them: a double submit or a retry lands on the same key and the
 * pod goal moves once. Same key formula as LivePodProvider's, so the two
 * paths dedupe against each other; cut to the validator's 120 characters.
 * What's moving prints no author for the others, so the text names the
 * winner by first name when the profile has one.
 */
export function podWinBody(win: WinRecord, ownerName: string): { text: string; ref: string } {
  const who = ownerName.trim() ? `${firstNameOf(ownerName.trim())} landed` : "Landed";
  return {
    text: `${who} ${win.facts.role} at ${win.facts.company} \u{1F389}`,
    ref: `${win.facts.company}:${win.facts.role}`.toLowerCase().replace(/\s+/g, "-").slice(0, 120),
  };
}

/** First name only, for the card toggle — "Ada Obi" -> "Ada". */
export const firstNameOf = (name: string) => name.split(" ")[0] ?? name;

/**
 * Attribution rides the shared link, per platform, so referral signups can be
 * traced back to the share that brought them in. The on-screen preview stays
 * clean. `link` is the user's own invite link (useInviteLink), absolute.
 */
export function trackedLink(link: string, utmSource: string | undefined, medium: string): string {
  if (!utmSource) return link;
  const sep = link.includes("?") ? "&" : "?";
  return `${link}${sep}utm_source=${encodeURIComponent(utmSource)}&utm_medium=${medium}&utm_campaign=placement`;
}

/**
 * The pre-written caption. One body, small per-platform framing — the
 * platforms differ in what a composer will accept, not in what the story is.
 */
export function winCaption(win: WinRecord, toggles: WinCardToggles, link: string, utmSource?: string): string {
  const where = toggles.hideCompany ? win.facts.role : `${win.facts.role} at ${win.facts.company}`;
  return (
    `I got the job \u{1F389} ${where} — ${win.stats.applications} applications, ` +
    `${win.stats.interviewLoops} interview loops and a ${win.stats.streak}-day streak, tracked end to end. ` +
    `If you're searching, this is where I did it: ${trackedLink(link, utmSource, "wincard")}`
  );
}
