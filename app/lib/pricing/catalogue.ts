// The public price list: plans and top-ups from the backend, plus what each AI
// action costs.
//
// Plans are rows in Mongo (seeded from remoteworldwidebackend/src/config/billing.ts,
// then editable in place), so /pricing reads them from GET /api/billing/catalogue
// and only falls back to FALLBACK_CATALOGUE — a copy of those seeds — when the
// backend can't be reached at render time.
//
// CREDIT_COSTS mirrors the AI service's defaults (remoteworldwideai: scanService,
// suggestionService, coverLetterService, resumeBuildService, jobAskService,
// likelyQuestionService, referralSearchService, autofillService, config/env.ts
// voiceCredits / coach / prepText). Several are env-tunable there; if one is
// changed in production, change it here too.

export interface PricingPlan {
  key: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: string;
  /** A year up front, from the backend. Absent from the fallback copy, which works it out. */
  yearlyPriceCents?: number;
  monthlyCredits: number;
  features: string[];
  prioritySupport: boolean;
}

export interface PricingPack {
  key: string;
  name: string;
  credits: number;
  priceCents: number;
}

export interface PricingCatalogue {
  plans: PricingPlan[];
  creditPacks: PricingPack[];
}

/** The plan the page puts forward. A recommendation, not a sales figure. */
export const RECOMMENDED_PLAN = "ultra";

/**
 * Yearly billing for a plan that carries no `yearlyPriceCents`: twelve months at the monthly price,
 * less this share. The backend owns the real figure (each seeded plan sets its own yearly price) and
 * sends it; this is only a fallback.
 */
export const YEARLY_DISCOUNT = 0.1;

export type BillingInterval = "month" | "year";

/** What a plan costs for a year up front, to the cent. */
export const yearlyCents = (plan: PricingPlan) => plan.yearlyPriceCents ?? Math.round(plan.priceCents * 12 * (1 - YEARLY_DISCOUNT));

/** What a plan comes to per month on the chosen billing: its price, or its yearly price over twelve. */
export const perMonthCents = (plan: PricingPlan, billing: BillingInterval) =>
  billing === "year" ? Math.round(yearlyCents(plan) / 12) : plan.priceCents;

/**
 * What paying yearly saves, as the Monthly / Yearly switch says it: "Save 10%", or "Save up to 10%"
 * when the plans save different amounts. Rounded down, so it never claims more than a plan gives.
 */
export const yearlySavingLabel = (plans: PricingPlan[]): string | null => {
  const savings = plans
    .filter((plan) => plan.priceCents > 0)
    // The nudge keeps an exact 10% (1 - 0.9 is 0.0999… in floating point) from reading as 9%.
    .map((plan) => Math.floor((1 - yearlyCents(plan) / (plan.priceCents * 12)) * 100 + 1e-6))
    .filter((percent) => percent > 0);
  if (savings.length === 0) return null;
  const best = Math.max(...savings);
  return savings.every((percent) => percent === best) ? `Save ${best}%` : `Save up to ${best}%`;
};

export const FALLBACK_CATALOGUE: PricingCatalogue = {
  plans: [
    {
      key: "free",
      name: "Free",
      priceCents: 0,
      currency: "USD",
      interval: "month",
      monthlyCredits: 50,
      prioritySupport: false,
      features: ["50 AI credits a month", "Resume builder (one resume)", "ATS scans and cover letters", "Application tracking and drafts"],
    },
    {
      key: "pro",
      name: "Pro",
      priceCents: 2500,
      yearlyPriceCents: 26988,
      currency: "USD",
      interval: "month",
      monthlyCredits: 150,
      prioritySupport: false,
      features: ["150 AI credits a month", "Unlimited resumes", "AI help in the resume builder", "Email support"],
    },
    {
      key: "ultra",
      name: "Ultra",
      priceCents: 5500,
      yearlyPriceCents: 59988,
      currency: "USD",
      interval: "month",
      monthlyCredits: 400,
      prioritySupport: true,
      features: ["400 AI credits a month", "Everything in Pro", "Interview prep and voice mock interviews", "Priority support and early access"],
    },
  ],
  creditPacks: [
    { key: "small", name: "50 credits", credits: 50, priceCents: 3000 },
    { key: "medium", name: "150 credits", credits: 150, priceCents: 7500 },
    { key: "large", name: "400 credits", credits: 400, priceCents: 16000 },
  ],
};

export interface CreditCost {
  action: string;
  detail: string;
  /** 0 = free. */
  credits: number;
  /** Shown instead of the bare number when the price has a condition attached. */
  label?: string;
}

export const CREDIT_COSTS: CreditCost[] = [
  { action: "Import a job", detail: "Paste a link or posting and it's ready to tailor against.", credits: 0 },
  { action: "Typed practice interview", detail: "Graded like a voice session, up to 10 a day.", credits: 0 },
  { action: "AI coach reply", detail: "The first 15 replies every day are free.", credits: 0, label: "15 free / day" },
  { action: "ATS scan", detail: "Score your resume against a posting, keyword by keyword.", credits: 1 },
  { action: "Resume suggestion", detail: "Add missing keywords, quantify bullets, or shorten to a page.", credits: 1 },
  { action: "Ask about a job", detail: "An answer grounded in the posting and your profile.", credits: 1 },
  { action: "Likely interview questions", detail: "A tailored question set for the role you're prepping.", credits: 1 },
  // Referral search (1 credit) is hidden from the public pages for now.
  { action: "Autofill an answer", detail: "Draft an application answer from your resume, in the extension.", credits: 1 },
  { action: "Cover letter revision", detail: "Rework a letter you've drafted, to your own note.", credits: 1 },
  { action: "Cover letter", detail: "A first draft from the posting and your resume.", credits: 2 },
  { action: "Resume build", detail: "A full resume rebuilt around a target role.", credits: 3 },
  { action: "Voice mock interview", detail: "Up to 10 minutes of recording, then 1 credit per extra minute.", credits: 5, label: "5+ credits" },
];

/**
 * Plans the interview-prep tools are on. The comparison table and the estimator share it, and the
 * AI service enforces it (remoteworldwideai services/planService.ts: prep is on Ultra).
 */
const INTERVIEW_PLANS = ["ultra"];

/** Every paid plan: AI help in the resume builder, and more than one resume, start at Pro. */
const PAID_PLANS = ["pro", "ultra"];

export interface EstimatorItem {
  key: string;
  label: string;
  unit: string;
  credits: number;
  max: number;
  initial: number;
  /** Plans that include this tool; omitted means every plan. */
  plans?: string[];
}

/** What the estimator on /pricing multiplies by. Kept next to CREDIT_COSTS so the two can't disagree. */
export const ESTIMATOR_ITEMS: EstimatorItem[] = [
  { key: "scans", label: "ATS scans", unit: "scan", credits: 1, max: 80, initial: 20 },
  { key: "letters", label: "Cover letters", unit: "letter", credits: 2, max: 40, initial: 10 },
  { key: "interviews", label: "Voice mock interviews", unit: "interview", credits: 5, max: 30, initial: 6, plans: INTERVIEW_PLANS },
];

export interface FeatureRow {
  label: string;
  /** What it is, and its price or limit, shown in grey under the label, e.g. "Score against a posting · 1 credit". */
  note?: string;
  /** Plan keys that include it, or every plan. A plan key missing from both reads as "—". */
  plans: "all" | string[];
  /** Text shown instead of a tick for a plan, e.g. "1 resume" on Free. */
  values?: Record<string, string>;
}

/** The site-wide reward for an invite that turns into a subscriber (backend CREDITS_PER_SUBSCRIBER). */
export const CREDITS_PER_INVITE = 5;

/** Under the table's monthly-credits and per-credit rows, which it works out from the plans themselves. */
export const CREDIT_ROWS: FeatureRow[] = [
  { label: "Top-up credit packs", note: "Never expire, used after your monthly allowance", plans: "all" },
  { label: "Credits for invites", note: `${CREDITS_PER_INVITE} credits for each friend who subscribes`, plans: "all" },
];

/**
 * The comparison table under the plan cards. Free's limits (one resume, no AI in the builder) and
 * interview prep on Ultra are enforced by the AI service; priority support and early access are
 * the Ultra plan's promise. Referral search is left out for now.
 */
export const FEATURE_GROUPS: { title: string; rows: FeatureRow[] }[] = [
  {
    title: "Find and track jobs",
    rows: [
      { label: "Remote job board", note: "Search, save and apply to vetted remote roles", plans: "all" },
      { label: "Import jobs", note: "From a link or a pasted posting · free", plans: "all" },
      { label: "Saved jobs", note: "A shortlist to come back to", plans: "all" },
      { label: "Unlimited application tracking", note: "Every application, stage by stage", plans: "all" },
    ],
  },
  {
    title: "Resumes & cover letters",
    rows: [
      { label: "Resume builder", plans: "all", values: { free: "1 resume", pro: "Unlimited", ultra: "Unlimited" } },
      { label: "Import your resume", note: "Upload a PDF, Word or text file · free", plans: "all" },
      { label: "Build a resume with AI", note: "A full resume around a target role · 3 credits", plans: PAID_PLANS },
      { label: "AI help in the resume builder", note: "Tailor, add keywords, quantify, shorten · 1 credit", plans: PAID_PLANS },
      { label: "ATS scans", note: "Keyword-by-keyword score against a posting · 1 credit", plans: "all" },
      { label: "Cover letters", note: "2 credits a draft, 1 per revision", plans: "all" },
      { label: "Document vault", note: "Your files in one place, with a master resume", plans: "all" },
    ],
  },
  {
    title: "Applying",
    rows: [
      { label: "Ask about a job", note: "Answers from the posting and your profile · 1 credit", plans: "all" },
      { label: "Saved application answers", note: "Write an answer once, reuse it anywhere · free", plans: "all" },
      { label: "Chrome extension", note: "Save and track jobs from the application page", plans: "all" },
      { label: "Autofill from your profile", note: "Your details and saved answers · free", plans: "all" },
      { label: "AI answers in the extension", note: "New questions answered from your resume · 1 credit", plans: "all" },
      { label: "Application drafts", note: "Pick an application back up later", plans: "all" },
      { label: "Recommendations to companies", note: "Reviewers put strong profiles in front of hiring teams", plans: "all" },
    ],
  },
  {
    title: "Interview prep",
    rows: [
      { label: "Prep tracks for each role", note: "Built on the real posting, synced with your tracker", plans: INTERVIEW_PLANS },
      { label: "Likely interview questions", note: "A tailored set for the role · 1 credit", plans: INTERVIEW_PLANS },
      { label: "Voice mock interviews", note: "5 credits for up to 10 minutes, then 1 a minute", plans: INTERVIEW_PLANS },
      { label: "Typed practice interviews", note: "Free, up to 10 a day", plans: INTERVIEW_PLANS },
      { label: "Interview reports", note: "Scores, transcript and recording playback", plans: INTERVIEW_PLANS },
      { label: "Delivery analysis", note: "Long pauses, filler words and pitch", plans: INTERVIEW_PLANS },
      { label: "Positioning, diction and grammar", note: "Every point backed by a quote from your answers", plans: INTERVIEW_PLANS },
    ],
  },
  {
    title: "Coaching & momentum",
    rows: [
      { label: "AI career coach", note: "15 free replies a day, then 1 credit each", plans: "all" },
      { label: "Talk it through by voice", note: "With the coach and Ask about a job", plans: "all" },
      { label: "Daily plan and streaks", note: "Today's tasks, and a streak to keep", plans: "all" },
      { label: "Job-search pod", note: "Weekly goals and wins with a small group", plans: "all" },
    ],
  },
  {
    title: "Support",
    rows: [
      { label: "Email support", plans: "all" },
      { label: "Priority support", plans: ["ultra"] },
      { label: "Early access to new tools", plans: ["ultra"] },
    ],
  },
];

/** The plans FEATURE_GROUPS was written for. */
const FEATURE_PLAN_KEYS = FALLBACK_CATALOGUE.plans.map((plan) => plan.key);

/** Whether a row covers a plan; null when the plan is one this table doesn't know. */
export const rowIncludes = (row: FeatureRow, planKey: string): boolean | null => {
  if (row.plans === "all") return true;
  if (row.plans.includes(planKey)) return true;
  return FEATURE_PLAN_KEYS.includes(planKey) ? false : null;
};

export const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

/** Price of one credit, to the cent, e.g. "$0.33". */
export const perCredit = (cents: number, credits: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / credits / 100);

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

/**
 * The live catalogue, cached for an hour. Server-only: it calls the backend
 * directly rather than through a rewrite, and it never sends a cookie.
 */
export async function fetchCatalogue(): Promise<PricingCatalogue> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/billing/catalogue`, { next: { revalidate: 3600 } });
    if (!res.ok) return FALLBACK_CATALOGUE;
    const body = (await res.json()) as { data?: Partial<PricingCatalogue> | null };
    const plans = body.data?.plans;
    const creditPacks = body.data?.creditPacks;
    if (!Array.isArray(plans) || plans.length === 0 || !Array.isArray(creditPacks)) return FALLBACK_CATALOGUE;
    return { plans, creditPacks };
  } catch {
    return FALLBACK_CATALOGUE;
  }
}
