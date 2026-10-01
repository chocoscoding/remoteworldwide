"use client";

import { useLayoutEffect, useRef, type FC, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * One line of the story. `mark` puts the lime marker behind it once it has been read. A word
 * written `*like this*` is a stress word: it starts at the paragraph's weight and thickens one step
 * as the reading reaches it.
 */
export type StoryLine = { text: string; mark?: boolean };

const FAINT = 0.16;

/**
 * How much scrolling the reading takes, as a multiple of the first cut's (the block's height plus
 * 30% of the window, when it simply scrolled past): twice that (owner, 2026-10-01), so people can
 * read it as they scroll. The block pins while the reading plays out.
 */
const READ_LENGTH = 2;
/** It starts filling in when its top is this far down the window... */
const START = 0.85;
/** ...and pins this far from the top, below the navbar, until the last word has filled in. */
const PIN_TOP = "max(15vh, 89px)";
const pinTopPx = (vh: number): number => Math.max(0.15 * vh, 89);

const readDistance = (height: number, vh: number): number => READ_LENGTH * (height + 0.3 * vh);
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
const ProblemStory: FC<{ lines: StoryLine[]; className?: string; before?: ReactNode; after?: ReactNode }> = ({ lines, className, before, after }) => {
  const block = useRef<HTMLDivElement>(null);
  const runway = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // The block (`before` and the paragraph) pins at PIN_TOP for as long as the reading still has to
  // run, over an empty runway below it. The runway ends where `after` begins, so `after` rises to
  // meet the pinned block and docks under it the moment the last word fills in; from there they
  // scroll on together. Set on the DOM rather than in state, so a resize or the font arriving
  // re-measures without a render.
  useLayoutEffect(() => {
    if (reduce) return;
    const measure = () => {
      if (!block.current || !runway.current) return;
      const vh = window.innerHeight;
      const rise = START * vh - pinTopPx(vh);
      runway.current.style.height = `${Math.max(0, Math.round(readDistance(block.current.offsetHeight, vh) - rise))}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (block.current) observer.observe(block.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [reduce]);

  // How far into the reading: from the block's top at START of the window, over readDistance() of
  // scrolling. Worked out from where it sits now rather than from a scroll offset, so it's exact.
  const { scrollY } = useScroll();
  const scrollYProgress = useTransform(scrollY, () => {
    if (!block.current || !runway.current) return 0;
    const vh = window.innerHeight;
    // While pinned the block stands still, so measure the scroll from the runway instead.
    const blockTop = runway.current.getBoundingClientRect().top - block.current.offsetHeight;
    const travelled = START * vh - blockTop;
    return Math.min(1, Math.max(0, travelled / readDistance(block.current.offsetHeight, vh)));
  });

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
    <>
      <div>
        <div ref={block} className={reduce ? undefined : "sticky"} style={reduce ? undefined : { top: PIN_TOP }}>
          {before}
          <p className={cn("isolate text-balance", className)} style={{ fontWeight: BASE_WEIGHT }}>
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
        </div>
        {/* The scroll the reading plays out over while the block is pinned; empty. */}
        <div ref={runway} aria-hidden />
      </div>
      {after}
    </>
  );
};

export default ProblemStory;
