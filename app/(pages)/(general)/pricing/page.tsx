import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Crown,
  Gift,
  Infinity as InfinityIcon,
  Plus,
  RefreshCcw,
  Rocket,
  Sparkle,
  Sprout,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { absoluteUrl } from "@/app/lib/seo";
import PlanCta from "@/app/components/pricing/PlanCta";
import CreditEstimator from "@/app/components/pricing/CreditEstimator";
import FaqList from "@/app/components/pricing/FaqList";
import PlanComparison from "@/app/components/pricing/PlanComparison";
import AtsMarquee from "@/app/components/pricing/AtsMarquee";
import CheckChip from "@/app/components/marketing/CheckChip";
import Eyebrow from "@/app/components/marketing/Eyebrow";
import { BillingIntervalProvider, BillingToggle, PlanCardPrice } from "@/app/components/pricing/BillingInterval";
import {
  CREDITS_PER_INVITE,
  RECOMMENDED_PLAN,
  fetchCatalogue,
  money,
  perCredit,
  savingLabels,
  type PricingPlan,
} from "@/app/lib/pricing/catalogue";

// The catalogue is cached for an hour inside fetchCatalogue; the page follows it.
export const revalidate = 3600;

// The page title takes the root template ("%s | Remote Worldwide"); social cards get the full name.
const TITLE = "Pricing | Remote Worldwide";
const DESCRIPTION =
  "Monthly, quarterly or yearly plans for Remote Worldwide: one-click autofill, a tailored resume and cover letter for every job, and voice mock interviews with your likely interviewer. Cancel anytime.";

export const metadata: Metadata = {
  title: "Pricing",
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    url: absoluteUrl("/pricing"),
    title: TITLE,
    description: DESCRIPTION,
    images: [absoluteUrl("/api/og/job")],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
};

/** The small brand square beside each plan's name. A plan the page doesn't know gets the sparkle. */
const PLAN_ICONS: Record<string, LucideIcon> = { free: Sprout, basic: Zap, pro: Rocket, ultra: Crown };

/** Three plans or four, from the catalogue: four columns on desktop, two by two on a tablet, one on a phone. */
const PLAN_GRID: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What do I get on Free?",
    a: "The job board, autofill from your profile and saved answers, application tracking and drafts, one resume and one cover letter, and 45 AI credits a month, topped back up to 45 at the start of each month. Credits pay for ATS scans, questions about a job and new AI answers. Free also includes a little AI resume help, coaching, planning and interview practice each month. Basic expands resume help, coaching and planning; Pro expands interview practice.",
  },
  {
    q: "Is autofill free, or does it use credits?",
    a: "Filling a form from your profile and your approved saved answers is free on every plan, as often as you like. Credits are only used when you ask the AI to draft a new answer to a question you haven't answered before.",
  },
  {
    q: "How does quarterly billing work?",
    a: "You pay for three months at once, for less than three monthly payments: Basic $45, Pro $80 and Ultra $150. Your monthly allowance still arrives every month, and unused credits roll over to the next month until the quarter ends. Then the leftover allowance resets and a fresh quarter starts. Most searches take 2–3 months, so one quarter usually covers yours.",
  },
  {
    q: "Do unused credits roll over?",
    a: "On quarterly plans, yes, within the quarter: what you don't use one month is still there the next, until the quarter ends. On monthly and yearly plans the allowance refills each month and doesn't roll over. Credits from top-up packs never expire on any plan, and they're only spent once your allowance runs out.",
  },
  {
    q: "Do yearly plans get a year of credits at once?",
    a: "No. A yearly plan is paid once a year, for about 20% less than paying monthly (Basic $163, Pro $299, Ultra $549), and its credits refill every month, exactly like a monthly plan. Unused monthly credits don't roll over; top-up packs never expire.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Cancel whenever you like, and your plan runs to the end of the period you've paid for. You can move up to a bigger plan or a longer billing at any time. To pay less, cancel and choose again when the period ends.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "Top up with a credit pack, or wait for your allowance to refill. The free parts keep working either way: the job board, importing jobs, drafts, tracking, and autofill from your profile and approved saved answers. New AI answers use credits, and so do coach replies past your first 15 each day on a paid plan.",
  },
  {
    q: "Why not just use ChatGPT?",
    a: "You can, and plenty of people do. Remote Worldwide does the job-search work around the writing: it tailors your resume and cover letter to the real posting and scores them against it, fills the application form for you, keeps every application in a tracker, and runs a voice mock interview with the kind of interviewer you're likely to meet, then reports on your answers and your delivery. No copying and pasting between tabs, and nothing lost between applications.",
  },
  {
    q: "How are voice mock interviews billed?",
    a: "Free and Basic include one session a month; Pro and Ultra support more practice. 5 credits covers up to 10 minutes of recording; past that, each extra started minute is 1 credit. You're billed on the recording, not on how many questions you get through.",
  },
  {
    q: "What does Ultra add?",
    a: "Everything in Pro, plus: we recommend you directly to partner companies hiring on Remote Worldwide, a person reviews your CV once a month and sends it back within 48 hours, and your support requests go first. It also has the most credits, 400 a month. A recommendation puts you in front of a hiring team; it isn't a promise of an interview.",
  },
  {
    q: "Can I earn credits instead of buying them?",
    a: `Yes. Share your invite link. Each time someone who signed up through it subscribes, you get ${CREDITS_PER_INVITE} credits.`,
  },
  {
    q: "Is the job board still free?",
    a: (
      <>
        Always. Searching, saving and applying to{" "}
        <Link href="/jobs" className="font-bold underline decoration-secondary2 decoration-2 underline-offset-2 hover:decoration-primary">
          vetted remote roles
        </Link>{" "}
        costs nothing and needs no plan. Plans are for the AI tools.
      </>
    ),
  },
  {
    q: "How do I get started?",
    a: (
      <>
        <Link href="/signup" className="font-bold underline decoration-secondary2 decoration-2 underline-offset-2 hover:decoration-primary">
          Create a free account
        </Link>
        , and you start on Free straight away. Choose a plan whenever you&apos;re ready: you pay by card on Stripe&apos;s secure
        checkout, and your credits land as soon as it goes through.
      </>
    ),
  },
];

// Used by the commented-out "What a credit buys" section below.
// const creditLabel = (credits: number, label?: string) => label ?? (credits === 0 ? "Free" : `${credits} credit${credits === 1 ? "" : "s"}`);

/** Plan copy lives in Mongo; referral search is off the public pages for now, so its line is hidden here. */
const HIDDEN_FEATURE = /referral|early access/i;

/** A feature that only restates the plan's monthly credits ("200 AI credits a month"): it goes last. */
const CREDITS_FEATURE = /^\s*[\d,]+\s+(ai\s+)?credits\b/i;

/** Outcomes first, AI credits last (owner, 2026-10-26), whatever order the rows were written in. */
const cardFeatures = (plan: PricingPlan): string[] => {
  const shown = plan.features.filter((feature) => !HIDDEN_FEATURE.test(feature));
  return [...shown.filter((feature) => !CREDITS_FEATURE.test(feature)), ...shown.filter((feature) => CREDITS_FEATURE.test(feature))];
};

/**
 * One plan, after the owner's reference (2026-10-01): flat and simple. The recommended plan is
 * filled lime with ink text and no border; the rest sit on a hairline. The check chips are the
 * only brutalist detail.
 */
function PlanCard({ plan }: { plan: PricingPlan }) {
  const featured = plan.key === RECOMMENDED_PLAN;
  const features = cardFeatures(plan);
  const Icon = PLAN_ICONS[plan.key] ?? Sparkle;
  return (
    <div className={cn("flex flex-col rounded-[20px] p-6 text-primary", featured ? "bg-secondary" : "border border-primary/10 bg-white")}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2.5 text-lg font-bold">
          <span
            className={cn(
              "grid h-9 w-9 flex-none place-content-center rounded-[10px]",
              featured ? "bg-primary text-secondary" : "border border-primary/10 bg-primary2 text-primary",
            )}>
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          {plan.name}
        </p>
        {featured ? (
          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
            Recommended
          </span>
        ) : null}
      </div>

      <PlanCardPrice plan={plan} featured={featured} />


      <hr className={cn("my-6 border-t", featured ? "border-primary/15" : "border-primary/10")} />

      <ul className="mb-7 flex flex-1 flex-col gap-3">
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
        <section className="mx-auto max-w-[1440px] px-4 pb-10 pt-14 text-center md:pb-12 md:pt-20">
          {/* Short and on one line (owner, 2026-10-27): the size follows the viewport from a tablet up so
              the sentence fits; a phone wraps it. The lime marker stays behind the last words. */}
          <h1 className="isolate mx-auto text-balance text-[2rem] font-bold leading-[1.1] tracking-tight sm:whitespace-nowrap sm:text-[clamp(1.75rem,4.4vw,3.5rem)]">
            Apply in one click. Interview{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span
                className="absolute inset-x-[-0.12em] bottom-[0.06em] top-[0.5em] -z-10 -rotate-1 rounded-md bg-secondary"
                aria-hidden
              />
              already rehearsed.
            </span>
          </h1>
        </section>

        <AtsMarquee className="pb-12 md:pb-16" />

        {/* Plans: the billing switch sits right above the cards it changes (owner, 2026-10-27). */}
        <section className="mx-auto max-w-[1180px] px-4" aria-label="Plans">
          <div className="mb-6 flex flex-col items-center gap-4">
            <BillingToggle savings={savingLabels(plans)} />
            {/* Free autofill is said once here rather than on every card (owner, 2026-10-26). */}
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-primary/70">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 flex-none" aria-hidden /> Free autofill, saved answers, drafts and tracker on every plan
              </li>
              <li className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 flex-none" aria-hidden /> Cancel anytime
              </li>
              <li className="flex items-center gap-2">
                <InfinityIcon className="h-4 w-4 flex-none" aria-hidden /> Top-ups never expire
              </li>
            </ul>
          </div>
          <div className={cn("grid gap-5", PLAN_GRID[plans.length] ?? "md:grid-cols-3")}>
            {plans.map((plan) => (
              <PlanCard key={plan.key} plan={plan} />
            ))}
          </div>

          <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-[20px] border border-primary/10 bg-white px-6 py-4 sm:flex-row sm:items-center">
            <p className="text-sm text-primary/75">
              <span className="font-bold text-primary">Just browsing?</span> The job board is free, always. Search and apply to vetted
              remote roles without a plan.
            </p>
            <Link
              href="/jobs"
              className="group inline-flex min-h-[44px] flex-none items-center gap-1.5 text-sm font-bold underline decoration-secondary2 decoration-2 underline-offset-4 hover:decoration-primary">
              Browse remote jobs
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </section>

        {/* Comparison: back on the page (owner, 2026-10-27), every feature plan by plan, no heading block. */}
        <section className="mx-auto max-w-[1180px] px-4 pt-10" aria-label="Compare plans">
          <PlanComparison plans={plans} />
        </section>

        {/* Top-ups */}
        <section className="mx-auto max-w-[1180px] px-4 pt-24" aria-labelledby="topups-heading">
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
                <div
                  key={pack.key}
                  className="rounded-[20px] border border-primary/10 bg-white p-5 transition-colors duration-150 hover:border-primary/30">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-primary/75">
                    <Plus className="h-4 w-4" aria-hidden />
                    <span className="tabular-nums">{pack.credits}</span> credits
                  </p>
                  <p className="mt-3 text-3xl font-bold tabular-nums">{money(pack.priceCents)}</p>
                  <p className="mt-1 text-xs font-medium text-primary/65 tabular-nums">
                    {perCredit(pack.priceCents, pack.credits)} per credit
                  </p>
                </div>
              ))}
            </div>
          </div>
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
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(225,240,115,0.1)_1px,transparent_1px)] bg-[length:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
              aria-hidden
            />
            <div className="relative">
              <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">
                Not ready to pick? <span className="text-secondary">Start free.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-[520px] text-white/75">
                45 credits a month, no card needed. Upgrade when your search picks up, or don&apos;t.
              </p>
              <Link
                href="/signup"
                className="group mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-secondary px-7 text-sm font-bold text-primary transition-colors duration-150 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary">
                Create a free account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </BillingIntervalProvider>
  );
}
