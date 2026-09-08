export type Currency = "USD" | "GBP" | "EUR" | "NGN";
export type RemotePolicy = "anywhere" | "overlap" | "region";
export type Availability = "immediately" | "two-weeks" | "month" | "browsing";

export interface ProfileSettings {
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
}

export interface Settings {
  profile: ProfileSettings;
  preferences: JobPreferences;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  updatedAt: Date | null;
}

export type SubscriptionStatus = "none" | "pending" | "active" | "past_due" | "canceled";
export type LedgerReason = "plan_grant" | "purchase" | "spend" | "refund" | "adjustment";
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
