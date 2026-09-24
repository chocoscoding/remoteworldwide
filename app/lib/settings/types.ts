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
  monthlyCredits: number;
  features: string[];
  prioritySupport: boolean;
}

export interface CreditPack {
  key: string;
  name: string;
  credits: number;
  priceCents: number;
}

export interface Subscription {
  planKey: string | null;
  pendingPlanKey: string | null;
  status: SubscriptionStatus;
  creditBalance: number;
  monthlyCredits: number;
  periodStart: Date | null;
  periodEnd: Date | null;
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
