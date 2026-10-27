export type Currency = "USD" | "GBP" | "EUR" | "NGN";
export type RemotePolicy = "anywhere" | "overlap" | "region";
export type Availability = "immediately" | "two-weeks" | "month" | "browsing";
/**
 * How far along you are. Ordered, and the order is the meaning: pod matching reads the position to
 * decide whether you would arrive as the most, the median or the least experienced in a pod, and
 * caps how many of any one band a pod can hold. "" means not said, and matching falls back to
 * reading your headline.
 */
export type ExperienceBand = "intern" | "entry" | "mid" | "senior" | "lead";

export interface ProfileSettings {
  /** Resolved server-side: a signed CDN URL for an upload, or the OAuth photo as-is. */
  avatarUrl: string;
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  timezone: string;
  summary: string;
  portfolio: string;
  linkedin: string;
  github: string;
  skills: string[];
  /**
   * The same skills as the resume editor's entries (onboarding edits these): a skill, or a name over
   * its sub skills. A save that sends them rewrites `skills` from them. Optional: a profile from
   * before entries, or an older backend, has none, and reads `skills` as one entry each.
   */
  skillEntries?: ProfileSkillEntry[];
  /**
   * Where you studied, in the order entered. Saved whole, like `skills`: PUT /api/settings/profile
   * replaces the array. The backend always sends it (default []); optional here because a settings
   * object persisted to disk before it existed, or an older backend, does not carry it — read it as
   * `profile.education ?? []`.
   */
  education?: ProfileEducation[];
  /**
   * Where you have worked, in the order entered (most recent first, by convention). Saved whole
   * like `education`. Optional on the profile (owner, 2026-09-27: "experience not required, can be
   * skipped"): it is not a checklist item. The backend always sends it (default []); optional here
   * for a settings object persisted before it, or an older backend — read it as
   * `profile.experience ?? []`.
   */
  experience?: ProfileExperience[];
}

/**
 * One role on the profile. Mirrors the backend's `profile.experience` entry: every field trimmed,
 * a non-empty `company` OR `title` required (each ≤160), dates ≤60, location ≤120, at most 12
 * bullets of ≤500 (empty ones dropped), at most 20 entries. No id, like education.
 */
export interface ProfileExperience {
  company: string;
  title: string;
  dates: string;
  location: string;
  bullets: string[];
}

/**
 * One school on the profile. Mirrors the backend's `profile.education` entry: trimmed, `school`
 * required (≤160), the rest may be "" (degree ≤160, dates ≤60, location ≤120, detail ≤500), at
 * most 10 entries. No id: the list is replaced whole on save, so an editor keys its own rows.
 */
/** One Skills entry on the profile. Saved ones have no id; an unsaved edit in Settings keeps the editor's. */
export interface ProfileSkillEntry {
  id?: string;
  title: string;
  skills: string[];
  hidden?: boolean;
}

export interface ProfileEducation {
  school: string;
  degree: string;
  dates: string;
  location: string;
  detail: string;
}

/**
 * The profile checklist — the backend's `evaluateOnboarding()` (remoteworldwidebackend
 * `src/services/onboardingReadiness.ts`, contract `src/types/onboarding.ts`), seven items in its fixed
 * order. Guidance, never a lock (owner, 2026-09-26): nothing waits on it. A resume is not one — a
 * resume can be built from these facts, so onboarding only OFFERS to start from one — and phone is
 * asked for, never required. Each id is also the `/dashboard/onboarding#<id>` deep link to its field,
 * which the extension and chat link to when an item is missing. Work experience is on the form
 * (`#experience`) but is not an item: it can be skipped (owner, 2026-09-27).
 */
export type OnboardingItemId = "fullName" | "email" | "summary" | "education" | "headline" | "location" | "skills";

export interface OnboardingItem {
  id: OnboardingItemId;
  /** Short and user-facing ("About you", "At least 3 skills"). The server owns the wording. */
  label: string;
  done: boolean;
}

export interface Onboarding {
  /** Every item done: the dashboard banner goes, and the extension stops pointing at what's missing. */
  ready: boolean;
  items: OnboardingItem[];
  missing: OnboardingItemId[];
}

export interface JobPreferences {
  targetRoles: string[];
  experienceLevel: ExperienceBand | "";
  minSalary: number;
  currency: Currency;
  remotePolicy: RemotePolicy;
  availability: Availability;
  openToContract: boolean;
  openToRelocation: boolean;
}

export interface NotificationSettings {
  emailWeeklyDigest: boolean;
  emailReplyAlerts: boolean;
  emailPodActivity: boolean;
  emailProductNews: boolean;
  emailOffers: boolean;
  pushStreakReminder: boolean;
  pushInterviewReminder: boolean;
}

export interface PrivacySettings {
  discoverableByRecruiters: boolean;
  showProfileToPod: boolean;
  shareOutcomesAnonymously: boolean;
  allowResumeIndexing: boolean;
  allowAiCoaching: boolean;
}

/**
 * How a form-filling browser extension may use the saved-answer library. Saved on the account
 * (PUT /api/settings/extension) because no extension exists yet: the choice is made now and read
 * by whatever fills forms later. There is deliberately no "connected" field — nothing reports in.
 */
export interface ExtensionSettings {
  /**
   * Type profile values and saved answers in as a form loads. Off by default: otherwise nothing is
   * filled until the user presses the extension's button on the form and picks a source. A saved
   * draft is never filled on load either way.
   */
  fillOnLoad: boolean;
  /** Draft an answer for a question it has never seen, labelled for the user to check. */
  draftNewQuestions: boolean;
  /** Fill demographic questions from saved answers. Off by default; never guessed either way. */
  fillDemographics: boolean;
}

export interface Settings {
  profile: ProfileSettings;
  preferences: JobPreferences;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  extension: ExtensionSettings;
  updatedAt: Date | null;
  /**
   * Worked out on every read and every save (it is never stored), so a profile save's answer
   * already carries the new checklist. Absent — an older backend, a cache persisted before it —
   * reads as "nothing to nag about": the banner hides, the same fail-open rule the extension follows.
   */
  onboarding?: Onboarding;
}

export type SubscriptionStatus = "none" | "pending" | "active" | "past_due" | "canceled";
// "reward": credits paid for an action, e.g. answering a recommendation's questions (`rec-answers:{id}`).
export type LedgerReason = "plan_grant" | "purchase" | "spend" | "refund" | "adjustment" | "reward";
export type CheckoutStatus = "pending" | "completed" | "canceled" | "failed";

export interface Plan {
  key: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: string;
  /** Three months paid up front; 0 for Free. Absent from an older backend. */
  quarterlyPriceCents?: number;
  /** A year paid up front; 0 for Free. */
  yearlyPriceCents: number;
  monthlyCredits: number;
  features: string[];
  prioritySupport: boolean;
}

/**
 * How a paid plan is paid for. Its credits refill every month on all three; on quarterly, unused
 * allowance rolls over until the quarter ends.
 */
export type BillingInterval = "month" | "quarter" | "year";

export interface CreditPack {
  key: string;
  name: string;
  credits: number;
  priceCents: number;
}

/**
 * The four plan tiers, cheapest first (backend config/billing.ts PLAN_KEYS). Free is everyone
 * without an active paid plan. Basic adds no ads and the resume AI, Pro interview prep, Ultra the
 * most credits.
 */
export const PLAN_TIERS = ["free", "basic", "pro", "ultra"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/** Each tier as the site names it. */
export const PLAN_TIER_NAMES: Record<PlanTier, string> = { free: "Free", basic: "Basic", pro: "Pro", ultra: "Ultra" };

export const isPlanTier = (value: unknown): value is PlanTier => typeof value === "string" && (PLAN_TIERS as readonly string[]).includes(value);

/** True when `tier` is `min` or above. A tier this build doesn't know counts as below every tier. */
export const tierAllows = (tier: unknown, min: PlanTier): boolean => isPlanTier(tier) && PLAN_TIERS.indexOf(tier) >= PLAN_TIERS.indexOf(min);

/** The lowest tier that never sees ads (app/lib/ads.ts); Free and signed-out visitors do. */
export const AD_FREE_FROM: PlanTier = "basic";

/**
 * The plan the upgrade popup puts forward: the one a refusal names, or else the next tier up. Null
 * when that is not above the account's own tier, so Ultra out of credits is offered packs only.
 */
export const upgradeTierFor = (tier: PlanTier, requiredPlan?: string | null): PlanTier | null => {
  const wanted = isPlanTier(requiredPlan) ? requiredPlan : PLAN_TIERS[PLAN_TIERS.indexOf(tier) + 1];
  return wanted && PLAN_TIERS.indexOf(wanted) > PLAN_TIERS.indexOf(tier) ? wanted : null;
};

/**
 * The plan the popup leads with (owner, 2026-10-17: get people onto at least Pro). Below Pro, any
 * offer under Pro is led by Pro, with the smaller plan kept as the second choice; from Pro up the
 * offer stands. Null when there is no offer.
 */
export const RECOMMENDED_TIER: PlanTier = "pro";
export const leadTierFor = (tier: PlanTier, offered: PlanTier | null): { lead: PlanTier; alternative: PlanTier | null } | null => {
  if (!offered) return null;
  const rank = (t: PlanTier) => PLAN_TIERS.indexOf(t);
  if (rank(offered) < rank(RECOMMENDED_TIER) && rank(tier) < rank(RECOMMENDED_TIER)) return { lead: RECOMMENDED_TIER, alternative: offered };
  return { lead: offered, alternative: null };
};

/**
 * Where every "get more credits" link lands: the plan cards on Billing, since a plan is always the
 * cheaper way to buy credits. Packs sit just below them on the same screen.
 */
export const PLANS_HREF = "/dashboard/settings/billing#plans";

/** A feature the AI service counts free monthly uses of (planService FREE_MONTHLY). */
export type FreeFeature = "resumeBuild" | "resumeHelp" | "prep" | "likelyQuestions" | "coach" | "voiceTalk" | "planAccept";

export interface FreeAllowance {
  feature: FreeFeature;
  /** The plan where the count stops. */
  plan: PlanTier;
  allowance: number;
  used: number;
  left: number;
}

/** GET /api/ai/plan/usage: only the features the account is below; empty from Pro up or when unknown. */
export interface FreeUsage {
  tier: PlanTier | null;
  /** `YYYY-MM`, UTC. */
  month: string;
  features: FreeAllowance[];
}

/** "1 of 1 free interview prep session used this month" style counter text, kept short. */
export const freeLeftLabel = (a: FreeAllowance, noun: string): string =>
  a.left > 0 ? `${a.left} of ${a.allowance} free ${noun} left this month` : `You've used this month's free ${noun}`;

/** When this month's free uses come back: the 1st of next month (UTC), as "Nov 1". */
export const freeResetsLabel = (month: string): string => {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return "next month";
  return new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

export interface Subscription {
  planKey: string | null;
  pendingPlanKey: string | null;
  /**
   * The tier the account counts as for plan gates (backend `effectiveTier`): the plan paid for,
   * raised while a streak gift's day of Pro runs (`boostUntil`). `planKey` stays the plan paid for.
   */
  tier: PlanTier;
  /** When a day of Pro from a streak gift ends (ISO), or null when none is running. Absent from an older backend. */
  boostUntil?: string | null;
  status: SubscriptionStatus;
  interval: BillingInterval;
  /** The billing of the plan waiting on payment, beside `pendingPlanKey`. */
  pendingInterval: BillingInterval | null;
  creditBalance: number;
  monthlyCredits: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  /** When a yearly plan's next month of credits lands; null when a payment is what renews them. */
  nextRefillAt: Date | null;
  /** Credits spent this period, net of refunds (billing overview only; absent on an older backend). */
  periodSpent?: number;
  cancelAtPeriodEnd: boolean;
  /** A shorter billing booked for when this period ends (quarterly back to monthly); absent on an older backend. */
  scheduledInterval?: BillingInterval | null;
  provider: string | null;
}

export interface LedgerEntry {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: LedgerReason;
  feature: string | null;
  createdAt: Date;
}

export interface Checkout {
  id: string;
  kind: "subscription" | "credits";
  planKey: string | null;
  interval: BillingInterval;
  packKey: string | null;
  credits: number;
  amountCents: number;
  currency: string;
  status: CheckoutStatus;
  completedAt: Date | null;
  createdAt: Date;
  /** Where to pay: Stripe Checkout, or the invoice page when an upgrade needs a card check. Absent while payments are off. */
  url?: string;
  /** An upgrade of a Stripe subscription that was charged and applied in place: no page to visit. */
  upgraded?: boolean;
  /** A billing switch booked for the period's end (`at`), or called off (`at` null). Nothing charged. */
  scheduled?: boolean;
  at?: string | null;
}

export interface BillingOverview {
  subscription: Subscription;
  plan: Plan | null;
  plans: Plan[];
  creditPacks: CreditPack[];
  invoices: Checkout[];
  ledger: LedgerEntry[];
  /**
   * Whether the backend locks features below their tier (PLAN_GATES_ENABLED). False unlocks every
   * control the site locks by plan; absent (an older backend) reads as on.
   */
  planGates?: boolean;
  /** Whether card payments are on (Stripe). Off, choosing a plan only reserves it. */
  payments?: boolean;
  /** Whether this account has a Stripe customer, so "Manage billing" has something to open. */
  manageBilling?: boolean;
}
