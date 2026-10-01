import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Link from "next/link";
import { ArrowRight, Sparkle, X } from "lucide-react";
import { absoluteUrl } from "@/app/lib/seo";
import { fetchLatestJobs, getAllActiveJobsCount } from "@/libs/query";
import WaitlistForm, { WaitlistFormFromParams } from "@/app/components/waitlist/WaitlistForm";
import ProductCollage from "@/app/components/waitlist/ProductCollage";
import ProblemStory, { type StoryLine } from "@/app/components/waitlist/ProblemStory";
import Journey from "@/app/components/waitlist/Journey";
import LiveBoard from "@/app/components/waitlist/LiveBoard";
import StepVisual from "@/app/components/waitlist/StepVisuals";
import JoinLink from "@/app/components/waitlist/JoinLink";
import type { BoardJob } from "@/app/components/waitlist/JourneyVisuals";
import CheckChip from "@/app/components/marketing/CheckChip";
import Eyebrow from "@/app/components/marketing/Eyebrow";
import FaqList from "@/app/components/pricing/FaqList";

const TITLE = "Join the waitlist - Remote Worldwide";
const DESCRIPTION =
  "Get early access to Remote Worldwide's AI job-search toolkit: tailor your resume to every posting, rehearse interviews out loud and track every application.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/waitlist" },
  openGraph: { type: "website", url: absoluteUrl("/waitlist"), title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/api/og/job")] },
};

// The live-board number and postings are read from the board, so the page is rebuilt hourly.
export const revalidate = 3600;

// The problem paragraph's own Manrope: the variable cut, because the site loads fixed weights that
// stop at 700 (600 and 800 both draw as 700), and its stress words need to thicken smoothly from
// 600 to 700 as they're read. Loaded on this page only.
const storyFont = Manrope({ subsets: ["latin"], display: "swap" });

const MARQUEE = ["ATS scans", "Cover letters", "Voice mock interviews", "AI career coach", "Application tracker", "Browser extension", "Resume tailoring"];

/** Act one: the problem, inked in as it scrolls. */
const STORY: StoryLine[] = [
  { text: "You found the perfect remote role." },
  { text: "So did people in every time zone." },
  { text: "So you *rewrite* your resume at midnight, *guess* which *keywords* the *filter* wants, *rehearse* answers in your head, and *lose* track of who you followed up with." },
  { text: "Job hunting quietly became a second job.", mark: true },
];

/** "The old way → the Remote Worldwide way", as the reference landing sets its "why" out. */
const WHY: { old: string; now: string }[] = [
  { old: "Rewriting your resume for every posting", now: "Tailored to each posting in minutes" },
  { old: "Guessing which keywords the ATS wants", now: "A keyword-by-keyword match score" },
  { old: "Rehearsing answers in your head", now: "Mock interviews out loud, with a report" },
  { old: "Applications lost across tabs and sheets", now: "Every application on one board" },
  { old: "Typing the same answers on every form", now: "Autofill from saved answers, on your click" },
];

const STEPS = [
  { title: "Join the list", body: "Leave your email. It takes five seconds and costs nothing." },
  { title: "Get your invite", body: "We open spots in batches and email you the moment yours is ready." },
  // Pricing is linked once, at the bottom of the page (owner, 2026-10-01).
  { title: "Pick a plan", body: "Start on Free, or take monthly credits for the AI tools. Change or cancel whenever." },
];

const LINK = "font-bold underline decoration-secondary2 decoration-2 underline-offset-2 hover:decoration-primary";

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "When will I get in?",
    a: "We open spots in batches, in the order people joined. You'll get one email the moment yours is ready.",
  },
  {
    q: "Is joining free?",
    a: "Yes. Joining costs nothing and needs no card. When your spot opens you can stay on Free or pick a plan.",
  },
  {
    q: "Do I have to choose a plan now?",
    a: "No. If you came from pricing we note the plan you were eyeing, but you choose for real only once you're in, and you can change your mind whenever.",
  },
  {
    q: "What's free, and what needs a plan?",
    a: (
      <>
        Free comes with 50 credits a month, one resume, one cover letter, ATS scans, application tracking and streaks. Resume AI, the career coach, the daily plan and pods start at Basic, and interview prep at Pro. Everything is on the{" "}
        <Link href="/pricing" className={LINK}>
          pricing page
        </Link>
        .
      </>
    ),
  },
  {
    q: "What will you email me?",
    a: (
      <>
        A confirmation now, then one email when your spot opens — no spam, ever. More in our{" "}
        <Link href="/privacy-policy" className={LINK}>
          privacy policy
        </Link>
        .
      </>
    ),
  },
  {
    q: "Can I use anything before my invite?",
    a: (
      <>
        Yes — the{" "}
        <Link href="/jobs" className={LINK}>
          job board
        </Link>{" "}
        is open to everyone. Search and apply to vetted remote roles, free, right now.
      </>
    ),
  },
];

const LIVE_DOT = (
  <span className="relative flex h-2 w-2 flex-none" aria-hidden>
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary2 opacity-90 motion-reduce:animate-none" />
    <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary2 ring-1 ring-primary/40" />
  </span>
);

/** The story follows one role; a design posting from the board if there is one, so the samples after it fit. */
const STORY_ROLE = "Senior Product Designer";

async function readBoard(): Promise<{ count: number | null; jobs: BoardJob[] }> {
  const [counted, latest] = await Promise.all([
    getAllActiveJobsCount().catch(() => ({ count: null })),
    fetchLatestJobs(24).catch(() => ({ data: [] })),
  ]);
  const jobs = latest.data.map(
    (job): BoardJob => ({
      title: job.title,
      company: job.company?.name ?? "A remote team",
      logo: job.company?.logo || null,
      region: job.region.length > 0 ? job.region[0] : "Anywhere in the world",
    }),
  );
  return { count: counted.count, jobs };
}

/**
 * Told as a story, after the SaaS landing the owner pointed at (2026-10-01): the promise (hero),
 * the problem (a paragraph that inks itself in), one application followed from first click to
 * offer (pinned scrollytelling), proof that the board is live, the old way against ours, what
 * happens after you join, questions, and the ask again with a real form. "Join the waitlist" comes
 * back after every act, and a floating pill keeps it in reach between forms. Half brutalism, half
 * flat: hairlines and whitespace by default, ink outlines and hard shadows on the illustrations,
 * the live count and the buttons.
 */
export default async function WaitlistPage() {
  const { count, jobs } = await readBoard();
  const design = jobs.find((job) => /design/i.test(job.title));
  const role = design?.title ?? STORY_ROLE;
  // The posting the story saves comes first, then two more from the board.
  const findJobs = design ? [design, ...jobs.filter((job) => job !== design)] : jobs;
  const boardJobs: BoardJob[] = findJobs.length > 0 ? findJobs : [{ title: STORY_ROLE, company: "A remote-first team", logo: null, region: "Anywhere in the world" }];

  return (
    <div className="bg-[#f9f8f1] text-primary">
      {/* Hero: the promise */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 pb-16 pt-10 md:pb-24 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
        <div id="join" className="scroll-mt-28">
          <Eyebrow dot={LIVE_DOT}>Early access · opening in batches</Eyebrow>

          <h1 className="isolate mt-6 text-[2.375rem] font-extrabold leading-[1.04] tracking-tight xs:text-5xl sm:text-6xl xl:text-[4.25rem]">
            Land your next remote role{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="absolute inset-x-[-0.1em] bottom-[0.05em] top-[0.52em] -z-10 -rotate-1 rounded-md bg-secondary" aria-hidden />
              faster.
            </span>
          </h1>

          <p className="mt-5 max-w-[520px] text-base leading-relaxed text-primary/70 md:text-lg">
            Remote Worldwide pairs a board of vetted remote roles with the AI tools to win them: a resume tailored to every posting, interviews rehearsed out loud, and every application in one place.
          </p>

          <Suspense fallback={<WaitlistForm initialPlan={null} />}>
            <WaitlistFormFromParams />
          </Suspense>

          <ul className="mt-5 flex flex-wrap items-center gap-x-6 text-sm font-medium text-primary/75">
            {["Free to join", "No card needed"].map((item) => (
              <li key={item} className="flex min-h-[44px] items-center gap-2.5">
                <CheckChip size="sm" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <ProductCollage />
      </section>

      {/* Marquee */}
      <div className="overflow-hidden bg-secondary py-3" aria-hidden>
        <div className="marquee-track flex w-max">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex flex-none items-center">
              {MARQUEE.map((item) => (
                <span key={item} className="flex items-center gap-6 whitespace-nowrap pr-6 text-sm font-extrabold uppercase tracking-[0.12em] text-primary">
                  {item}
                  <Sparkle className="h-4 w-4 fill-primary" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Act one: the problem */}
      <section className="mx-auto max-w-[1000px] px-4 pt-24 md:pt-36" aria-label="The problem">
        <Eyebrow>The problem</Eyebrow>
        <ProblemStory
          lines={STORY}
          className={`${storyFont.className} mt-6 text-[1.5rem] leading-[1.2] tracking-tight text-primary sm:text-[1.75rem] lg:text-[2.4rem] lg:leading-[1.25]`}
        />
        <div className="mt-10 flex flex-col gap-5 border-t border-primary/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg font-bold md:text-xl">So we&apos;re building the way out.</p>
          <JoinLink look="lime">Get early access</JoinLink>
        </div>
      </section>

      {/* Act two: one application, followed from first click to offer */}
      <Journey jobs={boardJobs} role={role} />

      {/* Act three: proof */}
      <LiveBoard count={count} jobs={jobs} />

      {/* Act four: the old way against ours */}
      <section className="mx-auto max-w-[1200px] px-4 pt-24 md:pt-32" aria-labelledby="why-heading">
        <div className="mx-auto mb-12 max-w-[680px] text-center">
          <Eyebrow>Why Remote Worldwide</Eyebrow>
          <h2 id="why-heading" className="mt-4 text-balance text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl">
            Job hunting shouldn&apos;t feel like a second job.
          </h2>
        </div>

        <div className="mx-auto max-w-[820px] rounded-[22px] border border-primary/10 bg-white px-2 py-2 sm:px-4">
          <div className="hidden grid-cols-[1fr_48px_1fr] items-center px-3 py-3 text-[11px] font-extrabold uppercase tracking-[0.14em] sm:grid" aria-hidden>
            <span className="text-right text-primary/45">The old way</span>
            <ArrowRight className="mx-auto h-4 w-4 text-primary/30" />
            <span className="text-primary">The Remote Worldwide way</span>
          </div>
          <ul>
            {WHY.map((row) => (
              // Phones have no header row, so the first pair goes without its top hairline there.
              <li key={row.old} className="grid gap-2.5 border-t border-primary/10 px-3 py-4 first:border-t-0 sm:grid-cols-[1fr_48px_1fr] sm:items-center sm:gap-0 sm:py-3.5 sm:first:border-t">
                <span className="flex items-center gap-2.5 text-sm text-primary/50 sm:flex-row-reverse sm:text-right">
                  <span className="grid h-[18px] w-[18px] flex-none place-content-center rounded-[5px] bg-[#f6ddd6] text-[#b23c26]" aria-hidden>
                    <X className="h-2.5 w-2.5" strokeWidth={4} />
                  </span>
                  <span>
                    <span className="sr-only">The old way: </span>
                    {row.old}
                  </span>
                </span>
                <ArrowRight className="mx-auto hidden h-4 w-4 text-primary/30 sm:block" aria-hidden />
                <span className="flex items-center gap-2.5 text-sm font-semibold text-primary">
                  <CheckChip size="sm" />
                  <span>
                    <span className="sr-only">With Remote Worldwide: </span>
                    {row.now}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-col items-center text-center">
          <p className="max-w-[440px] text-primary/70">One toolkit for the whole search, built around a board of vetted remote roles.</p>
          <JoinLink look="ink" className="mt-6" />
        </div>
      </section>

      {/* Act five: what happens after you join */}
      <section className="mx-auto max-w-[1200px] px-4 pt-24 md:pt-32" aria-labelledby="how-heading">
        <div className="mx-auto mb-12 max-w-[680px] text-center">
          <Eyebrow>How early access works</Eyebrow>
          <h2 id="how-heading" className="mt-4 text-balance text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl">
            Three steps. One of them is waiting.
          </h2>
        </div>
        <ol className="grid gap-10 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <StepVisual index={i} />
              <h3 className="mt-5 text-xl font-extrabold">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-1.5 max-w-[340px] text-sm leading-relaxed text-primary/70">{step.body}</p>
              {i === 0 ? <JoinLink look="text" className="mt-2">Do it now</JoinLink> : null}
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1200px] px-4 pt-24 md:pt-32" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-[760px]">
          <div className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <h2 id="faq-heading" className="mt-4 text-balance text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl">
              Before you join.
            </h2>
          </div>
          <FaqList items={FAQ} />
        </div>
      </section>

      {/* The ask, with the form right here */}
      <section className="mx-auto max-w-[1200px] px-4 py-24 md:py-32" aria-labelledby="final-heading">
        <div className="relative overflow-hidden rounded-[28px] bg-primary px-5 py-14 text-center text-white sm:px-6 md:px-12 md:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(225,240,115,0.12)_1px,transparent_1px)] bg-[length:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
          <Sparkle className="absolute left-8 top-8 hidden h-10 w-10 fill-secondary text-secondary md:block" aria-hidden />
          <Sparkle className="absolute bottom-10 right-10 hidden h-6 w-6 fill-secondary text-secondary md:block" aria-hidden />
          <div className="relative">
            <h2 id="final-heading" className="text-balance text-3xl font-extrabold tracking-tight md:text-5xl">
              Your spot is <span className="text-secondary">waiting.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[480px] text-white/75">Leave your email and you&apos;re in line. We&apos;ll write the moment your spot opens.</p>
            <Suspense fallback={<WaitlistForm initialPlan={null} tone="dark" inputId="waitlist-email-final" className="mx-auto max-w-[560px]" />}>
              <WaitlistFormFromParams tone="dark" inputId="waitlist-email-final" className="mx-auto max-w-[560px]" />
            </Suspense>
            <Link href="/pricing" className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-white/80 underline decoration-white/30 decoration-2 underline-offset-4 hover:text-white hover:decoration-secondary">
              See pricing first
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
