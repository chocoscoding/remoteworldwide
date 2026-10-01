"use client";

import { useRef, type FC } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * One line of the story. `mark` puts the lime marker behind it once it has been read. A word
 * written `*like this*` is a stress word: it starts at the paragraph's weight and thickens one step
 * as the reading reaches it.
 */
export type StoryLine = { text: string; mark?: boolean };

const FAINT = 0.16;
/** The paragraph's own weight, and a stress word's once it has been read (owner, 2026-10-01). */
const BASE_WEIGHT = 500;
const STRESS_WEIGHT = 700;

// A marked word's marker runs on under the space after it, so a marked phrase reads as one stroke.
const MARKER = "absolute bottom-[0.06em] left-[-0.06em] top-[0.5em] -z-10 origin-left bg-secondary";
const markerEnd = (mark: "mid" | "end") => (mark === "end" ? "right-[-0.06em] rounded-r-[4px]" : "right-[-0.3em]");

type Token = { word: string; stress: boolean; mark?: "mid" | "end" };

const Word: FC<Token & { progress: MotionValue<number>; from: number; to: number }> = ({ word, stress, mark, progress, from, to }) => {
  const opacity = useTransform(progress, [from, to], [FAINT, 1]);
  const marker = useTransform(progress, [from, to], [0, 1]);
  const weight = useTransform(progress, [from, to], [BASE_WEIGHT, STRESS_WEIGHT]);
  return (
    // An inline grid, so a stress word's invisible bold copy holds its final width from the start
    // and the lines never re-wrap while it thickens.
    <span className="relative inline-grid">
      {mark ? <motion.span aria-hidden style={{ scaleX: marker }} className={cn(MARKER, markerEnd(mark))} /> : null}
      {stress ? (
        <span aria-hidden className="invisible [grid-area:1/1]" style={{ fontWeight: STRESS_WEIGHT }}>
          {word}
        </span>
      ) : null}
      <motion.span style={stress ? { opacity, fontWeight: weight } : { opacity }} className="[grid-area:1/1]">
        {word}
      </motion.span>
    </span>
  );
};

/**
 * The problem, told in one paragraph that inks itself in as it scrolls past, word by word, the way
 * the reference landing reads its intro; its stress words thicken as they're reached. With reduced
 * motion it is simply printed, stress words already bold. Needs a variable font on `className` for
 * the weight to move smoothly (the page passes Manrope's variable cut).
 */
const ProblemStory: FC<{ lines: StoryLine[]; className?: string }> = ({ lines, className }) => {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  // From when the paragraph's top is low in the window to when its end reaches the middle.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.55"] });

  const words: Token[] = lines.flatMap((line) => {
    const split = line.text.split(" ");
    return split.map((raw, i) => {
      const stress = /^\*.+\*[.,;:!?]*$/.test(raw);
      return {
        word: stress ? raw.replace(/\*/g, "") : raw,
        stress,
        mark: line.mark ? (i === split.length - 1 ? ("end" as const) : ("mid" as const)) : undefined,
      };
    });
  });
  const step = 1 / words.length;

  return (
    <p ref={ref} className={cn("isolate text-balance", className)} style={{ fontWeight: BASE_WEIGHT }}>
      {words
        .map((token, i) =>
          reduce ? (
            <span key={i} className="relative inline-block" style={token.stress ? { fontWeight: STRESS_WEIGHT } : undefined}>
              {token.mark ? <span aria-hidden className={cn(MARKER, markerEnd(token.mark))} /> : null}
              {token.word}
            </span>
          ) : (
            <Word key={i} {...token} progress={scrollYProgress} from={i * step} to={Math.min(1, (i + 1.5) * step)} />
          ),
        )
        .flatMap((node, i) => (i < words.length - 1 ? [node, " "] : [node]))}
    </p>
  );
};

export default ProblemStory;
