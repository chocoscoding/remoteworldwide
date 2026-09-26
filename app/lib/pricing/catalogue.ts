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
export const RECOMMENDED_PLAN = "growth";

export const FALLBACK_CATALOGUE: PricingCatalogue = {
  plans: [
    {
      key: "starter",
      name: "Starter",
      priceCents: 5000,
      currency: "USD",
      interval: "month",
      monthlyCredits: 100,
      prioritySupport: false,
      features: ["100 AI credits a month", "Resume tailoring and ATS scoring", "Unlimited application tracking", "Email support"],
    },
    {
      key: "growth",
      name: "Growth",
      priceCents: 9900,
      currency: "USD",
      interval: "month",
      monthlyCredits: 300,
      prioritySupport: false,
      features: ["300 AI credits a month", "Everything in Starter", "Interview prep sessions", "Referral introductions"],
    },
    {
      key: "scale",
      name: "Scale",
      priceCents: 15000,
      currency: "USD",
      interval: "month",
      monthlyCredits: 750,
      prioritySupport: true,
      features: ["750 AI credits a month", "Everything in Growth", "Priority support", "Early access to new tools"],
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
  { action: "Referral search", detail: "People at the company who could refer you.", credits: 1 },
  { action: "Autofill an answer", detail: "Draft an application answer from your resume, in the extension.", credits: 1 },
  { action: "Cover letter revision", detail: "Rework a letter you've drafted, to your own note.", credits: 1 },
  { action: "Cover letter", detail: "A first draft from the posting and your resume.", credits: 2 },
  { action: "Resume build", detail: "A full resume rebuilt around a target role.", credits: 3 },
  { action: "Voice mock interview", detail: "Up to 10 minutes of recording, then 1 credit per extra minute.", credits: 5, label: "5+ credits" },
];

/** What the estimator on /pricing multiplies by. Kept next to CREDIT_COSTS so the two can't disagree. */
export const ESTIMATOR_ITEMS = [
  { key: "scans", label: "ATS scans", unit: "scan", credits: 1, max: 80, initial: 20 },
  { key: "letters", label: "Cover letters", unit: "letter", credits: 2, max: 40, initial: 10 },
  { key: "interviews", label: "Voice mock interviews", unit: "interview", credits: 5, max: 30, initial: 6 },
  { key: "referrals", label: "Referral searches", unit: "search", credits: 1, max: 60, initial: 10 },
] as const;

/** The site-wide reward for an invite that turns into a subscriber (backend CREDITS_PER_SUBSCRIBER). */
export const CREDITS_PER_INVITE = 5;

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
