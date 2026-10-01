"use client";

import { useEffect, useRef, useState, type FC, type ReactNode } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { useLenis } from "lenis/react";
import { cn } from "@/lib/utils";
import Eyebrow from "@/app/components/marketing/Eyebrow";
import JoinLink from "./JoinLink";
import { ApplyVisual, FindVisual, RehearseVisual, ScoreVisual, TailorVisual, TrackVisual, type BoardJob } from "./JourneyVisuals";

type Chapter = { key: string; short: string; title: string; body: string; canvas: string; picture: (on: boolean) => ReactNode };

/**
 * "Follow one application": the page's scrollytelling. On a desktop the heading, the chapter list
 * and a Join button stay pinned on the left while the six chapters scroll past on the right; the
 * chapter crossing the middle of the screen lights up in the list and plays its picture. On a
 * phone the chapters stack, with a slim pinned bar under the navbar saying which one you're on.
 */
const Journey: FC<{ jobs: BoardJob[]; role: string }> = ({ jobs, role }) => {
  const chapters: Chapter[] = [
    {
      key: "find",
      short: "Find",
      title: "Find a role that's really remote",
      body: "Every listing on the board is vetted: real companies hiring remotely, with where you can work from spelled out before you click.",
      canvas: "bg-secondary/40",
      picture: (on) => <FindVisual jobs={jobs} on={on} />,
    },
    {
      key: "score",
      short: "Score",
      title: "See your match before you apply",
      body: "Check your resume against the posting, keyword by keyword. You'll know what's missing before a filter does.",
      canvas: "border border-primary/10 bg-white",
      picture: (on) => <ScoreVisual role={role} on={on} />,
    },
    {
      key: "tailor",
      short: "Tailor",
      title: "Tailor it in minutes, not evenings",
      body: "AI rewrites your bullets around the posting and drafts the cover letter from your real experience. You approve every word.",
      canvas: "bg-secondary/40",
      picture: (on) => <TailorVisual on={on} />,
    },
    {
      key: "apply",
      short: "Apply",
      title: "Apply on your click",
      body: "On Greenhouse, Lever and Ashby, the browser extension fills the form from your profile and saved answers, and only when you press the button.",
      canvas: "border border-primary/10 bg-white",
      picture: (on) => <ApplyVisual role={role} on={on} />,
    },
    {
      key: "rehearse",
      short: "Rehearse",
      title: "Rehearse the interview out loud",
      body: "A voice interviewer asks the questions this role is likely to bring up, then reports on your pace, your filler words and how you position yourself.",
      canvas: "bg-secondary/40",
      picture: (on) => <RehearseVisual on={on} />,
    },
    {
      key: "track",
      short: "Track",
      title: "Follow it all the way to an offer",
      body: "Every application, stage and follow-up on one board, with a streak that makes showing up every day a little easier.",
      canvas: "border border-primary/10 bg-white",
      picture: (on) => <TrackVisual role={role} on={on} />,
    },
  ];

  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  const items = useRef<(HTMLElement | null)[]>([]);
  const track = useRef<HTMLDivElement>(null);

  // The chapter under a line across the middle of the screen is the one being read.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          setActive(index);
          setSeen((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    items.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({ target: track, offset: ["start 0.5", "end 0.5"] });
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  // The page's smooth scrolling, when it is on: it does the glide, since a native one would fight it.
  const lenis = useLenis();
  const goTo = (index: number) => {
    const el = items.current[index];
    if (!el) return;
    if (lenis) {
      lenis.scrollTo(el, { offset: -Math.max(0, (window.innerHeight - el.offsetHeight) / 2) });
      return;
    }
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  };

  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-24 md:pt-32" aria-labelledby="journey-heading">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        {/* Pinned on desktop */}
        {/* 65px navbar + 32px; the whole column (about 630px) still fits a 768px-tall laptop. */}
        <div className="lg:sticky lg:top-[97px] lg:self-start">
          <Eyebrow>How it works</Eyebrow>
          <h2
            id="journey-heading"
            className="mt-4 text-balance text-[2rem] font-extrabold leading-[1.06] tracking-tight sm:text-4xl md:text-5xl">
            Follow one application from first click to offer.
          </h2>
          <p className="mt-4 max-w-[440px] text-base leading-relaxed text-primary/70">
            Six steps every job seeker knows. This time, with backup at each one.
          </p>

          <ol className="relative mt-8 hidden flex-col lg:flex" aria-label="Chapters">
            <span className="absolute bottom-3 left-[15px] top-3 w-px bg-primary/10" aria-hidden />
            <motion.span
              style={{ scaleY: progress }}
              className="absolute bottom-3 left-[15px] top-3 w-px origin-top bg-primary"
              aria-hidden
            />
            {chapters.map((chapter, i) => (
              <li key={chapter.key}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={active === i ? "step" : undefined}
                  className={cn(
                    "group relative flex min-h-[44px] w-full items-center gap-4 rounded-lg text-left text-base font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active === i ? "text-primary" : "text-primary/40 hover:text-primary/70",
                  )}>
                  <span
                    className={cn(
                      "relative grid h-[31px] w-[31px] flex-none place-content-center rounded-[9px] border text-[11px] font-extrabold tabular-nums transition-[background-color,border-color,box-shadow] duration-200",
                      active === i ? "bg-secondary br-shadow" : "border-primary/15 bg-[#f9f8f1]",
                    )}>
                    0{i + 1}
                  </span>
                  {chapter.short}
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-8 hidden items-center gap-4 lg:flex">
            <JoinLink look="ink" />
            <span className="text-sm text-primary/60">Free · No card needed</span>
          </div>
        </div>

        {/* Chapters */}
        <div>
          {/* Phone and tablet: which chapter you're on, pinned under the navbar while the chapters scroll. */}
          <div
            className="sticky top-[65px] z-20 -mx-4 mb-6 border-b border-primary/10 bg-[#f9f8f1]/90 px-4 py-3 backdrop-blur lg:hidden"
            aria-hidden>
            <div className="flex items-center justify-between text-xs font-bold text-primary">
              <span>
                <span className="tabular-nums text-primary/50">0{active + 1}/06</span> · {chapters[active].short}
              </span>
              <JoinLink look="text" className="min-h-0 text-xs">
                Join
              </JoinLink>
            </div>
            <div className="mt-2 grid grid-cols-6 gap-1">
              {chapters.map((chapter, i) => (
                <span
                  key={chapter.key}
                  className={cn("h-1 rounded-full transition-colors duration-300", i <= active ? "bg-primary" : "bg-primary/10")}
                />
              ))}
            </div>
          </div>

          <div ref={track} className="flex flex-col gap-16 lg:gap-28">
            {chapters.map((chapter, i) => (
              <article
                key={chapter.key}
                ref={(el) => {
                  items.current[i] = el;
                }}
                data-index={i}
                aria-labelledby={`journey-${chapter.key}`}>
                <div
                  aria-hidden
                  className={cn(
                    "relative flex min-h-[320px] select-none items-center justify-center overflow-hidden rounded-[28px] px-5 py-10 sm:min-h-[400px] sm:px-10",
                    chapter.canvas,
                  )}>
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(34,35,37,0.1)_1px,transparent_1px)] bg-[length:20px_20px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
                  <div className="relative flex w-full justify-center">{chapter.picture(seen.has(i))}</div>
                </div>
                <div className="mt-6 max-w-[560px]">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary/45">
                    0{i + 1} · {chapter.short}
                  </p>
                  <h3 id={`journey-${chapter.key}`} className="mt-2 text-2xl font-extrabold tracking-tight md:text-[1.75rem]">
                    {chapter.title}
                  </h3>
                  <p className="mt-2 text-base leading-relaxed text-primary/70">{chapter.body}</p>
                </div>
              </article>
            ))}

            {/* The story's last beat, and the ask. */}
            <div className="rounded-[28px] border border-primary/10 bg-white p-8 sm:p-10">
              <p className="text-balance text-2xl font-extrabold tracking-tight md:text-3xl">
                That&apos;s the whole search. One place, one login.
              </p>
              <p className="mt-3 max-w-[460px] text-primary/70">
                We&apos;re opening it to the waitlist in batches. Joining takes five seconds.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <JoinLink look="lime">Get early access</JoinLink>
                <span className="text-sm text-primary/60">Free · no card</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Journey;
