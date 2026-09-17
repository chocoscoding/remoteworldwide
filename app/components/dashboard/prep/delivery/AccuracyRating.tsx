"use client";

import { useId, useState, type FC } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiMessage } from "@/app/lib/api/core";
import { PREP_LIMITS } from "@/app/lib/voice/types";

/**
 * "How accurate was the transcript?" — one to five.
 *
 * The answers are compared across transcription setups, so this asks about
 * the words on the page only, not about the report or the user's own answers.
 *
 * The choice shows at once and is saved in the background; a failed save
 * puts the previous rating back and says why.
 */
export interface AccuracyRatingProps {
  /** The saved rating, or null. */
  value: number | null;
  /** Saves a rating. A returned promise drives the saving and error states. */
  onRate: (score: number) => void | Promise<unknown>;
  disabled?: boolean;
  className?: string;
}

const SCORE_LABELS: Record<number, string> = {
  1: "Way off",
  2: "Lots of mistakes",
  3: "Some mistakes",
  4: "A few slips",
  5: "Spot on",
};

const SCORES = Array.from({ length: PREP_LIMITS.ratingMax - PREP_LIMITS.ratingMin + 1 }, (_, i) => PREP_LIMITS.ratingMin + i);

/** A choice made here, remembered against the `value` it replaced until the parent's value moves on. */
interface LocalChoice {
  score: number;
  over: number | null;
  status: "saving" | "saved";
}

const isThenable = (value: unknown): value is Promise<unknown> => typeof (value as Promise<unknown> | undefined)?.then === "function";

const AccuracyRating: FC<AccuracyRatingProps> = ({ value, onRate, disabled = false, className }) => {
  const titleId = useId();
  const [local, setLocal] = useState<LocalChoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Once the saved value changes (the query refetched), it is the truth again.
  const mine = local !== null && local.over === value ? local : null;
  const shown = mine?.score ?? value;
  const saving = mine?.status === "saving";

  const rate = (score: number) => {
    if (disabled || saving || score === shown) return;
    setError(null);
    setLocal({ score, over: value, status: "saving" });
    const result = onRate(score);
    if (!isThenable(result)) {
      setLocal({ score, over: value, status: "saved" });
      return;
    }
    result.then(
      () => setLocal((prev) => (prev?.score === score ? { ...prev, status: "saved" } : prev)),
      (reason: unknown) => {
        setLocal((prev) => (prev?.score === score ? null : prev));
        setError(apiMessage(reason));
      }
    );
  };

  return (
    <section aria-label="Transcript accuracy" className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-black/10 bg-white px-5 py-4 sm:px-6", className)}>
      <div className="min-w-0">
        <h3 id={titleId} className="text-sm font-bold text-primary">
          How accurate was the transcript?
        </h3>
        {/* A status region, so saving, saved and failures are announced. */}
        <p role="status" className={cn("mt-0.5 text-xs", error ? "text-[#b23c26]" : "text-black/50")}>
          {error ??
            (saving ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
                Saving…
              </span>
            ) : mine?.status === "saved" ? (
              <span className="inline-flex items-center gap-1 text-[#55591f]">
                <Check aria-hidden className="h-3 w-3" strokeWidth={3} />
                Thanks, saved. It helps us choose how sessions are transcribed.
              </span>
            ) : shown === null ? (
              "Just the words, not the feedback. It helps us choose how sessions are transcribed."
            ) : (
              `You rated it ${shown} of ${PREP_LIMITS.ratingMax}. Pick again to change it.`
            ))}
        </p>
      </div>

      <div className="flex flex-none flex-col items-stretch gap-1.5">
        <div role="group" aria-labelledby={titleId} className="flex items-center gap-2">
          {SCORES.map((score) => {
            const on = shown === score;
            return (
              <button
                key={score}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                aria-label={`${score} of ${PREP_LIMITS.ratingMax}, ${SCORE_LABELS[score] ?? ""}`}
                title={SCORE_LABELS[score]}
                onClick={() => rate(score)}
                className={cn(
                  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[6px] border-2 border-[#222325] text-sm font-bold tabular-nums text-[#222325] transition-[transform,box-shadow,background-color] duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-40",
                  on
                    ? "bg-[#e1f073] shadow-[2px_2px_0_0_#222325]"
                    : "bg-white shadow-[2px_2px_0_0_#222325] hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                )}>
                {score}
              </button>
            );
          })}
        </div>
        <div aria-hidden className="flex justify-between text-[10.5px] font-semibold text-black/40">
          <span>{SCORE_LABELS[PREP_LIMITS.ratingMin]}</span>
          <span>{SCORE_LABELS[PREP_LIMITS.ratingMax]}</span>
        </div>
      </div>
    </section>
  );
};

export default AccuracyRating;
