// The admin Outreach section's shapes (/heroshima/outreach). They mirror MAIL-BUILD-SPEC.md sections 3
// and 7: the backend's mail_* collections as the admin API sends them, and the analytics reads.
// Ids arrive as `id` (libs/mail-admin.ts copies a Mongo `_id` to `id` when the backend sends the
// raw document). Timestamps the shared reviver knows (createdAt, updatedAt, unsubscribedAt) arrive
// as Date objects, every other one as an ISO string, hence `When`.
// Pure data and constants only: client and server code both import this file.

export type When = string | Date;

/* ----------------------------------------------------------------------------- content */

export type MailSender = "brand" | "founder";
export type MarketingPref = "emailOffers" | "emailProductNews";
export const MARKETING_PREFS: readonly MarketingPref[] = ["emailOffers", "emailProductNews"];
export const PREF_LABELS: Record<MarketingPref, string> = { emailOffers: "Offers", emailProductNews: "Product news" };
export const SENDER_LABELS: Record<MailSender, string> = { brand: "RemoteWorldwide", founder: "Theo, founder" };

export type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "button"; label: string; url: string }
  | { type: "image"; src: string; alt: string; href?: string }
  | { type: "divider" }
  | { type: "signature" }
  | { type: "feedback" }
  | { type: "offer" };
export type BlockType = Block["type"];
export const BLOCK_TYPES: readonly BlockType[] = ["heading", "paragraph", "button", "image", "divider", "signature", "feedback", "offer"];
export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  button: "Button",
  image: "Image",
  divider: "Divider",
  signature: "Signature",
  feedback: "How is it going?",
  offer: "Offer box",
};

/** The template variables, with what each becomes. `{{name|fallback}}` works for all of them. */
export const TEMPLATE_VARS: ReadonlyArray<{ name: string; hint: string }> = [
  { name: "firstName|there", hint: "First name, or the fallback" },
  { name: "plan", hint: "Plan name" },
  { name: "creditsLeft", hint: "Credits left" },
  { name: "targetRole", hint: "Role they want" },
  { name: "appUrl", hint: "Site address" },
  { name: "offerDiscount", hint: "20% or $5" },
  { name: "offerExpiresAt", hint: "When the code ends" },
  { name: "offerCode", hint: "Their code" },
  { name: "offerUrl", hint: "Billing link with the code" },
];

export type TemplateContent = {
  subject: string;
  preview: string;
  blocks: Block[];
  sender: MailSender;
  pref: MarketingPref | null;
  feedbackFooter: boolean;
};

export const EMPTY_CONTENT: TemplateContent = { subject: "", preview: "", blocks: [], sender: "brand", pref: "emailProductNews", feedbackFooter: false };

export type MailTemplate = TemplateContent & {
  id: string;
  name: string;
  seedKey: string | null;
  archived: boolean;
  createdAt?: When;
  updatedAt?: When;
};
export type TemplateInput = TemplateContent & { name: string };

export type MailPreview = { subject: string; html: string; text: string };

/* ----------------------------------------------------------------------------- settings */

export type MailAlarms = { complaintWarn: number; complaintPause: number; bounceWarn: number; bouncePause: number };
export type MailSettings = {
  paused: boolean;
  capPerDay: number;
  capPerWeek: number;
  quietStart: number;
  quietEnd: number;
  attributionDays: number;
  influenceDays: number;
  maxDiscountPercent: number;
  alarms: MailAlarms;
  senders: { brand: { name: string; email: string }; founder: { name: string; email: string } };
  replyDomain: string;
  updatedBy?: string | null;
  updatedAt?: When | null;
};
export type SettingsInput = Partial<Omit<MailSettings, "updatedBy" | "updatedAt">>;

export const DEFAULT_SETTINGS: MailSettings = {
  paused: false,
  capPerDay: 1,
  capPerWeek: 2,
  quietStart: 21,
  quietEnd: 8,
  attributionDays: 7,
  influenceDays: 3,
  maxDiscountPercent: 50,
  alarms: { complaintWarn: 0.001, complaintPause: 0.003, bounceWarn: 0.02, bouncePause: 0.04 },
  senders: { brand: { name: "RemoteWorldwide", email: "" }, founder: { name: "Theo", email: "" } },
  replyDomain: "",
};

export type AuditRow = { id: string; at: When; by: string | null; byEmail: string | null; action: string; target: string | null; detail: unknown };

/* ----------------------------------------------------------------------------- audiences */

export type EngagementLevel = "engaged" | "reading" | "quiet" | "unreachable" | "none";
export const ENGAGEMENT_LEVELS: readonly EngagementLevel[] = ["engaged", "reading", "quiet", "unreachable", "none"];
export const ENGAGEMENT_LABELS: Record<EngagementLevel, string> = {
  engaged: "Engaged",
  reading: "Reading",
  quiet: "Quiet",
  unreachable: "Unreachable",
  none: "Never mailed",
};

/** planKey values; "free" means no paid plan. */
export const PLAN_KEYS = ["free", "basic", "pro", "ultra"] as const;
export const PAID_PLAN_KEYS = ["basic", "pro", "ultra"] as const;
export const BILLING_INTERVALS = ["month", "quarter", "year"] as const;

export type AudienceFilter = {
  kind: "users" | "subscribers";
  plans?: string[];
  signedUpWithinDays?: number;
  signedUpBeforeDays?: number;
  activeWithinDays?: number;
  inactiveForDays?: number;
  hasResume?: boolean;
  minApplications?: number;
  maxApplications?: number;
  creditsAtMost?: number;
  engagement?: EngagementLevel[];
  clickedCampaignId?: string;
  neverOpened?: boolean;
  mailTags?: string[];
  subscriberSources?: string[];
};

export type MailAudience = { id: string; name: string; filter: AudienceFilter; createdAt?: When; updatedAt?: When };
export type AudienceInput = { name: string; filter: AudienceFilter };
export type AudienceSample = { id: string; userId: string | null; email: string; name: string | null };
export type AudienceCount = { count: number; sample: AudienceSample[] };

/* ----------------------------------------------------------------------------- campaigns */

export type CampaignStatus = "draft" | "scheduled" | "sending" | "testing" | "sent" | "paused" | "canceled" | "failed";
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  testing: "Testing A/B",
  sent: "Sent",
  paused: "Paused",
  canceled: "Canceled",
  failed: "Failed",
};

export type OfferChoice = { offerId: string; percentOverride?: number; validHoursOverride?: number };

export type AbTest = {
  subjectB: string;
  testPercent: number;
  decideAfterHours: number;
  mode: "auto" | "manual";
  winner: "a" | "b" | null;
  decidedAt: When | null;
};
export type AbTestInput = Pick<AbTest, "subjectB" | "testPercent" | "decideAfterHours" | "mode">;

export type CampaignCounts = {
  recipients: number;
  sent: number;
  deferred: number;
  skippedCap: number;
  skippedPref: number;
  skippedSuppressed: number;
  failed: number;
};

export type MailCampaign = {
  id: string;
  name: string;
  key: string;
  templateId: string | null;
  content: TemplateContent | null;
  audienceId: string | null;
  offer: OfferChoice | null;
  abTest: AbTest | null;
  status: CampaignStatus;
  sendAt: When | null;
  startedAt: When | null;
  finishedAt: When | null;
  pausedReason: string | null;
  counts: CampaignCounts;
  createdAt?: When;
  updatedAt?: When;
};

export type CampaignInput = {
  name: string;
  templateId: string | null;
  content: TemplateContent | null;
  audienceId: string | null;
  offer: OfferChoice | null;
  abTest: AbTestInput | null;
};

/* ----------------------------------------------------------------------------- playbooks */

export type BuiltInEvent =
  | "signup"
  | "subscriber_added"
  | "checkout_started"
  | "subscription_started"
  | "subscription_ended"
  | "credits_out"
  | "resume_added"
  | "application_tracked";
export const BUILT_IN_EVENTS: readonly BuiltInEvent[] = [
  "signup",
  "subscriber_added",
  "checkout_started",
  "subscription_started",
  "subscription_ended",
  "credits_out",
  "resume_added",
  "application_tracked",
];
export const EVENT_LABELS: Record<BuiltInEvent, string> = {
  signup: "Signed up",
  subscriber_added: "Subscriber joined",
  checkout_started: "Started checkout",
  subscription_started: "Subscribed",
  subscription_ended: "Plan ended",
  credits_out: "Ran out of credits",
  resume_added: "Added a resume",
  application_tracked: "Tracked an application",
};

export type Trigger =
  | { type: "action"; actionId: string; count: number; withinDays: number }
  | { type: "event"; event: BuiltInEvent }
  | { type: "audience"; audienceId: string };

export type RequiredAction = { actionId: string; count: number; withinDays?: number };
export type Entry = {
  minAccountAgeDays?: number;
  plans?: string[];
  notPlans?: string[];
  noOfferWithinDays?: number;
  requireActions?: RequiredAction[];
};

export type Reentry = { mode: "never" } | { mode: "after_days"; days: number };

export type Goal =
  | { type: "none" }
  | { type: "subscribed" }
  | { type: "event"; event: BuiltInEvent }
  | { type: "action"; actionId: string }
  | { type: "feedback_answered" };
export const GOAL_LABELS: Record<Goal["type"], string> = {
  none: "No goal",
  subscribed: "Subscribes",
  event: "Something happens",
  action: "Does an action",
  feedback_answered: "Answers the feedback",
};

export type ConditionFact =
  | "plan"
  | "subscribed"
  | "hasResume"
  | "applications"
  | "credits"
  | "lastActiveDays"
  | "accountAgeDays"
  | "opened"
  | "clicked"
  | "feedback"
  | "redeemed"
  | "actionCount"
  | "startedCheckout";
export const CONDITION_FACTS: readonly ConditionFact[] = [
  "plan",
  "subscribed",
  "hasResume",
  "applications",
  "credits",
  "lastActiveDays",
  "accountAgeDays",
  "opened",
  "clicked",
  "feedback",
  "redeemed",
  "actionCount",
  "startedCheckout",
];
export const FACT_LABELS: Record<ConditionFact, string> = {
  plan: "Plan",
  subscribed: "Pays",
  hasResume: "Has a resume",
  applications: "Applications tracked",
  credits: "Credits left",
  lastActiveDays: "Days since last active",
  accountAgeDays: "Account age, days",
  opened: "Opened a step's mail",
  clicked: "Clicked a step's mail",
  feedback: "Feedback answer",
  redeemed: "Redeemed a step's offer",
  actionCount: "Action count",
  startedCheckout: "Started checkout",
};
/** Facts whose value is yes or no. */
export const BOOLEAN_FACTS: readonly ConditionFact[] = ["subscribed", "hasResume", "opened", "clicked", "redeemed", "startedCheckout"];
/** Facts about one earlier send step. */
export const STEP_FACTS: readonly ConditionFact[] = ["opened", "clicked", "feedback", "redeemed"];
export type ConditionOp = "eq" | "neq" | "gte" | "lte" | "in";
export const OP_LABELS: Record<ConditionOp, string> = { eq: "is", neq: "is not", gte: "at least", lte: "at most", in: "is one of" };

export type Condition = { fact: ConditionFact; op: ConditionOp; value: unknown; stepId?: string; actionId?: string; withinDays?: number };

export type WaitForWhat =
  | { kind: "click"; stepId: string }
  | { kind: "action"; actionId: string }
  | { kind: "event"; event: BuiltInEvent }
  | { kind: "feedback"; stepId: string };

export type Step = { id: string } & (
  | { type: "wait"; hours: number }
  | { type: "wait_for"; what: WaitForWhat; maxHours: number; onMatch: string; onTimeout: string }
  | { type: "wait_offer"; offerStepId: string; hoursBeforeExpiry: number }
  | { type: "if"; condition: Condition; then: string; else: string }
  | { type: "send"; templateId: string; offer?: OfferChoice }
  | { type: "tag"; tag: string }
  | { type: "stop" }
);
export type StepType = Step["type"];
export const STEP_TYPES: readonly StepType[] = ["send", "wait", "wait_for", "wait_offer", "if", "tag", "stop"];
export const STEP_LABELS: Record<StepType, string> = {
  send: "Send",
  wait: "Wait",
  wait_for: "Wait for",
  wait_offer: "Wait for offer expiry",
  if: "If",
  tag: "Tag",
  stop: "Stop",
};

export type PlaybookStatus = "draft" | "live" | "paused";
export type PlaybookCounts = { active: number; done: number; exited: number; holdout: number };

export type MailPlaybook = {
  id: string;
  key: string;
  name: string;
  description: string;
  status: PlaybookStatus;
  version: number;
  group: string | null;
  trigger: Trigger;
  entry: Entry;
  reentry: Reentry;
  goal: Goal;
  holdoutPercent: number;
  steps: Step[];
  seedKey: string | null;
  counts?: PlaybookCounts;
  createdAt?: When;
  updatedAt?: When;
};

export type PlaybookInput = Pick<MailPlaybook, "name" | "description" | "group" | "trigger" | "entry" | "reentry" | "goal" | "holdoutPercent" | "steps"> & {
  key?: string;
};

export type RunStatus = "active" | "waiting" | "done" | "exited" | "failed" | "holdout";
export type PlaybookRun = {
  id: string;
  userId: string;
  email: string;
  name?: string | null;
  version: number;
  stepIndex: number;
  nextAt: When | null;
  status: RunStatus;
  enteredAt: When;
  enteredBy?: { kind: string; key: string; detail?: unknown } | null;
  exitedReason: string | null;
};
export type Paged<T> = { items: T[]; total: number; page: number; pages: number };

/* ----------------------------------------------------------------------------- actions */

export type ActionKind = "page_view" | "click" | "submit" | "api" | "custom";
export const ACTION_KINDS: readonly ActionKind[] = ["page_view", "click", "submit", "api", "custom"];
export const ACTION_KIND_LABELS: Record<ActionKind, string> = { page_view: "Page view", click: "Press", submit: "Form sent", api: "API call", custom: "Custom" };
export type ActionMatch = { kind?: ActionKind; pathPrefixes?: string[]; nameIncludes?: string[] };
export type MailAction = { id: string; key: string; name: string; match: ActionMatch; builtIn: boolean; archived: boolean };
export type ActionInput = { key?: string; name: string; match: ActionMatch };

/* ----------------------------------------------------------------------------- offers */

export type OfferKind = "percent" | "amount";
export type OfferDuration = "once" | "repeating" | "forever";
export const DURATION_LABELS: Record<OfferDuration, string> = { once: "First payment", repeating: "First N months", forever: "Every payment" };

export type OfferVersion = {
  version: number;
  percentOff: number | null;
  amountOffCents: number | null;
  duration: OfferDuration;
  durationMonths: number | null;
  stripeCouponId: string | null;
  at: When;
};

export type OfferStats = { granted: number; clicked?: number; redeemed: number; revenueCents: number; discountCents: number; thisMonth?: number };

export type OfferGrantRow = {
  id: string;
  userId: string;
  email?: string | null;
  code: string;
  discountLabel: string;
  expiresAt: When;
  clickedAt: When | null;
  redeemedAt: When | null;
  revenueCents: number | null;
  discountCents: number | null;
  holdout: boolean;
  createdAt?: When;
};

export type MailOffer = {
  id: string;
  name: string;
  kind: OfferKind;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string;
  duration: OfferDuration;
  durationMonths: number | null;
  validHours: number;
  plans: string[];
  intervals: string[];
  monthlyCap: number | null;
  version: number;
  stripeCouponId: string | null;
  history: OfferVersion[];
  archived: boolean;
  createdAt?: When;
  updatedAt?: When;
  /** Sent by GET /offers/:id (and optionally the list) when the backend adds them. */
  stats?: OfferStats;
  grants?: OfferGrantRow[];
  /** Sent by GET /offers/:id when the backend adds it: codes given and redeemed a UTC day. */
  daily?: Array<{ day: string; granted: number; redeemed: number }>;
};

export type OfferInput = {
  name: string;
  kind: OfferKind;
  percentOff: number | null;
  amountOffCents: number | null;
  duration: OfferDuration;
  durationMonths: number | null;
  validHours: number;
  plans: string[];
  intervals: string[];
  monthlyCap: number | null;
};

/* ----------------------------------------------------------------------------- inbox */

export type ThreadStatus = "open" | "done";
export type MailThread = {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  subject: string;
  status: ThreadStatus;
  unread: boolean;
  lastMessageAt: When;
  tags: string[];
  snippet?: string | null;
};

export type MailMessage = {
  id: string;
  threadId: string;
  direction: "in" | "out";
  status: "fetching" | "received" | "queued" | "sent" | "failed";
  from: string;
  to: string;
  subject: string;
  text: string | null;
  html: string | null;
  at: When;
  by?: string | null;
};

/** The person beside a thread. Field names vary a little; the page reads each defensively. */
export type ThreadPerson = {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  plan?: string | null;
  signedUpAt?: When | null;
  createdAt?: When | null;
  lastActiveAt?: When | null;
  lastSeenAt?: When | null;
  engagement?: EngagementLevel | null;
  level?: EngagementLevel | null;
};

export type ThreadDetail = { thread: MailThread; messages: MailMessage[]; person: ThreadPerson | null };

/* ----------------------------------------------------------------------------- analytics */

export type Totals = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
  converted: number;
  influenced?: number;
  revenueCents?: number;
};

export type Rates = {
  delivered: number;
  opened: number;
  clicked: number;
  clickToOpen: number;
  replied: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
  converted: number;
};

export type FaceAnswer = "great" | "good" | "meh" | "bad";
export const FACES: readonly FaceAnswer[] = ["great", "good", "meh", "bad"];
export const FACE_LABELS: Record<FaceAnswer, string> = { great: "Great", good: "Good", meh: "Meh", bad: "Bad" };
export const FACE_EMOJI: Record<FaceAnswer, string> = { great: "😀", good: "🙂", meh: "😐", bad: "🙁" };

export type FeedbackComment = { at: When; answer: string; comment: string; email: string | null };
export type FeedbackSummary = {
  great: number;
  good: number;
  meh: number;
  bad: number;
  yes: number;
  no: number;
  comments: FeedbackComment[];
  /** Optional: faces (and Yes / No) per UTC day, zero-filled, when the backend sends a series. */
  daily?: FeedbackDay[];
};

/** Days below are UTC `YYYY-MM-DD`, zero-filled across the window. */
export type FeedbackDay = { day: string; great: number; good: number; meh: number; bad: number; yes?: number; no?: number };

export type OverviewDay = {
  day: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  replied?: number;
  unsubscribed?: number;
  bounced?: number;
  complained?: number;
};
export type SourceDay = { day: string; product: number; campaign: number; playbook: number };
export type OfferDay = { day: string; granted: number; redeemed: number; revenueCents?: number };
export type ConversionDay = { day: string; credited: number; influenced: number; valueCents?: number };
export type ConversionGoal = { goal: string; credited: number; influenced: number; valueCents?: number };

export type AlarmLevel = "ok" | "warn" | "pause";

export type Overview = {
  days: number;
  totals: Totals;
  rates: Rates;
  daily: OverviewDay[];
  /** Optional: sent a day split by source. */
  dailyBySource?: SourceDay[];
  bySource: { product: Totals; campaign: Totals; playbook: Totals };
  alarms: { complaintRate: number; bounceRate: number; level: AlarmLevel; suppressed7d?: number };
  feedback: FeedbackSummary;
  offers: {
    granted: number;
    clicked: number;
    redeemed: number;
    revenueCents: number;
    discountCents: number;
    holdout: { people: number; upgraded: number };
    mailed: { people: number; upgraded: number };
    /** Optional: codes given and redeemed a day. */
    daily?: OfferDay[];
  };
  actions: Array<{ actionId: string; name: string; people7d: number; entered7d: number }>;
  /** Optional: conversions credited to (or influenced by) a mail, by goal and a day. */
  conversions?: { byGoal: ConversionGoal[]; daily: ConversionDay[] };
};

export type TableBy = "campaign" | "playbook_step" | "template" | "kind";
export const TABLE_BYS: readonly TableBy[] = ["campaign", "playbook_step", "template", "kind"];
export const TABLE_BY_LABELS: Record<TableBy, string> = { campaign: "Campaigns", playbook_step: "Playbook steps", template: "Templates", kind: "Product mails" };
export type TableRow = Totals & { id: string; label: string; revenueCents: number };

/** A campaign's timeline row: `at` is the start of the hour (ISO, UTC) or the UTC day. */
export type CampaignTimelineRow = { at: string; delivered: number; opened: number; clicked: number; converted: number };

export type CampaignReport = {
  campaign: MailCampaign;
  funnel: Totals;
  /** Optional: hourly for the first hours after the start, else daily. */
  timeline?: { unit: "hour" | "day"; rows: CampaignTimelineRow[] };
  variants?: { a: Totals; b: Totals };
  links: Array<{ url: string; clicks: number; people: number }>;
  feedback: FeedbackSummary | null;
  reasons: Array<{ reason: string; count: number }>;
  replies: Array<{ threadId: string; email: string; at: When; snippet: string }>;
  people: { rows: Array<{ userId: string | null; email: string; status: string; openedAt: When | null; clickedAt: When | null; convertedGoal: string | null }>; total: number };
};

export type PlaybookStepStats = { stepId: string; type: string; label: string; inStep: number; sent: number; opened: number; clicked: number; converted: number };
export type PlaybookDay = { day: string; entered: number; sent: number; clicked: number; converted: number };
export type PlaybookReport = {
  steps: PlaybookStepStats[];
  totals: Partial<Totals> & Record<string, unknown>;
  holdout: unknown;
  /** Optional: the last 30 UTC days, zero-filled. */
  daily?: PlaybookDay[];
};

export const UNSUBSCRIBE_REASON_LABELS: Record<string, string> = {
  too_many: "Too many mails",
  not_relevant: "Not relevant",
  found_job: "Found a job",
  never_signed_up: "Never signed up",
  other: "Other",
};

/** A server action's answer: the data, or a message the screen can show. */
export type MailResult<T> = { data: T; error?: never } | { error: string; data?: never };
