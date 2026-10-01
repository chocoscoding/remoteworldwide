"use client";

import { useEffect, useState, type FC } from "react";
import Image from "next/image";
import { LayoutGroup, animate, motion, useReducedMotion } from "motion/react";
import { Bookmark, Flame, MousePointer2, PenLine, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import CheckChip from "@/app/components/marketing/CheckChip";

// The pictures for "Follow one application", one per chapter. Decorative markup (the Journey
// wraps each in aria-hidden), each playing once when its chapter first takes the middle of the
// screen (`on`). Chapter one shows real postings from the board; after that the story follows one
// role by title only, so no real company is ever shown making an offer. Everything else on them
// (the person, the bullets, the scores) is a sample.

export type BoardJob = { title: string; company: string; logo: string | null; region: string };

const LABEL = "text-[10px] font-extrabold uppercase tracking-[0.14em]";

/** Counts up to `to` once `on`; straight to the end with reduced motion. */
function useCountUp(to: number, on: boolean, from = 0) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (!on || reduce) return;
    const controls = animate(from, to, { duration: 1.3, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [on, to, from, reduce]);
  return on && reduce ? to : value;
}

function Logo({ job }: { job: BoardJob }) {
  return job.logo ? (
    <Image src={job.logo} alt="" width={32} height={32} className="h-8 w-8 flex-none rounded-full border border-primary/10 bg-white object-contain" />
  ) : (
    <span className="grid h-8 w-8 flex-none place-content-center rounded-full bg-primary text-[11px] font-extrabold text-secondary">{job.company.charAt(0)}</span>
  );
}

export const FindVisual: FC<{ jobs: BoardJob[]; on: boolean }> = ({ jobs, on }) => (
  <div className="w-full max-w-[400px]">
    <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-white px-3 py-2.5 text-xs text-primary/55">
      <Search className="h-3.5 w-3.5 flex-none" />
      <span className="truncate">Remote · open to anywhere</span>
      <span className="ml-auto flex-none rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-primary">Vetted</span>
    </div>
    <ul className="mt-3 flex flex-col gap-2">
      {jobs.slice(0, 3).map((job, i) => {
        const picked = i === 0 && on;
        return (
          <motion.li
            key={`${job.company}-${job.title}`}
            initial={false}
            animate={{ rotate: picked ? -1 : 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className={cn(
              "flex items-center gap-3 rounded-xl bg-white p-3 transition-[border-color,box-shadow] duration-300",
              picked ? "br-bold" : "border border-primary/10",
            )}>
            <Logo job={job} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-extrabold text-primary">{job.title}</p>
              <p className="truncate text-[11px] text-primary/60">
                {job.company} · {job.region}
              </p>
            </div>
            {i === 0 ? (
              <motion.span
                initial={false}
                animate={on ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                transition={{ duration: 0.45, delay: 0.5 }}
                className={cn("grid h-8 w-8 flex-none place-content-center rounded-lg border transition-colors duration-300", on ? "border-primary bg-secondary" : "border-primary/15")}>
                <Bookmark className={cn("h-4 w-4 text-primary", on && "fill-primary")} />
              </motion.span>
            ) : null}
          </motion.li>
        );
      })}
    </ul>
    <motion.p
      initial={false}
      animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      transition={{ duration: 0.35, delay: 0.75 }}
      className="mt-3 flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-white py-1 pl-1 pr-3 text-[11px] font-bold text-primary">
      <CheckChip size="sm" />
      Saved to your tracker
    </motion.p>
  </div>
);

function Gauge({ value }: { value: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[92px] w-[92px] flex-none">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#ecebe3" strokeWidth="9" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="#cddd54" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[26px] font-extrabold tabular-nums text-primary">{value}</span>
        <span className="mt-0.5 text-[9px] font-bold text-primary/50">/ 100</span>
      </span>
    </div>
  );
}

const KEYWORDS = [
  { word: "Design systems", hit: true },
  { word: "Figma", hit: true },
  { word: "User research", hit: true },
  { word: "A/B testing", hit: false },
  { word: "Stakeholders", hit: false },
];

export const ScoreVisual: FC<{ role: string; on: boolean }> = ({ role, on }) => {
  const score = useCountUp(64, on);
  return (
    <div className="w-full max-w-[380px] rounded-[20px] bg-white p-5 br-bold">
      <div className="flex items-center justify-between gap-3">
        <span className={cn(LABEL, "flex-none text-primary/65")}>ATS match</span>
        <span className="truncate rounded-full border border-primary/25 px-2 py-0.5 text-[10px] font-bold text-primary">{role}</span>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <Gauge value={score} />
        <ul className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold">
          {KEYWORDS.map((k, i) => (
            <motion.li
              key={k.word}
              initial={false}
              animate={on ? { opacity: 1, x: 0 } : { opacity: 0.25, x: -4 }}
              transition={{ duration: 0.3, delay: 0.3 + i * 0.12 }}
              className={cn("flex items-center gap-1.5", k.hit ? "text-primary" : "text-[#b23c26]")}>
              {k.hit ? (
                <CheckChip size="sm" className="!h-4 !w-4 !rounded-[4px] !shadow-none" />
              ) : (
                <span className="grid h-4 w-4 flex-none place-content-center rounded-[4px] bg-[#f6ddd6]">
                  <X className="h-2.5 w-2.5" strokeWidth={4} />
                </span>
              )}
              <span className="truncate">{k.word}</span>
            </motion.li>
          ))}
        </ul>
      </div>
      <motion.p
        initial={false}
        animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.35, delay: 1.1 }}
        className="mt-4 rounded-lg bg-[#f6ddd6] px-3 py-2 text-[11px] font-bold leading-snug text-[#b23c26]">
        2 keywords missing. Add them before a filter notices.
      </motion.p>
    </div>
  );
};

export const TailorVisual: FC<{ on: boolean }> = ({ on }) => {
  const match = useCountUp(86, on, 64);
  return (
    <div className="w-full max-w-[400px]">
      <div className="rounded-[20px] border border-primary/15 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <span className={cn(LABEL, "text-primary/65")}>Experience</span>
          <span className="rounded-full border border-primary bg-secondary px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-primary">Match {match}</span>
        </div>
        <p className="mt-3 text-[13px] font-extrabold text-primary">Product Designer · Fintech startup</p>
        <ul className="mt-2.5 flex flex-col gap-2 text-[12px] leading-snug">
          <li className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-primary/40" />
            <span className={cn("transition-colors duration-500", on ? "text-primary/40 line-through decoration-[#b23c26]/60" : "text-primary/80")}>Redesigned the checkout flow.</span>
          </li>
          <motion.li
            initial={false}
            animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.45, delay: 0.55 }}
            className="flex gap-2 rounded-lg bg-secondary/40 p-2.5 text-primary">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none" />
            <span>
              Led a checkout redesign, <span className="rounded-[3px] bg-secondary px-0.5 font-bold">A/B testing</span> three variants with{" "}
              <span className="rounded-[3px] bg-secondary px-0.5 font-bold">stakeholders</span> in product and finance.
            </span>
          </motion.li>
        </ul>
      </div>
      <motion.div
        initial={false}
        animate={on ? { opacity: 1, y: 0, rotate: 2 } : { opacity: 0, y: 10, rotate: 0 }}
        transition={{ duration: 0.4, delay: 1.1 }}
        className="-mt-3 ml-auto mr-3 flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-primary br-shadow">
        <PenLine className="h-3.5 w-3.5" />
        Cover letter · draft ready
        <CheckChip size="sm" />
      </motion.div>
    </div>
  );
};

const FIELDS = [
  { label: "Full name", value: "Ada Okafor" },
  { label: "Email", value: "ada.okafor@email.com" },
  { label: "LinkedIn", value: "linkedin.com/in/adaokafor" },
  { label: "Why this role?", value: "Four years designing checkout flows…" },
];

export const ApplyVisual: FC<{ role: string; on: boolean }> = ({ role, on }) => (
  <div className="w-full max-w-[400px] overflow-hidden rounded-[20px] border border-primary/15 bg-white">
    <div className="flex items-center gap-1.5 border-b border-primary/10 bg-[#f4f3ec] px-4 py-2.5">
      {[0, 1, 2].map((d) => (
        <span key={d} className="h-2 w-2 flex-none rounded-full bg-primary/15" />
      ))}
      <span className="ml-2 truncate text-[11px] font-semibold text-primary/55">Apply · {role}</span>
    </div>
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold text-primary/55">Fills only when you press it</span>
        <span className="relative flex-none">
          <motion.span
            initial={false}
            animate={on ? { scale: [1, 0.92, 1] } : { scale: 1 }}
            transition={{ duration: 0.3, delay: 0.45 }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-bold text-primary br-shadow">
            <span className="grid h-4 w-4 place-content-center rounded-[4px] bg-primary text-[8px] font-extrabold text-secondary">R</span>
            Fill from my profile
          </motion.span>
          <motion.span
            initial={false}
            animate={on ? { x: 0, y: 0, opacity: 1 } : { x: 26, y: 22, opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="absolute -bottom-3 right-3">
            <MousePointer2 className="h-4 w-4 fill-white text-primary" />
          </motion.span>
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {FIELDS.map((f, i) => (
          <div key={f.label}>
            <p className="text-[10px] font-bold text-primary/55">{f.label}</p>
            <div className="mt-1 flex h-8 items-center justify-between gap-2 rounded-lg border border-primary/15 px-2.5 text-[12px]">
              <motion.span
                initial={false}
                animate={{ opacity: on ? 1 : 0 }}
                transition={{ duration: 0.25, delay: on ? 0.75 + i * 0.22 : 0 }}
                className="truncate font-semibold text-primary">
                {f.value}
              </motion.span>
              <motion.span initial={false} animate={on ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }} transition={{ duration: 0.25, delay: on ? 0.85 + i * 0.22 : 0 }}>
                <CheckChip size="sm" className="!h-4 !w-4 !rounded-[4px] !shadow-none" />
              </motion.span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const WAVE = [0.35, 0.6, 0.9, 0.5, 0.75, 1, 0.55, 0.8, 0.4, 0.95, 0.65, 0.45, 0.85, 0.6, 0.3, 0.7, 0.95, 0.5, 0.75, 0.4, 0.6, 0.9, 0.55, 0.7, 0.45, 0.8];

const REPORT = [
  { label: "Pace", value: "Steady", good: true },
  { label: "Filler words", value: "3 in 4 min", good: false },
  { label: "Structure", value: "Clear STAR story", good: true },
];

export const RehearseVisual: FC<{ on: boolean }> = ({ on }) => (
  <div className="w-full max-w-[400px]">
    <div className="rounded-[20px] bg-primary p-5 text-white br-bold br-lime">
      <div className="flex items-center justify-between">
        <span className={cn(LABEL, "flex items-center gap-2 text-white/70")}>
          <span className="relative flex h-2 w-2">
            {on ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b57] opacity-75 motion-reduce:animate-none" /> : null}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff6b57]" />
          </span>
          Mock interview
        </span>
        <span className="font-mono text-xs text-white/65">04:12</span>
      </div>
      <p className="mt-3 text-[15px] font-semibold leading-snug">&ldquo;Walk me through a decision you made with incomplete data.&rdquo;</p>
      <div className="mt-4 flex h-11 items-center gap-[3px] overflow-hidden">
        {WAVE.map((h, i) => (
          <span key={i} className={cn("w-[5px] flex-none rounded-full bg-secondary", on && "rww-wave-bar")} style={{ height: `${h * 100}%`, animationDelay: `${(i % 8) * -0.14}s` }} />
        ))}
      </div>
    </div>
    <motion.div
      initial={false}
      animate={on ? { opacity: 1, y: 0, rotate: -2 } : { opacity: 0, y: 14, rotate: 0 }}
      transition={{ duration: 0.45, delay: 0.7 }}
      className="relative -mt-5 ml-auto w-[82%] rounded-[18px] bg-white p-4 br-bold">
      <span className={cn(LABEL, "text-primary/65")}>Your report</span>
      <ul className="mt-2 flex flex-col gap-1.5 text-[12px]">
        {REPORT.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3">
            <span className="text-primary/60">{r.label}</span>
            <span className={cn("flex items-center gap-1.5 font-bold", r.good ? "text-primary" : "text-[#9a6a00]")}>
              {r.value}
              {r.good ? <CheckChip size="sm" className="!h-4 !w-4 !rounded-[4px] !shadow-none" /> : null}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  </div>
);

const COLUMNS = [
  { key: "applied", label: "Applied", fillers: 3 },
  { key: "interviewing", label: "Interviews", fillers: 1 },
  { key: "offer", label: "Offer", fillers: 0 },
];

export const TrackVisual: FC<{ role: string; on: boolean }> = ({ role, on }) => {
  const home = on ? "offer" : "interviewing";
  return (
    <div className="w-full max-w-[420px]">
      <LayoutGroup>
        <div className="grid grid-cols-3 gap-2">
          {COLUMNS.map((col) => (
            <div key={col.key} className="min-h-[176px] rounded-xl border border-primary/10 bg-white/80 p-2">
              {/* Narrower tracking than LABEL: a phone's columns are about 80px inside. */}
              <p className="flex items-center justify-between gap-1 px-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em] text-primary/55">
                <span className="truncate">{col.label}</span>
                <span className="flex-none tabular-nums">{col.fillers + (home === col.key ? 1 : 0)}</span>
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {home === col.key ? (
                  <motion.div
                    layoutId="journey-offer-card"
                    transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.3 }}
                    className={cn(
                      "rounded-lg p-2",
                      col.key === "offer" ? "bg-secondary br-shadow" : "border border-primary/15 bg-white",
                    )}>
                    <p className="line-clamp-2 text-[10px] font-extrabold leading-tight text-primary">{role}</p>
                    <p className="mt-1 flex items-center gap-1 text-[9px] font-bold text-primary/65">
                      {col.key === "offer" ? (
                        <>
                          <Sparkles className="h-2.5 w-2.5" /> Offer in
                        </>
                      ) : (
                        "Final round"
                      )}
                    </p>
                  </motion.div>
                ) : null}
                {Array.from({ length: col.fillers }, (_, i) => (
                  <div key={i} className="rounded-lg border border-primary/10 bg-white p-2">
                    <span className="block h-1.5 w-4/5 rounded-full bg-primary/15" />
                    <span className="mt-1.5 block h-1.5 w-1/2 rounded-full bg-primary/10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </LayoutGroup>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/10 bg-white px-3 py-2 text-[12px] font-bold text-primary">
        <span className="flex flex-none items-center gap-1.5">
          <Flame className="h-4 w-4 fill-[#f0c86a]" /> 12-day streak
        </span>
        <span className="truncate text-[11px] font-semibold text-primary/55">Follow up on Friday</span>
      </div>
    </div>
  );
};
