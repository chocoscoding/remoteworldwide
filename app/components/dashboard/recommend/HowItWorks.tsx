import { FC } from "react";

// How recommendations actually work, in two shapes: a side card beside the
// companies you're in front of, and a full-width band under "Step one" while
// you're not in the running yet. Neither implies a self-serve step: you can't
// ask to be picked.

const CARD_STEPS = [
  "A reviewer reads your work and decides.",
  "The company sends a question or two.",
  "Answer here and you're talking to its hiring team.",
];

const BAND_STEPS = [
  { title: "Reviewed.", line: "A reviewer reads your work and decides." },
  { title: "Their questions.", line: "The company sends one or two. Answer them here." },
  { title: "Interview.", line: "You're talking to its hiring team." },
];

export const HowItWorksCard: FC = () => (
  <div className="flex flex-col gap-3.5 rounded-2xl bg-[#222325] p-5 text-white">
    <span className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-[#e1f073]">How it works</span>
    <p className="text-base font-extrabold leading-[1.35]">Each week we put one or two people straight in front of a company.</p>
    <ol className="flex flex-col gap-2.5 text-[13px] leading-normal text-white/80">
      {CARD_STEPS.map((line, i) => (
        <li key={line} className="flex gap-2.5">
          <span className="grid h-5 w-5 flex-none place-content-center rounded-full bg-white/[0.14] text-[11px] font-extrabold text-white">{i + 1}</span>
          <span>{line}</span>
        </li>
      ))}
    </ol>
    <p className="border-t border-white/[0.16] pt-3 text-xs leading-normal text-white/80">
      You can&apos;t request a pick. A sharp profile is what gets you one.
    </p>
  </div>
);

export const HowItWorksBand: FC = () => (
  <section aria-label="How recommendations work" className="flex flex-col gap-4 rounded-2xl bg-[#222325] px-6 py-[22px] text-white">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-[17px] font-extrabold">Then each week we put one or two people straight in front of a company.</p>
      <span className="text-xs text-white/80">No application, no queue. You can&apos;t request a pick.</span>
    </div>
    <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3 text-[13px] leading-normal">
      {BAND_STEPS.map((step, i) => (
        <li key={step.title} className="flex gap-2.5 rounded-xl bg-white/[0.08] px-3.5 py-3">
          <span className="flex-none text-lg font-extrabold leading-[1.1] text-[#e1f073]">{i + 1}</span>
          <span>
            <strong className="font-bold">{step.title}</strong> <span className="text-white/80">{step.line}</span>
          </span>
        </li>
      ))}
    </ol>
  </section>
);
