// One person's mail, as the admin's users screens read it, and the billing page's personal offer.
// Mirrors the backend's mail routes (MAIL-BUILD-SPEC.md section 7): GET
// /api/admin/mail/analytics/users/:id and /users/:id/events (backend services/mail/analyticsService.ts),
// the users list's `mail` field, GET /api/mail/offers/current, and the public feedback and
// unsubscribe-reason routes. The Mail section's own types are app/lib/mail/types.ts.

// ---------------------------------------------------------------------------------------------
// Engagement level (backend services/mail/engagement.ts)

export const MAIL_LEVELS = ["engaged", "reading", "quiet", "unreachable", "none"] as const;
export type MailLevel = (typeof MAIL_LEVELS)[number];

export const isMailLevel = (value: unknown): value is MailLevel => typeof value === "string" && (MAIL_LEVELS as readonly string[]).includes(value);

export const MAIL_LEVEL_LABELS: Record<MailLevel, string> = {
  engaged: "Engaged",
  reading: "Reading",
  quiet: "Quiet",
  unreachable: "Unreachable",
  none: "Never mailed",
};

export const MAIL_LEVEL_HINTS: Record<MailLevel, string> = {
  engaged: "Clicked a mail in the last 30 days",
  reading: "Opened a mail in the last 30 days, no clicks",
  quiet: "Mailed, but nothing opened or clicked in the last 30 days",
  unreachable: "Bounced, complained, suppressed, or every marketing mail switched off",
  none: "Never mailed",
};

export const MAIL_LEVEL_STYLE: Record<MailLevel, string> = {
  engaged: "border-black bg-[#e1f073] text-black",
  reading: "border-[#c5d5ee] bg-[#e2ebf8] text-[#1c3d6e]",
  quiet: "border-gray-300 bg-gray-100 text-gray-700",
  unreachable: "border-[#f3c4b8] bg-[#fdeae6] text-[#b23c26]",
  none: "border-gray-300 bg-white text-gray-500",
};

/** What the users list's rows carry (GET /api/admin/analytics/users). Absent from an older backend. */
export interface UserMailBrief {
  level: MailLevel;
  lastClickAt: string | null;
  sent30d: number;
}

// ---------------------------------------------------------------------------------------------
// Sends, playbooks, offers, feedback (GET /api/admin/mail/analytics/users/:id)

export type MailSource = "product" | "campaign" | "playbook" | "test" | "reply";
export const MAIL_SOURCE_LABELS: Record<MailSource, string> = { product: "Product", campaign: "Campaign", playbook: "Playbook", test: "Test", reply: "Reply" };

export const FEEDBACK_FACES = ["great", "good", "meh", "bad"] as const;
export const FEEDBACK_USEFUL = ["yes", "no"] as const;
export type FeedbackFace = (typeof FEEDBACK_FACES)[number];
export type FeedbackAnswer = FeedbackFace | (typeof FEEDBACK_USEFUL)[number];

export const isFeedbackAnswer = (value: unknown): value is FeedbackAnswer =>
  typeof value === "string" && ([...FEEDBACK_FACES, ...FEEDBACK_USEFUL] as readonly string[]).includes(value);

/** The four faces of a "How is it going?" mail and the Yes / No of the "Was this useful?" footer. */
export const FEEDBACK_LABELS: Record<FeedbackAnswer, { emoji: string | null; label: string }> = {
  great: { emoji: "😀", label: "Great" },
  good: { emoji: "🙂", label: "Good" },
  meh: { emoji: "😐", label: "Meh" },
  bad: { emoji: "🙁", label: "Bad" },
  yes: { emoji: null, label: "Yes" },
  no: { emoji: null, label: "No" },
};

/** The one optional follow-up the thank-you page asks (MAIL-PLAN.md 5.4). */
export function feedbackQuestion(answer: FeedbackAnswer): string {
  if (answer === "great" || answer === "good") return "What do you like most?";
  if (answer === "meh" || answer === "bad") return "What should we fix first?";
  if (answer === "yes") return "What made it useful?";
  return "What would have made it useful?";
}

export interface UserMailLink {
  url: string;
  clicks: number;
  firstAt: string | null;
}

export interface UserMailSend {
  id: string;
  subject: string;
  src: MailSource;
  kind: string;
  sentAt: string | null;
  deliveredAt: string | null;
  opens: number;
  clicks: number;
  links: UserMailLink[];
  feedback: FeedbackAnswer | null;
  repliedAt: string | null;
  bouncedAt: string | null;
  campaignName: string | null;
  playbookName: string | null;
  // Read when the backend sends them; the contract's list stops above.
  status?: "queued" | "sent" | "failed";
  bounceType?: string | null;
  complainedAt?: string | null;
  unsubscribedAt?: string | Date | null;
  visitedAt?: string | null;
  failReason?: string | null;
}

export type MailRunStatus = "active" | "waiting" | "done" | "exited" | "failed" | "holdout";
export const MAIL_RUN_STATUS_LABELS: Record<MailRunStatus, string> = {
  active: "Running",
  waiting: "Waiting",
  done: "Finished",
  exited: "Left",
  failed: "Failed",
  holdout: "Holdout, no mail",
};

export interface UserMailRun {
  playbookId: string;
  name: string;
  status: MailRunStatus;
  /** The step they are on: its label or id, or its index from 0. */
  step: string | number | null;
  nextAt: string | null;
  enteredBy: { kind: "action" | "event" | "audience"; key: string; detail?: unknown } | null;
  enteredAt?: string | null;
}

/** A mail_offer_grants row: a personal code. `_id` when the backend sends the row as stored. */
export interface UserMailGrant {
  id?: string;
  _id?: string;
  offerId?: string;
  offerName?: string | null;
  code: string;
  discountLabel: string;
  expiresAt: string;
  clickedAt: string | null;
  redeemedAt: string | null;
  discountCents?: number | null;
  revenueCents?: number | null;
  holdout?: boolean;
  createdAt?: string | Date;
}

export const UNSUBSCRIBE_REASONS = ["too_many", "not_relevant", "found_job", "never_signed_up", "other"] as const;
export type UnsubscribeReason = (typeof UNSUBSCRIBE_REASONS)[number];
export const UNSUBSCRIBE_REASON_LABELS: Record<UnsubscribeReason, string> = {
  too_many: "Too many emails",
  not_relevant: "Not relevant to me",
  found_job: "I found a job",
  never_signed_up: "I never signed up",
  other: "Something else",
};

/** A mail_feedback row: a face, a Yes / No, or why they unsubscribed. */
export interface UserMailFeedback {
  id?: string;
  _id?: string;
  sendId: string | null;
  kind: "faces" | "useful" | "unsubscribe_reason";
  answer: string;
  comment: string | null;
  pref?: string | null;
  at: string;
  subject?: string | null;
}

export interface UserMailDetail {
  level: MailLevel;
  tiles: { sent30d: number; opened30d: number; clicked30d: number; replied: number; conversions: number };
  /** Newest first. */
  sends: UserMailSend[];
  runs: UserMailRun[];
  offers: UserMailGrant[];
  feedback: UserMailFeedback[];
  /** Their mail switches (user_settings.notifications), defaults filled in. */
  prefs: Record<string, boolean>;
  suppressed: { at: string; reason: string } | null;
  /** Optional: the last 12 weeks, oldest first; `week` is the week's first UTC day (or an ISO week like 2026-W44). */
  weekly?: Array<{ week: string; sent: number; opened: number; clicked: number }>;
}

/** The notification switches by name, in the settings screen's order. */
export const MAIL_PREF_LABELS: Record<string, string> = {
  emailOffers: "Offers and early access",
  emailProductNews: "Product news",
  emailWeeklyDigest: "Weekly digest",
  emailReplyAlerts: "Replies and status changes",
  emailPodActivity: "Pod activity",
  pushStreakReminder: "Streak reminder",
  pushInterviewReminder: "Interview reminders",
};

/** The marketing switches: both off makes a person Unreachable. */
export const MARKETING_PREFS = ["emailOffers", "emailProductNews"] as const;

// ---------------------------------------------------------------------------------------------
// Timeline rows (GET /api/admin/mail/analytics/users/:id/events)

/** The "Mail" chip over a person's timeline: `?kind=mail`, beside the tracker's own kinds. */
export const MAIL_FILTER = "mail";

export interface MailTimelineRow {
  at: string;
  type: string;
  /** Already in words: `Opened "Subject"`, `Clicked /dashboard/resume`, `Visited from mail`. */
  label: string;
  sendId: string | null;
  link?: string | null;
}

/** `next` is what the following page asks for (`?page=`), null at the end. */
export interface MailTimelinePage {
  rows: MailTimelineRow[];
  next: number | string | null;
}

// ---------------------------------------------------------------------------------------------
// The billing page's personal offer (GET /api/mail/offers/current?token=)

export interface OfferGrantView {
  code: string;
  /** "20%" or "$5". */
  discountLabel: string;
  expiresAt: string;
  /** Plan keys it applies to; empty = every plan. */
  plans: string[];
  /** Billing intervals it applies to; empty = every interval. */
  intervals: string[];
  /** "your first month", "your first 3 months", "every payment". */
  durationLabel: string;
}

export interface CurrentOffer {
  grant: OfferGrantView | null;
}

/** `?offer=<grantId>.<signature>`, the shape the backend signs (MAIL-BUILD-SPEC.md section 6). */
export const isOfferToken = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{24}\.[A-Za-z0-9_-]{16,128}$/i.test(value);

/** A grant the banner can show: every field it reads present, and not yet expired. */
export function usableGrant(value: unknown, now = Date.now()): OfferGrantView | null {
  if (!value || typeof value !== "object") return null;
  const g = value as Partial<OfferGrantView>;
  if (typeof g.discountLabel !== "string" || !g.discountLabel.trim() || typeof g.expiresAt !== "string") return null;
  const ends = Date.parse(g.expiresAt);
  if (Number.isNaN(ends) || ends <= now) return null;
  return {
    code: typeof g.code === "string" ? g.code : "",
    discountLabel: g.discountLabel.trim(),
    expiresAt: g.expiresAt,
    plans: Array.isArray(g.plans) ? g.plans.filter((p): p is string => typeof p === "string") : [],
    intervals: Array.isArray(g.intervals) ? g.intervals.filter((p): p is string => typeof p === "string") : [],
    durationLabel: typeof g.durationLabel === "string" ? g.durationLabel.trim() : "",
  };
}

/** Whether the grant covers this plan on this billing, so the checkout may carry it. */
export const offerCovers = (grant: OfferGrantView, planKey: string, interval: string): boolean =>
  (!grant.plans.length || grant.plans.includes(planKey)) && (!grant.intervals.length || grant.intervals.includes(interval));

/** "20% off your first month" from the backend's labels, however it words the duration. */
export function offerHeadline(grant: Pick<OfferGrantView, "discountLabel" | "durationLabel">): string {
  const duration = grant.durationLabel.trim();
  if (!duration) return `${grant.discountLabel} off`;
  const phrase = /^(your|every|each|all|the)\b/i.test(duration) ? duration : /^first\b/i.test(duration) ? `your ${duration}` : duration;
  return `${grant.discountLabel} off ${phrase}`;
}

/** "Friday 14 November, 18:00" in the reader's own time zone (call it in the browser). */
export const offerUntil = (iso: string, locale?: string): string =>
  new Date(iso).toLocaleString(locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

// ---------------------------------------------------------------------------------------------
// Small readers shared by the admin panel and the public pages

/** A date and time the admin screens' way, from an ISO string or a revived Date. */
export const mailWhen = (value: string | Date | null | undefined): string =>
  value ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export const isPast = (value: string | Date | null | undefined, now = Date.now()): boolean => (value ? new Date(value).getTime() <= now : false);

/** A link as a path when it is ours, without its query (the `m` and utm tags), else origin and path. */
export function shortLink(url: string): string {
  try {
    const u = new URL(url, "https://www.remoteworldwide.net");
    return /(^|\.)remoteworldwide\.net$/i.test(u.hostname) || u.hostname === "localhost" ? u.pathname : `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url.slice(0, 120);
  }
}

/** `viewed_plans` → "Viewed plans". */
export const humanKey = (key: string): string => {
  const words = key.replace(/[_.-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
};
