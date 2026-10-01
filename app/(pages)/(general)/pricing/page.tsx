import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Crown, Gift, Infinity as InfinityIcon, Plus, RefreshCcw, Rocket, Sparkle, Sprout, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { absoluteUrl } from "@/app/lib/seo";
import PlanCta from "@/app/components/pricing/PlanCta";
import CreditEstimator from "@/app/components/pricing/CreditEstimator";
import PlanComparison from "@/app/components/pricing/PlanComparison";
import FaqList from "@/app/components/pricing/FaqList";
import CheckChip from "@/app/components/marketing/CheckChip";
import Eyebrow from "@/app/components/marketing/Eyebrow";
import { BillingIntervalProvider, BillingToggle, PlanCardPrice } from "@/app/components/pricing/BillingInterval";
import {
  CREDITS_PER_INVITE,
  RECOMMENDED_PLAN,
  fetchCatalogue,
  money,
  perCredit,
  yearlySavingLabel,
  type PricingPlan,
} from "@/app/lib/pricing/catalogue";

// The catalogue is cached for an hour inside fetchCatalogue; the page follows it.
export const revalidate = 3600;

const TITLE = "Pricing - Remote Worldwide";
const DESCRIPTION =
  "Simple monthly or yearly plans for Remote Worldwide's AI job-search toolkit: resume tailoring, ATS scans, cover letters and voice mock interviews. Cancel anytime.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: { type: "website", url: absoluteUrl("/pricing"), title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
};

const TAGLINES: Record<string, string> = {
  free: "To get started",
  basic: "For a steady search",
  pro: "For a focused search",
  ultra: "For an all-out search",
};

/** The small brand square beside each plan's name. A plan the page doesn't know gets the sparkle. */
const PLAN_ICONS: Record<string, LucideIcon> = { free: Sprout, basic: Zap, pro: Rocket, ultra: Crown };

/** Three plans or four, from the catalogue: four columns on desktop, two by two on a tablet, one on a phone. */
const PLAN_GRID: Record<number, string> = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What do I get on Free?",
    a: "50 credits every month, topped back up to 50 at the start of each month, for ATS scans, your cover letter, questions about a job and autofill. You also get the resume builder for one resume, one cover letter, application tracking and drafts, and streaks. AI help inside the resume builder, the career coach, the daily plan, pods and recommendations to companies come with Basic, and interview prep with Pro.",
  },
  {
    q: "Do unused credits roll over?",
    a: "Your monthly allowance refills at the start of each period and doesn't roll over. Credits from top-up packs never expire, and they're only spent once the month's allowance runs out.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Whenever you like. Pay monthly, or yearly for less, and nothing is locked in — cancel and your plan runs to the end of the period you've paid for.",
  },
  {
    q: "Do yearly plans get a year of credits at once?",
    a: "No — a yearly plan is paid once a year, and its credits refill every month, exactly like a monthly plan. Unused monthly credits don't roll over; top-up packs never expire.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "Top up with a credit pack, or wait for your allowance to refill. The free parts keep working either way: the job board, importing jobs, saved answers and autofill, and on a paid plan your first 15 coach replies each day.",
  },
  {
    q: "How are voice mock interviews billed?",
    a: "Interview prep is on Pro and Ultra. 5 credits covers up to 10 minutes of recording; past that, each extra started minute is 1 credit. You're billed on the recording, not on how many questions you get through.",
  },
  {
    q: "Can I earn credits instead of buying them?",
    a: `Yes — share your invite link. Each time someone who signed up through it subscribes, you get ${CREDITS_PER_INVITE} credits.`,
  },
  {
    q: "Is the job board still free?",
    a: (
      <>
        Always. Searching, saving and applying to <Link href="/jobs" className="font-bold underline decoration-secondary2 decoration-2 underline-offset-2 hover:decoration-primary">vetted remote roles</Link> costs nothing and needs no plan. Plans are for the AI tools.
      </>
    ),
  },
  {
    q: "How do I get started?",
    a: (
      <>
        We&apos;re letting people in from the <Link href="/waitlist" className="font-bold underline decoration-secondary2 decoration-2 underline-offset-2 hover:decoration-primary">waitlist</Link> in batches. Join, and when your spot opens you&apos;ll pick a plan and we&apos;ll walk you through the rest.
      </>
    ),
  },
];

// Used by the commented-out "What a credit buys" section below.
// const creditLabel = (credits: number, label?: string) => label ?? (credits === 0 ? "Free" : `${credits} credit${credits === 1 ? "" : "s"}`);

/** Plan copy lives in Mongo; referral search is off the public pages for now, so its line is hidden here. */
const HIDDEN_FEATURE = /referral/i;

/**
 * One plan, after the owner's reference (2026-10-01): flat and simple. The recommended plan is
 * filled lime with ink text and no border; the rest sit on a hairline. The check chips are the
 * only brutalist detail.
 */
function PlanCard({ plan }: { plan: PricingPlan }) {
  const featured = plan.key === RECOMMENDED_PLAN;
  const features = plan.features.filter((feature) => !HIDDEN_FEATURE.test(feature));
  const Icon = PLAN_ICONS[plan.key] ?? Sparkle;
  return (
    <div
      className={cn(
        "flex flex-col rounded-[20px] p-6 text-primary",
        featured ? "bg-secondary" : "border border-primary/10 bg-white",
      )}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2.5 text-lg font-bold">
          <span className={cn("grid h-9 w-9 flex-none place-content-center rounded-[10px]", featured ? "bg-primary text-secondary" : "border border-primary/10 bg-primary2 text-primary")}>
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          {plan.name}
        </p>
        {featured ? (
          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">Recommended</span>
        ) : null}
      </div>

      <PlanCardPrice plan={plan} featured={featured} />

      <p className={cn("mt-3 text-sm", featured ? "text-primary/80" : "text-primary/70")}>{TAGLINES[plan.key] ?? " "}</p>

      <hr className={cn("my-5 border-t", featured ? "border-primary/15" : "border-primary/10")} />

      <p className="text-sm font-semibold">What&apos;s included:</p>
      <ul className="mb-7 mt-3.5 flex flex-1 flex-col gap-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm leading-snug">
            <CheckChip tone={featured ? "white" : "lime"} className="mt-px" />
            <span className={featured ? "text-primary" : "text-primary/85"}>{feature}</span>
          </li>
        ))}
      </ul>

      <PlanCta planKey={plan.key} planName={plan.name} featured={featured} />
    </div>
  );
}

export default async function PricingPage() {
  const { plans, creditPacks } = await fetchCatalogue();
  // For the commented-out "What a credit buys" section (import CREDIT_COSTS to restore it).
  // const costs = { free: CREDIT_COSTS.filter((c) => c.credits === 0), paid: CREDIT_COSTS.filter((c) => c.credits > 0) };

  return (
    <BillingIntervalProvider>
      <div className="bg-[#f9f8f1] text-primary">
        {/* Hero: flat, centred, the way the owner's reference opens (2026-10-01). */}
        <section className="mx-auto max-w-[1140px] px-4 pb-12 pt-14 text-center md:pb-16 md:pt-20">
          <Eyebrow>Pricing &amp; plans</Eyebrow>
          {/* The lime marker stays (owner, 2026-10-01): behind the words in an isolated heading, so the ink text keeps its contrast. */}
          <h1 className="isolate mx-auto mt-5 max-w-[760px] text-balance text-[2.5rem] font-bold leading-[1.04] tracking-tight sm:text-6xl">
            Pick a plan.{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="absolute inset-x-[-0.12em] bottom-[0.06em] top-[0.5em] -z-10 -rotate-1 rounded-md bg-secondary" aria-hidden />
              Land the job.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-[520px] text-balance text-base text-primary/70 md:text-lg">
            Start free with 50 credits a month. Upgrade when your search picks up.
          </p>
          <BillingToggle saving={yearlySavingLabel(plans)} className="mt-8" />
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-primary/70">
            <li className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" aria-hidden /> Cancel anytime
            </li>
            <li className="flex items-center gap-2">
              <InfinityIcon className="h-4 w-4" aria-hidden /> Top-ups never expire
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" aria-hidden /> Job board always free
            </li>
          </ul>
        </section>

        {/* Plans */}
        <section className="mx-auto max-w-[1180px] px-4" aria-label="Plans">
          <div className={cn("grid gap-5", PLAN_GRID[plans.length] ?? "md:grid-cols-3")}>
            {plans.map((plan) => (
              <PlanCard key={plan.key} plan={plan} />
            ))}
          </div>

          <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-[20px] border border-primary/10 bg-white px-6 py-4 sm:flex-row sm:items-center">
            <p className="text-sm text-primary/75">
              <span className="font-bold text-primary">Just browsing?</span> The job board is free, always — search and apply to vetted remote roles without a plan.
            </p>
            <Link href="/jobs" className="group inline-flex min-h-[44px] flex-none items-center gap-1.5 text-sm font-bold underline decoration-secondary2 decoration-2 underline-offset-4 hover:decoration-primary">
              Browse remote jobs
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </section>

        {/* Comparison */}
        <section className="mx-auto max-w-[1180px] px-4 pt-24 md:pt-28" aria-labelledby="compare-heading">
          <div className="mx-auto mb-10 max-w-[620px] text-center">
            <Eyebrow>Comparison</Eyebrow>
            <h2 id="compare-heading" className="mt-4 text-3xl font-bold tracking-tight md:text-[2.75rem] md:leading-[1.1]">
              Compare our plans
            </h2>
            <p className="mt-3 text-balance text-base text-primary/70">Every tool, plan by plan. Prices follow the Monthly / Yearly switch above.</p>
          </div>
          <PlanComparison plans={plans} />
        </section>

        {/* Estimator */}
        <section className="mx-auto max-w-[1180px] px-4 pt-24 md:pt-28" aria-labelledby="estimate-heading">
          <div className="mb-8 max-w-[640px]">
            <Eyebrow>Not sure which?</Eyebrow>
            <h2 id="estimate-heading" className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              Size your plan to your search.
            </h2>
          </div>
          <CreditEstimator plans={plans} />
        </section>

        {/* What a credit buys — hidden for now; its prices live in the comparison table above.
        <section className="mx-auto max-w-[1140px] px-4 pt-24" aria-labelledby="costs-heading">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-[640px]">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary/55">Every price, up front</p>
              <h2 id="costs-heading" className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                What a credit buys.
              </h2>
            </div>
            <p className="max-w-[380px] text-sm text-primary/65">
              Credits come out of your monthly allowance first, then out of any top-ups you&apos;ve added.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            <div className="rounded-[20px] bg-secondary p-6 br-bold">
              <p className="text-lg font-bold">Always free</p>
              <ul className="mt-4 flex flex-col gap-4">
                {costs.free.map((cost) => (
                  <li key={cost.action}>
                    <p className="flex items-center justify-between gap-3 text-sm font-bold">
                      {cost.action}
                      <span className="flex-none rounded-full border-[1.5px] border-primary bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em]">
                        {creditLabel(cost.credits, cost.label)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-primary/70">{cost.detail}</p>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="grid overflow-hidden rounded-[20px] bg-white br-bold sm:grid-cols-2">
              {costs.paid.map((cost, i) => (
                <li
                  key={cost.action}
                  className={cn(
                    "flex items-start justify-between gap-4 border-primary/10 p-5",
                    i > 0 && "border-t",
                    i === 1 && "sm:border-t-0",
                    i % 2 === 1 && "sm:border-l",
                  )}>
                  <div>
                    <p className="text-sm font-bold">{cost.action}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-primary/60">{cost.detail}</p>
                  </div>
                  <span className="flex-none rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-secondary tabular-nums">
                    {creditLabel(cost.credits, cost.label)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
        */}

        {/* Top-ups */}
        <section className="mx-auto max-w-[1180px] px-4 pt-24 md:pt-28" aria-labelledby="topups-heading">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <Eyebrow>Top-ups</Eyebrow>
              <h2 id="topups-heading" className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                Big week? Add credits.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-primary/70">
                Packs never expire and are only used after your monthly allowance runs out. A plan is always the cheaper way to buy credits.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-3 py-1.5 text-xs font-semibold">
                <Gift className="h-3.5 w-3.5" aria-hidden />
                Or earn {CREDITS_PER_INVITE} credits for every friend who subscribes
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {creditPacks.map((pack) => (
                <div key={pack.key} className="rounded-[20px] border border-primary/10 bg-white p-5 transition-colors duration-150 hover:border-primary/30">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-primary/75">
                    <Plus className="h-4 w-4" aria-hidden />
                    <span className="tabular-nums">{pack.credits}</span> credits
                  </p>
                  <p className="mt-3 text-3xl font-bold tabular-nums">{money(pack.priceCents)}</p>
                  <p className="mt-1 text-xs font-medium text-primary/65 tabular-nums">{perCredit(pack.priceCents, pack.credits)} per credit</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-[820px] px-4 pt-24 md:pt-28" aria-labelledby="faq-heading">
          <div className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <h2 id="faq-heading" className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              Questions, answered.
            </h2>
          </div>
          <FaqList items={FAQ} />
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-[1180px] px-4 py-24 md:py-28">
          <div className="relative overflow-hidden rounded-[28px] bg-primary px-6 py-14 text-center text-white md:px-12 md:py-20">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(225,240,115,0.1)_1px,transparent_1px)] bg-[length:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
            <div className="relative">
              <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">
                Not ready to pick? <span className="text-secondary">Save your spot.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-[520px] text-white/75">Joining the waitlist is free. We&apos;ll email you when your spot opens — then choose a plan, or don&apos;t.</p>
              <Link
                href="/waitlist"
                className="group mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-secondary px-7 text-sm font-bold text-primary transition-colors duration-150 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary">
                Join the waitlist
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </BillingIntervalProvider>
  );
}
