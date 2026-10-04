import { FC } from "react";
import Link from "next/link";
import type { FitFactorId } from "@/app/lib/dashboard/fit";

/** The one thing that gives each factor something to match on, in the order they're offered. */
const FILL: { id: FitFactorId; label: string; href: string }[] = [
  { id: "role", label: "Set your target roles", href: "/dashboard/settings/preferences" },
  { id: "seniority", label: "Set your experience level", href: "/dashboard/settings/preferences" },
  { id: "timezone", label: "Set your timezone", href: "/dashboard/settings/profile" },
  { id: "trend", label: "Track an application", href: "/dashboard/tracker" },
];

const COUNT = ["no", "one", "two", "three", "four"];

export interface FitSignalsNoteProps {
  /** Which of the four factors have something of yours to go on (fitSignals). */
  signals: Record<FitFactorId, boolean>;
  /** The tier every shown card shares, when they all share one. */
  sharedTier: string | null;
}

/**
 * Above the listings while some factors have nothing to match on: those score
 * a neutral guess, so the cards bunch in the middle. Says why, and links to
 * the fix for each gap. Rendered only when at least one is missing. Dark, so
 * it reads apart from the cards (owner, 2026-10-04).
 */
const FitSignalsNote: FC<FitSignalsNoteProps> = ({ signals, sharedTier }) => {
  const have = Object.values(signals).filter(Boolean).length;
  const missing = FILL.filter((f) => !signals[f.id]);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl bg-[#222325] px-4 py-3">
      <p className="min-w-0 flex-[1_1_280px] text-[13px] text-white/80">
        <strong className="font-extrabold text-[#e1f073]">{sharedTier ? `These all read “${sharedTier}”` : "Fits are rough for now"}</strong> because
        we&apos;re matching on {COUNT[have]} signal{have === 1 ? "" : "s"} out of four.
      </p>
      {missing.map((f) => (
        <Link
          key={f.id}
          href={f.href}
          className="flex h-[34px] items-center rounded-lg border border-white/30 px-3 text-xs font-bold text-white transition-colors hover:border-white hover:bg-white/10">
          {f.label}
        </Link>
      ))}
    </div>
  );
};

export default FitSignalsNote;
