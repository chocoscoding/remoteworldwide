import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUp, Check, MessagesSquare, Mic, PenLine, Puzzle, ScanSearch, Sparkle, SquareKanban, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { absoluteUrl } from "@/app/lib/seo";
import WaitlistForm, { WaitlistFormFromParams } from "@/app/components/waitlist/WaitlistForm";
import ProductCollage from "@/app/components/waitlist/ProductCollage";

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

const MARQUEE = ["ATS scans", "Cover letters", "Voice mock interviews", "AI career coach", "Application tracker", "Browser extension", "Resume tailoring"];

const FEATURES: { icon: LucideIcon; title: string; body: string; className?: string; dark?: boolean }[] = [
  {
    icon: Mic,
    title: "Rehearse interviews out loud",
    body: "An AI interviewer asks the likely questions for the exact role, then reports on your delivery, positioning and grammar — every point backed by what you actually said.",
    className: "md:col-span-2",
    dark: true,
  },
  { icon: ScanSearch, title: "Get past the ATS", body: "Score your resume against any posting and see exactly which keywords are missing." },
  { icon: PenLine, title: "Cover letters that fit", body: "A first draft grounded in the posting and your resume, revised to your notes." },
  { icon: MessagesSquare, title: "A coach on call", body: "Plan your week, unstick an application or prep for a call. 15 free replies a day." },
  { icon: SquareKanban, title: "Track every application", body: "Every role, stage and follow-up on one board, so nothing slips." },
  {
    icon: Puzzle,
    title: "Apply faster with the extension",
    body: "On Greenhouse, Lever and Ashby, fill applications from your saved answers and resume — only ever when you click.",
    className: "md:col-span-3",
  },
];

const STEPS = [
  { title: "Join the list", body: "Leave your email. It takes five seconds and costs nothing." },
  { title: "Get your invite", body: "We open spots in batches and email you the moment yours is ready." },
  { title: "Pick a plan", body: "Monthly credits for the AI tools. Change or cancel whenever.", href: "/pricing", cta: "See pricing" },
];

export default function WaitlistPage() {
  return (
    <div className="bg-[#f9f8f1] text-primary">
      {/* Hero */}
      <section className="relative overflow-hidden border-b-2 border-primary">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(34,35,37,0.13)_1px,transparent_1px)] bg-[length:22px_22px] [mask-image:linear-gradient(to_bottom,black_60%,transparent)]" aria-hidden />
        <div className="pointer-events-none absolute -right-32 top-10 h-[420px] w-[420px] rounded-full bg-secondary/50 blur-3xl" aria-hidden />

        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-4 pb-16 pt-12 md:pb-20 md:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
          <div id="join" className="scroll-mt-28">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-primary bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] shadow-[3px_3px_0_0_#222325]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary2 opacity-90 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary2" />
              </span>
              Early access · opening in batches
            </span>

            <h1 className="isolate mt-6 text-[2.75rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl">
              Land your next remote role{" "}
              <span className="relative inline-block whitespace-nowrap">
                <span className="absolute inset-x-[-0.1em] bottom-[0.05em] top-[0.52em] -z-10 -rotate-1 rounded-md bg-secondary" aria-hidden />
                faster.
              </span>
            </h1>

            <p className="mt-6 max-w-[540px] text-base leading-relaxed text-primary/70 md:text-lg">
              We&apos;re building an AI toolkit around the Remote Worldwide job board: tailor your resume to every posting, rehearse interviews out loud, and keep every application in one place.
            </p>

            <Suspense fallback={<WaitlistForm initialPlan={null} />}>
              <WaitlistFormFromParams />
            </Suspense>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-primary/70">
              {["Free to join", "No card needed"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-content-center rounded-full border-2 border-primary bg-secondary">
                    <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-content-center rounded-full border-2 border-primary bg-secondary">
                  <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />
                </span>
                <Link href="/pricing" className="underline decoration-secondary2 decoration-2 underline-offset-4 hover:decoration-primary">
                  Pricing up front
                </Link>
              </li>
            </ul>
          </div>

          <ProductCollage />
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-b-2 border-primary bg-secondary py-3.5" aria-hidden>
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

      {/* What's inside */}
      <section className="mx-auto max-w-[1200px] px-4 pt-24" aria-labelledby="inside-heading">
        <div className="mb-10 max-w-[640px]">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary/55">What&apos;s inside</p>
          <h2 id="inside-heading" className="mt-2 text-3xl font-extrabold tracking-tight md:text-5xl">
            Every step of the search, with backup.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, className, dark }) => (
            <div
              key={title}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-[22px] border-2 border-primary p-6 transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 md:p-7",
                dark ? "bg-primary text-white shadow-[6px_6px_0_0_#e1f073] hover:shadow-[8px_8px_0_0_#e1f073]" : "bg-white shadow-[6px_6px_0_0_#222325] hover:shadow-[8px_8px_0_0_#222325]",
                className,
              )}>
              {dark ? (
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(225,240,115,0.12)_1px,transparent_1px)] bg-[length:18px_18px]" aria-hidden />
              ) : null}
              <span
                className={cn(
                  "relative grid h-12 w-12 place-content-center rounded-xl border-2",
                  dark ? "border-secondary bg-secondary text-primary" : "border-primary bg-secondary text-primary",
                )}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className={cn("relative", dark ? "mt-10 md:max-w-[520px]" : "mt-8")}>
                <h3 className={cn("font-extrabold tracking-tight", dark ? "text-2xl md:text-3xl" : "text-xl")}>{title}</h3>
                <p className={cn("mt-2 text-sm leading-relaxed", dark ? "text-white/70 md:text-base" : "text-primary/65")}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1200px] px-4 pt-24" aria-labelledby="how-heading">
        <div className="mb-10 max-w-[640px]">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary/55">How early access works</p>
          <h2 id="how-heading" className="mt-2 text-3xl font-extrabold tracking-tight md:text-5xl">
            Three steps. One of them is waiting.
          </h2>
        </div>
        <ol className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-[22px] border-2 border-primary bg-white p-6 shadow-[4px_4px_0_0_#222325] md:p-7">
              <span className="text-6xl font-extrabold leading-none tracking-tight text-secondary [-webkit-text-stroke:2px_#222325] [paint-order:stroke_fill]">0{i + 1}</span>
              <h3 className="mt-4 text-xl font-extrabold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-primary/65">{step.body}</p>
              {step.href ? (
                <Link href={step.href} className="group mt-4 inline-flex items-center gap-1.5 text-sm font-bold underline decoration-secondary2 decoration-2 underline-offset-4 hover:decoration-primary">
                  {step.cta}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-[1200px] px-4 py-24">
        <div className="relative overflow-hidden rounded-[28px] border-2 border-primary bg-primary px-6 py-12 text-center text-white shadow-[8px_8px_0_0_#e1f073] md:px-12 md:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(225,240,115,0.14)_1px,transparent_1px)] bg-[length:20px_20px]" aria-hidden />
          <Sparkle className="absolute left-8 top-8 hidden h-10 w-10 fill-secondary text-secondary md:block" aria-hidden />
          <Sparkle className="absolute bottom-10 right-10 hidden h-6 w-6 fill-secondary text-secondary md:block" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">
              Your spot is <span className="text-secondary">waiting.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[480px] text-white/70">It&apos;s free, takes five seconds, and we&apos;ll email you the moment your spot opens.</p>
            <a
              href="#join"
              className="group mt-8 inline-flex h-12 items-center gap-2 rounded-xl border-2 border-secondary bg-secondary px-7 text-sm font-bold text-primary shadow-[4px_4px_0_0_#ffffff] transition-[transform,box-shadow] duration-100 hover:shadow-[2px_2px_0_0_#ffffff] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
              Join the waitlist
              <ArrowUp className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" aria-hidden />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
