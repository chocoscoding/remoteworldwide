"use client";

import { useEffect, useRef, useState, type FC } from "react";
import { motion } from "motion/react";
import { FileText, PenLine, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import CheckChip from "@/app/components/marketing/CheckChip";
import { ApplyVisual, RehearseVisual, ScoreVisual, TailorVisual, TrackVisual } from "@/app/components/waitlist/JourneyVisuals";
import type { ToolKey } from "@/app/lib/tools/catalogue";

// Each tool page's picture: the same samples /waitlist tells its story with, played once the
// picture is mostly on screen. Decorative (aria-hidden): every person, bullet and score on them is
// a sample, never a real user or employer.

/** The story's one role, as on /waitlist, so the samples (bullets, keywords, letter) fit it. */
const ROLE = "Senior Product Designer";

const LETTER = [
  { text: "Dear hiring team,", fresh: false },
  { text: "Your posting asks for someone who can turn research into a design system people actually use.", fresh: true },
  { text: "At a fintech startup I led a checkout redesign, testing three variants with product and finance.", fresh: true },
  { text: "I'd love to bring that to your team.", fresh: false },
];

const CoverVisual: FC<{ on: boolean }> = ({ on }) => (
  <div className="w-full max-w-[400px]">
    <div className="rounded-[20px] bg-white p-5 br-bold">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary/65">
          <FileText className="h-3.5 w-3.5" /> Cover letter
        </span>
        <span className="truncate rounded-full border border-primary/25 px-2 py-0.5 text-[10px] font-bold text-primary">{ROLE}</span>
      </div>
      <div className="mt-4 flex flex-col gap-2 text-[12px] leading-snug text-primary">
        {LETTER.map((line, i) => (
          <motion.p
            key={line.text}
            initial={false}
            animate={on ? { opacity: 1, y: 0 } : { opacity: 0.15, y: 4 }}
            transition={{ duration: 0.35, delay: 0.2 + i * 0.35 }}
            className={cn(line.fresh && "rounded-lg bg-secondary/40 p-2")}>
            {line.fresh ? <Sparkles className="mr-1.5 inline h-3 w-3 -translate-y-px" /> : null}
            {line.text}
          </motion.p>
        ))}
      </div>
    </div>
    <motion.div
      initial={false}
      animate={on ? { opacity: 1, y: 0, rotate: 2 } : { opacity: 0, y: 10, rotate: 0 }}
      transition={{ duration: 0.4, delay: 1.7 }}
      className="-mt-3 ml-auto mr-3 flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-primary br-shadow">
      <PenLine className="h-3.5 w-3.5" />
      From your real experience
      <CheckChip size="sm" />
    </motion.div>
  </div>
);

const DRAFT_FIELDS = [
  { label: "Full name", value: "Ada Okafor" },
  { label: "Portfolio", value: "adaokafor.design" },
  { label: "Why do you want to work here?", value: "Your design system work is the kind I've been…" },
  { label: "Notice period", value: "Two weeks" },
];

/**
 * The extension's drafts: a form opened again later, its page button wearing the amber "!", the
 * hover card offering "Continue my draft", and the saved answers going back in once it's pressed.
 */
const DraftVisual: FC<{ on: boolean }> = ({ on }) => (
  <div className="w-full max-w-[400px] overflow-hidden rounded-[20px] border border-primary/15 bg-white">
    <div className="flex items-center gap-1.5 border-b border-primary/10 bg-[#f4f3ec] px-4 py-2.5">
      {[0, 1, 2].map((d) => (
        <span key={d} className="h-2 w-2 flex-none rounded-full bg-primary/15" />
      ))}
      <span className="ml-2 truncate text-[11px] font-semibold text-primary/55">Apply · {ROLE}</span>
      <span className="ml-auto flex-none text-[10px] font-semibold text-primary/45">Opened again, 2 days later</span>
    </div>
    <div className="relative p-4">
      {/* The page button, top right, with its "!" and the card that hangs off it. */}
      <div className="absolute right-4 top-3 z-10 flex flex-col items-end">
        <span className="relative grid h-8 w-8 place-content-center rounded-full bg-primary text-[11px] font-extrabold text-secondary br-shadow">
          R
          <motion.span
            initial={false}
            animate={on ? { opacity: [1, 1, 0], scale: [1, 1.15, 0.6] } : { opacity: 1, scale: 1 }}
            transition={{ duration: 1.6, times: [0, 0.6, 1], delay: 0.2 }}
            className="absolute -right-1 -top-1 grid h-4 w-4 place-content-center rounded-full border border-primary bg-[#f0c86a] text-[9px] font-extrabold text-primary">
            !
          </motion.span>
        </span>
        <motion.div
          initial={false}
          animate={on ? { opacity: [0, 1, 1, 0], y: [6, 0, 0, -4] } : { opacity: 0, y: 6 }}
          transition={{ duration: 1.9, times: [0, 0.2, 0.75, 1], delay: 0.15 }}
          className="mt-2 w-[190px] rounded-xl bg-white p-2.5 br-bold">
          <p className="text-[10px] font-semibold text-primary/60">You started this application</p>
          <span className="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-bold text-primary br-shadow">
            Continue my draft · 4 answers
          </span>
        </motion.div>
      </div>
      <div className="flex flex-col gap-2.5 pt-1">
        {DRAFT_FIELDS.map((f, i) => (
          <div key={f.label} className={i === 0 ? "pr-12" : undefined}>
            <p className="text-[10px] font-bold text-primary/55">{f.label}</p>
            <div className="mt-1 flex h-8 items-center justify-between gap-2 rounded-lg border border-primary/15 px-2.5 text-[12px]">
              <motion.span
                initial={false}
                animate={{ opacity: on ? 1 : 0 }}
                transition={{ duration: 0.25, delay: on ? 1.7 + i * 0.22 : 0 }}
                className="truncate font-semibold text-primary">
                {f.value}
              </motion.span>
              <motion.span initial={false} animate={on ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }} transition={{ duration: 0.25, delay: on ? 1.8 + i * 0.22 : 0 }}>
                <CheckChip size="sm" className="!h-4 !w-4 !rounded-[4px] !shadow-none" />
              </motion.span>
            </div>
          </div>
        ))}
      </div>
      <motion.p
        initial={false}
        animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.35, delay: 2.8 }}
        className="mt-3 flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-white py-1 pl-1 pr-3 text-[11px] font-bold text-primary">
        <CheckChip size="sm" />
        Back where you stopped
      </motion.p>
    </div>
  </div>
);

const PICTURES: Record<ToolKey, (on: boolean) => React.ReactNode> = {
  extension: (on) => <DraftVisual on={on} />,
  resume: (on) => <TailorVisual on={on} />,
  ats: (on) => <ScoreVisual role={ROLE} on={on} />,
  cover: (on) => <CoverVisual on={on} />,
  interview: (on) => <RehearseVisual on={on} />,
  autofill: (on) => <ApplyVisual role={ROLE} on={on} />,
  tracker: (on) => <TrackVisual role={ROLE} on={on} />,
};

/** The tool's picture on its dotted canvas, playing the first time it is mostly in view. */
const ToolVisual: FC<{ tool: ToolKey; className?: string }> = ({ tool, className }) => {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setOn(true);
        observer.disconnect();
      },
      { threshold: 0.45 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={box}
      aria-hidden
      className={cn("relative flex min-h-[360px] select-none items-center justify-center overflow-hidden rounded-[28px] bg-secondary/40 px-5 py-10 sm:min-h-[440px] sm:px-10", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(34,35,37,0.1)_1px,transparent_1px)] bg-[length:20px_20px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <div className="relative flex w-full justify-center">{PICTURES[tool](on)}</div>
    </div>
  );
};

export default ToolVisual;
