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
  /** A year paid up front (backend: 10% off twelve months unless set by hand); 0 for Free. */
  yearlyPriceCents: number;
  monthlyCredits: number;
  features: string[];
  prioritySupport: boolean;
}

/** How a paid plan is paid for. Its credits refill every month either way. */
export type BillingInterval = "month" | "year";

export interface CreditPack {
  key: string;
  name: string;
  credits: number;
  priceCents: number;
}

/** The four plan tiers, cheapest first. Free is everyone without an active paid plan. */
export const PLAN_TIERS = ["free", "pro", "ultra"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export interface Subscription {
  planKey: string | null;
  pendingPlanKey: string | null;
  /** The tier the account counts as for plan gates (backend `tierOf`). */
  tier: PlanTier;
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
  cancelAtPeriodEnd: boolean;
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
}

export interface BillingOverview {
  subscription: Subscription;
  plan: Plan | null;
  plans: Plan[];
  creditPacks: CreditPack[];
  invoices: Checkout[];
  ledger: LedgerEntry[];
}
