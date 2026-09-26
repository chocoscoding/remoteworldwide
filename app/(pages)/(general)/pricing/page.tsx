import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Coins, Gift, Infinity as InfinityIcon, Plus, RefreshCcw, Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";
import { absoluteUrl } from "@/app/lib/seo";
import PlanCta from "@/app/components/pricing/PlanCta";
import CreditEstimator from "@/app/components/pricing/CreditEstimator";
import {
  CREDIT_COSTS,
  CREDITS_PER_INVITE,
  RECOMMENDED_PLAN,
  fetchCatalogue,
  money,
  perCredit,
  type PricingPlan,
} from "@/app/lib/pricing/catalogue";

// The catalogue is cached for an hour inside fetchCatalogue; the page follows it.
export const revalidate = 3600;

const TITLE = "Pricing - Remote Worldwide";
const DESCRIPTION =
  "Simple monthly plans for Remote Worldwide's AI job-search toolkit: resume tailoring, ATS scans, cover letters, voice mock interviews and referral search. Cancel anytime.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: { type: "website", url: absoluteUrl("/pricing"), title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
};

const TAGLINES: Record<string, string> = {
  starter: "For a focused search",
  growth: "For an active search",
  scale: "For an all-out search",
};

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Do unused credits roll over?",
    a: "Your monthly allowance refills at the start of each period and doesn't roll over. Credits from top-up packs never expire, and they're only spent once the month's allowance runs out.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Whenever you like. Every plan is monthly and nothing is locked in — cancel and your plan runs to the end of the period you've paid for.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "Top up with a credit pack, or wait for your allowance to refill. The free parts keep working either way: the job board, importing jobs, typed practice interviews and your first 15 coach replies each day.",
  },
  {
    q: "How are voice mock interviews billed?",
    a: "5 credits covers up to 10 minutes of recording. Past that, each extra started minute is 1 credit. You're billed on the recording, not on how many questions you get through.",
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

const creditLabel = (credits: number, label?: string) => label ?? (credits === 0 ? "Free" : `${credits} credit${credits === 1 ? "" : "s"}`);

function PlanCard({ plan }: { plan: PricingPlan }) {
  const featured = plan.key === RECOMMENDED_PLAN;
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-[24px] border-2 border-primary p-6 md:p-7",
        featured ? "bg-primary text-white shadow-[8px_8px_0_0_#e1f073] md:-translate-y-4" : "bg-white text-primary shadow-[6px_6px_0_0_#222325]",
      )}>
      {featured ? (
        <span className="absolute -top-4 right-6 rotate-3 rounded-full border-2 border-primary bg-secondary px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.08em] text-primary shadow-[2px_2px_0_0_#222325]">
          Recommended
        </span>
      ) : null}

      <p className="text-xl font-extrabold">{plan.name}</p>
      <p className={cn("mt-0.5 text-sm", featured ? "text-white/60" : "text-primary/55")}>{TAGLINES[plan.key] ?? " "}</p>

      <p className="mt-6 flex items-baseline gap-1.5">
        <span className="text-5xl font-extrabold tracking-tight tabular-nums">{money(plan.priceCents, plan.currency)}</span>
        <span className={cn("text-sm font-semibold", featured ? "text-white/60" : "text-primary/55")}>/{plan.interval}</span>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold tabular-nums",
            featured ? "border-secondary bg-secondary text-primary" : "border-primary bg-[#f9f8f1]",
          )}>
          <Coins className="h-3.5 w-3.5" aria-hidden />
          {plan.monthlyCredits} credits / {plan.interval}
        </span>
        <span className={cn("text-xs font-semibold tabular-nums", featured ? "text-white/55" : "text-primary/50")}>
          {perCredit(plan.priceCents, plan.monthlyCredits, plan.currency)} per credit
        </span>
      </div>

      <hr className={cn("my-6 border-t-2 border-dashed", featured ? "border-white/20" : "border-primary/15")} />

      <ul className="mb-8 flex flex-1 flex-col gap-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm leading-snug">
            <span
              className={cn(
                "mt-px grid h-5 w-5 flex-none place-content-center rounded-full border-2",
                featured ? "border-secondary bg-secondary text-primary" : "border-primary bg-secondary text-primary",
              )}>
              <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />
            </span>
            <span className={featured ? "text-white/90" : "text-primary/85"}>{feature}</span>
          </li>
        ))}
      </ul>

      <PlanCta planKey={plan.key} planName={plan.name} featured={featured} />
    </div>
  );
}

export default async function PricingPage() {
  const { plans, creditPacks } = await fetchCatalogue();
  const costs = { free: CREDIT_COSTS.filter((c) => c.credits === 0), paid: CREDIT_COSTS.filter((c) => c.credits > 0) };

  return (
    <div className="bg-[#f9f8f1] text-primary">
      {/* Hero */}
      <section className="relative overflow-hidden border-b-2 border-primary">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(34,35,37,0.13)_1px,transparent_1px)] bg-[length:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-secondary/60 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-[1100px] px-4 pb-24 pt-14 text-center md:pb-28 md:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-primary bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] shadow-[3px_3px_0_0_#222325]">
            <Sparkle className="h-3.5 w-3.5 fill-secondary text-primary" aria-hidden />
            Pricing
          </span>
          <h1 className="isolate mx-auto mt-6 max-w-[820px] text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
            Simple plans.{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="absolute inset-x-[-0.12em] bottom-[0.06em] top-[0.5em] -z-10 -rotate-1 rounded-md bg-secondary" aria-hidden />
              Credits
            </span>{" "}
            for the AI.
          </h1>
          <p className="mx-auto mt-6 max-w-[620px] text-base text-primary/70 md:text-lg">
            Every plan is monthly and comes with a credit allowance that refills each period. Spend it on whichever tools your search needs this week.
          </p>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-primary/75">
            <li className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" aria-hidden /> Monthly, cancel anytime
            </li>
            <li className="flex items-center gap-2">
              <InfinityIcon className="h-4 w-4" aria-hidden /> Top-ups never expire
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4" aria-hidden /> Job board free forever
            </li>
          </ul>
        </div>
      </section>

      {/* Plans */}
      <section className="relative mx-auto -mt-12 max-w-[1140px] px-4" aria-label="Plans">
        <div className="grid gap-8 md:grid-cols-3 md:gap-6 md:pt-4">
          {plans.map((plan) => (
            <PlanCard key={plan.key} plan={plan} />
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-[20px] border-2 border-dashed border-primary/40 bg-white/60 px-6 py-5 sm:flex-row sm:items-center">
          <p className="text-sm text-primary/75">
            <span className="font-bold text-primary">Just browsing?</span> The job board is free, always — search and apply to vetted remote roles without a plan.
          </p>
          <Link href="/jobs" className="group inline-flex flex-none items-center gap-1.5 text-sm font-bold underline decoration-secondary2 decoration-2 underline-offset-4 hover:decoration-primary">
            Browse remote jobs
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Estimator */}
      <section className="mx-auto max-w-[1140px] px-4 pt-24" aria-labelledby="estimate-heading">
        <div className="mb-8 max-w-[640px]">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary/55">Not sure which?</p>
          <h2 id="estimate-heading" className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
            Size your plan to your search.
          </h2>
        </div>
        <CreditEstimator plans={plans} />
      </section>

      {/* What a credit buys */}
      <section className="mx-auto max-w-[1140px] px-4 pt-24" aria-labelledby="costs-heading">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-[640px]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary/55">Every price, up front</p>
            <h2 id="costs-heading" className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
              What a credit buys.
            </h2>
          </div>
          <p className="max-w-[380px] text-sm text-primary/65">
            Credits come out of your monthly allowance first, then out of any top-ups you&apos;ve added.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="rounded-[20px] border-2 border-primary bg-secondary p-6 shadow-[5px_5px_0_0_#222325]">
            <p className="text-lg font-extrabold">Always free</p>
            <ul className="mt-4 flex flex-col gap-4">
              {costs.free.map((cost) => (
                <li key={cost.action}>
                  <p className="flex items-center justify-between gap-3 text-sm font-bold">
                    {cost.action}
                    <span className="flex-none rounded-full border-2 border-primary bg-white px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.06em]">
                      {creditLabel(cost.credits, cost.label)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-primary/70">{cost.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          <ul className="grid overflow-hidden rounded-[20px] border-2 border-primary bg-white shadow-[5px_5px_0_0_#222325] sm:grid-cols-2">
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

      {/* Top-ups */}
      <section className="mx-auto max-w-[1140px] px-4 pt-24" aria-labelledby="topups-heading">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary/55">Top-ups</p>
            <h2 id="topups-heading" className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
              Big week? Add credits.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-primary/70">
              Packs never expire and are only used after your monthly allowance runs out. A plan is always the cheaper way to buy credits.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-primary bg-white px-3 py-1.5 text-xs font-bold">
              <Gift className="h-3.5 w-3.5" aria-hidden />
              Or earn {CREDITS_PER_INVITE} credits for every friend who subscribes
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {creditPacks.map((pack) => (
              <div key={pack.key} className="rounded-[20px] border-2 border-primary bg-white p-5 shadow-[4px_4px_0_0_#222325] transition-transform hover:-translate-y-1">
                <p className="flex items-center gap-1.5 text-sm font-bold text-primary/70">
                  <Plus className="h-4 w-4" aria-hidden />
                  <span className="tabular-nums">{pack.credits}</span> credits
                </p>
                <p className="mt-3 text-3xl font-extrabold tabular-nums">{money(pack.priceCents)}</p>
                <p className="mt-1 text-xs font-semibold text-primary/50 tabular-nums">{perCredit(pack.priceCents, pack.credits)} per credit</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[860px] px-4 pt-24" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">
          Questions, answered.
        </h2>
        <div className="mt-10 flex flex-col gap-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-[18px] border-2 border-primary bg-white transition-shadow open:shadow-[4px_4px_0_0_#e1f073]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-bold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="grid h-7 w-7 flex-none place-content-center rounded-full border-2 border-primary transition-transform duration-200 group-open:rotate-45 group-open:bg-secondary">
                  <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-primary/75">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-[1140px] px-4 py-24">
        <div className="relative overflow-hidden rounded-[28px] border-2 border-primary bg-primary px-6 py-12 text-center text-white shadow-[8px_8px_0_0_#e1f073] md:px-12 md:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(225,240,115,0.14)_1px,transparent_1px)] bg-[length:20px_20px]" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
              Not ready to pick? <span className="text-secondary">Save your spot.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[520px] text-white/70">Joining the waitlist is free. We&apos;ll email you when your spot opens — then choose a plan, or don&apos;t.</p>
            <Link
              href="/waitlist"
              className="group mt-8 inline-flex h-12 items-center gap-2 rounded-xl border-2 border-secondary bg-secondary px-7 text-sm font-bold text-primary shadow-[4px_4px_0_0_#ffffff] transition-[transform,box-shadow] duration-100 hover:shadow-[2px_2px_0_0_#ffffff] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
              Join the waitlist
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
