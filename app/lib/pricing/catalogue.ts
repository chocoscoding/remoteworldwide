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

import { EXTENSION_URL } from "@/app/lib/extension/url";

export interface PricingPlan {
  key: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: string;
  /** Three months up front, from the backend. Absent from an older backend, which falls back to the discount rule. */
  quarterlyPriceCents?: number;
  /** A year up front, from the backend. */
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
export const RECOMMENDED_PLAN = "pro";

/**
 * How a paid plan is paid for (owner, 2026-10-26): monthly, every three months, or yearly. Credits
 * refill every month on all three; on quarterly, unused allowance rolls over until the quarter ends.
 */
export type BillingInterval = "month" | "quarter" | "year";

/** The billing /pricing opens on (owner, 2026-10-26): most searches take two or three months. */
export const DEFAULT_BILLING: BillingInterval = "quarter";

/** Shortest first: a plan may only move to the same billing or a longer one. */
export const BILLING_ORDER: BillingInterval[] = ["month", "quarter", "year"];

/** How many months one paid period covers. */
export const MONTHS_IN: Record<BillingInterval, number> = { month: 1, quarter: 3, year: 12 };

/**
 * Discounts for a plan that carries no quarterly or yearly price of its own. The backend owns the
 * real figures (each seeded plan sets its own) and sends them; these are only a fallback.
 */
export const QUARTERLY_DISCOUNT = 0.12;
export const YEARLY_DISCOUNT = 0.2;

/** A worked-out price is rounded UP to a whole dollar (owner, 2026-10-27: $44.88 shows as $45), never cents. */
const wholeDollarsUp = (cents: number) => Math.ceil(Math.round(cents) / 100) * 100;

/** What a plan costs for three months up front. */
export const quarterlyCents = (plan: PricingPlan) => plan.quarterlyPriceCents || wholeDollarsUp(plan.priceCents * 3 * (1 - QUARTERLY_DISCOUNT));

/** What a plan costs for a year up front. */
export const yearlyCents = (plan: PricingPlan) => plan.yearlyPriceCents || wholeDollarsUp(plan.priceCents * 12 * (1 - YEARLY_DISCOUNT));

/** What one period of a plan costs on the chosen billing: the real charge. */
export const periodCents = (plan: PricingPlan, billing: BillingInterval) =>
  plan.priceCents <= 0 ? 0 : billing === "year" ? yearlyCents(plan) : billing === "quarter" ? quarterlyCents(plan) : plan.priceCents;

/** What a plan comes to per month on the chosen billing. */
export const perMonthCents = (plan: PricingPlan, billing: BillingInterval) => Math.round(periodCents(plan, billing) / MONTHS_IN[billing]);

/**
 * What a plan saves on the chosen billing against paying monthly, as a whole percent, or 0. Rounded
 * to the nearest point, the way the owner's price sheet states them (2026-10-26: quarterly saves 12%
 * on Basic and Ultra and 14% on Pro, yearly about 20% on each).
 */
export const savingPercent = (plan: PricingPlan, billing: BillingInterval): number => {
  if (billing === "month" || plan.priceCents <= 0) return 0;
  const percent = Math.round((1 - periodCents(plan, billing) / (plan.priceCents * MONTHS_IN[billing])) * 100);
  return percent > 0 ? percent : 0;
};

/**
 * The badge on a billing option, worked out from the plans: "Save 20%" when every paid plan saves
 * the same, "Save up to 14%" when they differ, or null when nothing is saved.
 */
export const savingLabel = (plans: PricingPlan[], billing: BillingInterval): string | null => {
  const savings = plans.filter((plan) => plan.priceCents > 0).map((plan) => savingPercent(plan, billing)).filter((percent) => percent > 0);
  if (savings.length === 0) return null;
  const most = Math.max(...savings);
  return savings.every((percent) => percent === most) ? `Save ${most}%` : `Save up to ${most}%`;
};

/** Both badges, for the billing switch. */
export const savingLabels = (plans: PricingPlan[]): Partial<Record<BillingInterval, string | null>> => ({
  quarter: savingLabel(plans, "quarter"),
  year: savingLabel(plans, "year"),
});

/** Whole dollars, for "about $27 a month". */
export const aboutMoney = (cents: number, currency = "USD") => money(Math.round(cents / 100) * 100, currency);

/** The vendors autofill is listed as working on, under the /pricing hero. Prune any that fail the extension's autofill tests. */
export const AUTOFILL_ATS = [
  "Workday",
  "Greenhouse",
  "Lever",
  "Ashby",
  "iCIMS",
  "SmartRecruiters",
  "BambooHR",
  "Workable",
  "Oracle Taleo",
  "SAP SuccessFactors",
  "Jobvite",
  "JazzHR",
  "Breezy HR",
  "Recruitee",
  "Teamtailor",
  "Personio",
  "Pinpoint",
  "Rippling",
  "Gem",
  "Dover",
  "Paylocity",
  "UKG",
  "ADP",
  "Bullhorn",
  "Comeet",
  "Freshteam",
  "Zoho Recruit",
  "Manatal",
  "Homerun",
  "Polymer",
  "Wellfound",
  "JOIN",
] as const;

export const FALLBACK_CATALOGUE: PricingCatalogue = {
  plans: [
    {
      key: "free",
      name: "Free",
      priceCents: 0,
      currency: "USD",
      interval: "month",
      monthlyCredits: 30,
      prioritySupport: false,
      features: ["Job board, autofill and saved answers", "Application tracking and drafts", "1 resume and 1 cover letter", "30 AI credits a month"],
    },
    {
      key: "basic",
      name: "Basic",
      priceCents: 1700,
      quarterlyPriceCents: 4500,
      yearlyPriceCents: 16300,
      currency: "USD",
      interval: "month",
      monthlyCredits: 100,
      prioritySupport: false,
      features: [
        "A tailored resume and cover letter for every job",
        "Unlimited resumes and no ads",
        "AI help in the resume builder",
        "Career coach and daily plan",
        "Job-search pod",
        "100 AI credits a month",
      ],
    },
    {
      key: "pro",
      name: "Pro",
      priceCents: 3100,
      quarterlyPriceCents: 8000,
      yearlyPriceCents: 29900,
      currency: "USD",
      interval: "month",
      monthlyCredits: 200,
      prioritySupport: false,
      features: [
        "Everything in Basic",
        "Mock interviews with your likely interviewer, with a delivery report and follow-ups",
        "Likely questions for each role",
        "Salary negotiation prep",
        "200 AI credits a month",
      ],
    },
    {
      key: "ultra",
      name: "Ultra",
      priceCents: 5700,
      quarterlyPriceCents: 15000,
      yearlyPriceCents: 54900,
      currency: "USD",
      interval: "month",
      monthlyCredits: 400,
      prioritySupport: true,
      features: [
        "Everything in Pro",
        "We recommend you directly to partner companies hiring on Remote Worldwide",
        "A human review of your CV every month, back within 48 hours",
        "Priority support",
        "400 AI credits a month",
      ],
    },
  ],
  creditPacks: [
    { key: "small", name: "25 credits", credits: 25, priceCents: 500 },
    { key: "medium", name: "75 credits", credits: 75, priceCents: 1500 },
    { key: "large", name: "200 credits", credits: 200, priceCents: 4000 },
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
  // No typed practice interview: the website only starts voice sessions (PrepLive), so it isn't sold here.
  { action: "AI coach reply", detail: "On Basic and up, the first 15 replies every day are free. Free gets 5 replies a month.", credits: 0, label: "15 free / day" },
  { action: "ATS scan", detail: "Score your resume against a posting, keyword by keyword.", credits: 1 },
  { action: "Resume suggestion", detail: "Tailor to a posting or add missing keywords. Grammar, rewrite, quantify and shorten use no credits within your plan allowance.", credits: 1 },
  { action: "Ask about a job", detail: "An answer grounded in the posting and your profile.", credits: 1 },
  { action: "Likely interview questions", detail: "A tailored question set for the role you're prepping.", credits: 1 },
  // Referral search (1 credit) is hidden from the public pages for now.
  { action: "Draft new AI answers", detail: "Draft up to eight new answers per batch. Profile and approved saved-answer autofill are free.", credits: 1 },
  { action: "Cover letter revision", detail: "Rework a letter you've drafted, to your own note.", credits: 1 },
  { action: "Cover letter", detail: "A first draft from the posting and your resume.", credits: 2 },
  { action: "Resume build", detail: "A full resume rebuilt around a target role.", credits: 3 },
  { action: "Voice mock interview", detail: "Up to 10 minutes of recording, then 1 credit per extra minute.", credits: 5, label: "5+ credits" },
];

/**
 * Every paid plan: no ads (app/lib/ads.ts) and more than one resume start at Basic (owner,
 * 2026-10-01). The AI tools, the coach and voice talk are on Free a little each month (owner,
 * 2026-10-15; `freeMonthly`), and the pod has none. Recommendations to partner companies are
 * Ultra's alone (owner, 2026-10-26). Streaks stay on Free.
 */
const PAID_PLANS = ["basic", "pro", "ultra"];

/** A row Free gets a little of each month (owner, 2026-10-15), with the plans that have it in full. */
const freeMonthly = (amount: string, below: string[] = ["free"]): Record<string, string> =>
  Object.fromEntries(below.map((plan) => [plan, `${amount} a month`]));

export interface EstimatorItem {
  key: string;
  label: string;
  unit: string;
  credits: number;
  max: number;
  initial: number;
  /** Plans that include this tool; omitted means every plan. */
  plans?: string[];
  /** The most a plan allows, by plan key, e.g. Free's one cover letter; omitted means no cap. */
  limits?: Record<string, number>;
}

/**
 * What the estimator on /pricing multiplies by. Kept next to CREDIT_COSTS so the two can't disagree.
 * It asks in jobs, not credits (owner, 2026-10-26): a job is a tailored resume (3) and an ATS scan (1).
 */
export const ESTIMATOR_ITEMS: EstimatorItem[] = [
  { key: "applications", label: "Jobs you apply to", unit: "job", credits: 4, max: 80, initial: 10, limits: { free: 1 } },
  { key: "letters", label: "Cover letters", unit: "letter", credits: 2, max: 40, initial: 10, limits: { free: 1 } },
  { key: "interviews", label: "Voice mock interviews", unit: "interview", credits: 5, max: 30, initial: 6, limits: { free: 1, basic: 1 } },
];

export interface FeatureRow {
  label: string;
  /** What it is, and its price or limit, shown in grey under the label, e.g. "Score against a posting · 1 credit". */
  note?: string;
  /** Plan keys that include it, or every plan. A plan key missing from both reads as "—". */
  plans: "all" | string[];
  /** Text shown instead of a tick for a plan, e.g. "1 resume" on Free. */
  values?: Record<string, string>;
  /** Where the label links, opened in a new tab (the extension's store listing). */
  href?: string;
}

/** The site-wide reward for an invite that turns into a subscriber (backend CREDITS_PER_SUBSCRIBER). */
export const CREDITS_PER_INVITE = 5;

/** Under the table's monthly-credits and per-credit rows, which it works out from the plans themselves. */
export const CREDIT_ROWS: FeatureRow[] = [
  { label: "Top-up credit packs", note: "Never expire, used after your monthly allowance", plans: "all" },
  { label: "Credits for invites", note: `${CREDITS_PER_INVITE} credits for each friend who subscribes`, plans: "all" },
];

/**
 * The comparison table under the plan cards. Free's limits (one resume, one letter, a little of each
 * AI tool a month: services/planService.ts FREE_MONTHLY) and interview prep on Pro (one session a
 * month below it) are enforced by the AI service, the coaching tools on Basic by the AI service,
 * the pod on Basic and recommendations on Ultra by the backend, and ads by app/lib/ads.ts; the
 * human CV review and priority support are the Ultra plan's promise. Referral search is left out.
 */
export const FEATURE_GROUPS: { title: string; rows: FeatureRow[] }[] = [
  {
    title: "Find and track jobs",
    rows: [
      { label: "Remote job board", note: "Search, save and apply to vetted remote roles", plans: "all" },
      { label: "No ads", note: "Browse the job board without them", plans: PAID_PLANS },
      { label: "Import jobs", note: "From a link or a pasted posting · free", plans: "all" },
      { label: "Saved jobs", note: "A shortlist to come back to", plans: "all" },
      { label: "Unlimited application tracking", note: "Every application, stage by stage", plans: "all" },
    ],
  },
  {
    title: "Resumes & cover letters",
    rows: [
      { label: "Resume builder", plans: "all", values: { free: "1 resume", basic: "Unlimited", pro: "Unlimited", ultra: "Unlimited" } },
      { label: "Import your resume", note: "Upload a PDF, Word or text file · free", plans: "all" },
      { label: "Build a resume with AI", note: "A full resume around a target role · 3 credits", plans: "all", values: freeMonthly("1") },
      { label: "AI help in the resume builder", note: "Tailor, add keywords, quantify, shorten · 1 credit", plans: "all", values: freeMonthly("3") },
      { label: "ATS scans", note: "Keyword-by-keyword score against a posting · 1 credit", plans: "all" },
      { label: "Cover letters", note: "2 credits a draft, 1 per revision", plans: "all", values: { free: "1 letter", basic: "Unlimited", pro: "Unlimited", ultra: "Unlimited" } },
      { label: "Document vault", note: "Your files in one place, with a master resume", plans: "all" },
    ],
  },
  {
    title: "Applying",
    rows: [
      { label: "Ask about a job", note: "Answers from the posting and your profile · 1 credit", plans: "all" },
      { label: "Saved application answers", note: "Write an answer once, reuse it anywhere · free", plans: "all" },
      { label: "Chrome extension", note: "Save and track jobs from the application page", plans: "all", href: EXTENSION_URL },
      { label: "Autofill from your profile", note: "Your details and saved answers · free", plans: "all" },
      { label: "AI answers in the extension", note: "New questions answered from your resume · 1 credit", plans: "all" },
      { label: "Application drafts", note: "Pick an application back up later", plans: "all" },
      { label: "Recommended to partner companies", note: "We recommend you directly to partner companies hiring on Remote Worldwide", plans: ["ultra"] },
    ],
  },
  {
    title: "Interview prep",
    rows: [
      { label: "Prep tracks for each role", note: "Built on the real posting, synced with your tracker", plans: "all" },
      { label: "Likely interview questions", note: "A tailored set for the role · 1 credit", plans: "all", values: freeMonthly("1 set", ["free", "basic"]) },
      { label: "Voice mock interviews", note: "5 credits for up to 10 minutes, then 1 a minute", plans: "all", values: freeMonthly("1", ["free", "basic"]) },
      { label: "Interview reports", note: "Scores, transcript and recording playback", plans: "all" },
      { label: "Delivery analysis", note: "Long pauses, filler words and pitch", plans: "all" },
      { label: "Positioning, diction and grammar", note: "Every point backed by a quote from your answers", plans: "all" },
      { label: "Salary negotiation prep", note: "Rehearse the offer conversation for the role", plans: ["pro", "ultra"] },
    ],
  },
  {
    title: "Coaching & momentum",
    rows: [
      { label: "AI career coach", note: "15 free replies a day, then 1 credit each", plans: "all", values: freeMonthly("5 replies") },
      { label: "Talk it through by voice", note: "With the coach and Ask about a job", plans: "all", values: freeMonthly("1 talk") },
      { label: "Daily plan", note: "Today's tasks, picked for your search", plans: "all" },
      { label: "Coach plans on your daily plan", note: "The coach's suggested tasks, added in one go", plans: "all", values: freeMonthly("1") },
      { label: "Job-search pod", note: "Weekly goals and wins with a small group", plans: PAID_PLANS },
      { label: "Streaks", note: "A streak to keep, from the work you do", plans: "all" },
    ],
  },
  {
    title: "Support",
    rows: [
      { label: "Email support", plans: "all" },
      { label: "Human CV review", note: "1 a month, back within 48 hours", plans: ["ultra"] },
      { label: "Priority support", plans: ["ultra"] },
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
