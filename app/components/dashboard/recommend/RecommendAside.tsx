import { FC } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { HowItWorksCard } from "./HowItWorks";

const WHAT_WE_LOOK_FOR = [
  "A portfolio that shows decisions, not just screens.",
  "Proof you've shipped work with engineers.",
  "Clear writing. Most of these teams work async.",
  "A resume that holds up in a 20-second skim.",
  "A match with your preferences and recent applications.",
];

/** A small outlined link: flat at rest, lifted on hover. */
export const SMALL_LINK = "br-plain-press flex h-[34px] items-center rounded-lg border-[#222325] bg-white px-3 text-xs font-bold text-primary";

/**
 * Beside the companies you're in front of: how it works, what a reviewer
 * actually reads (and where to change it), and what they look for, folded.
 */
const RecommendAside: FC<{ masterResume: { name: string } | null }> = ({ masterResume }) => (
  <aside aria-label="How recommendations work" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
    <HowItWorksCard />

    <div className="flex flex-col gap-2.5 rounded-2xl border border-black/[0.14] bg-white p-[18px]">
      <span className="text-sm font-extrabold text-primary">What reviewers read</span>
      <p className="text-[13px] text-[#55564f]">
        {masterResume ? (
          <>
            Your master resume, <strong className="font-bold text-primary">{masterResume.name}</strong>, and your preferences.
          </>
        ) : (
          "Your master resume and your preferences."
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/vault?tab=resumes" className={SMALL_LINK}>
          {masterResume ? "Change resume" : "Choose a resume"}
        </Link>
        <Link href="/dashboard/settings/preferences" className={SMALL_LINK}>
          Update preferences
        </Link>
      </div>
    </div>

    <details className="group rounded-2xl border border-black/[0.14] bg-white">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-[18px] text-sm font-extrabold text-primary [&::-webkit-details-marker]:hidden">
        What we look for
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="flex flex-col gap-2 px-[18px] pb-[18px] text-[13px] text-[#55564f]">
        {WHAT_WE_LOOK_FOR.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  </aside>
);

export default RecommendAside;
