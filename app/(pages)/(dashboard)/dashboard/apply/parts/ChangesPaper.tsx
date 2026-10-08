"use client";

// A resume, whole, on the resume creator's own paper, with what tailoring
// changed underlined and highlighted (owner, 2026-10-03: "pick part of resume
// creator and put it in here"). Shared by the resume step's inline preview and
// the proposal popup.
//
// The paper is `ResumePaper` exactly as the creator and the print page render
// it, in the default look, scaled down to fit a narrow column (CSS zoom, so the
// height follows) and never up. Like the creator's, it shows each page as its
// own A4 sheet, 25px apart (`PagedResume`). The marks are the CSS Custom
// Highlight API: ranges over the paper's text, painted by
// `::highlight(rww-resume-change)` in globals.css, so the renderer is never
// touched and no DOM is rewritten under React. Every sheet holds a copy of the
// paper and gets its own ranges, and every paper on screen adds them to the one
// shared highlight. A browser without the API gets the same changes as a list
// instead.

import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { PagedResume } from "@/app/components/dashboard/resume/paper";
import { DEFAULT_DESIGN, DEFAULT_SECTIONS, withContentSections } from "@/app/lib/dashboard/resume/design-defaults";
import { ALL_FONT_VARS } from "@/app/lib/dashboard/resume/fonts";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { highlightTexts, resumeChanges, type ResumeChanges } from "@/app/lib/apply/changes";
import { cn } from "@/lib/utils";

const HIGHLIGHT = "rww-resume-change";

/** The paper's own width at 96dpi: Letter is 8.5in, A4 210mm. */
const PAGE_WIDTH_PX = { letter: 816, a4: 794 } as const;

export const highlightRegistry = (): HighlightRegistry | null =>
  typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined" ? CSS.highlights : null;

/** Every paper's ranges, so two on screen (the inline preview and a popup) don't wipe each other's marks. */
const rangesByPaper = new Map<symbol, Range[]>();

function publish() {
  const registry = highlightRegistry();
  if (!registry) return;
  const all = [...rangesByPaper.values()].flat();
  if (all.length > 0) registry.set(HIGHLIGHT, new Highlight(...all));
  else registry.delete(HIGHLIGHT);
}

/** A short changed string (a skill like "Go") only counts as a whole word, never inside another. */
const isWord = (char: string | undefined) => Boolean(char && /[\p{L}\p{N}]/u.test(char));

/** Ranges for every place a changed string appears in the paper's text, longest strings first, never overlapping. */
function changeRanges(root: Node, texts: readonly string[]): Range[] {
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = node.textContent ?? "";
    if (!data.trim()) continue;
    const taken: [number, number][] = [];
    for (const text of texts) {
      for (let from = data.indexOf(text); from !== -1; from = data.indexOf(text, from + 1)) {
        const to = from + text.length;
        if (text.length < 4 && (isWord(data[from - 1]) || isWord(data[to]))) continue;
        if (taken.some(([start, end]) => from < end && to > start)) continue;
        taken.push([from, to]);
        const range = document.createRange();
        range.setStart(node, from);
        range.setEnd(node, to);
        ranges.push(range);
      }
    }
  }
  return ranges;
}

/** What changed, in words: for a browser that can't paint the highlights. */
const ChangeList: FC<{ changes: ResumeChanges }> = ({ changes }) => (
  <div className="mx-auto mb-5 max-w-[816px] rounded-xl bg-white p-4 text-sm leading-relaxed text-black/70">
    {changes.title && <p>Title: {changes.title}</p>}
    {changes.summary.map((sentence) => (
      <p key={sentence}>Summary: {sentence}</p>
    ))}
    {changes.bullets.map((bullet) => (
      <p key={bullet}>Bullet: {bullet}</p>
    ))}
    {changes.skills.length > 0 && <p>Skills added: {changes.skills.join(", ")}</p>}
  </div>
);

export interface ChangesPaperProps {
  content: ResumeContent;
  /** The resume it was made from; what differs is highlighted. Pass `content` itself to mark nothing. */
  before: ResumeContent | null;
  className?: string;
}

const ChangesPaper: FC<ChangesPaperProps> = ({ content, before, className }) => {
  const paperRef = useRef<HTMLDivElement | null>(null);
  const changes = useMemo(() => resumeChanges(before, content), [before, content]);
  const texts = useMemo(() => highlightTexts(changes), [changes]);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(1);
  // The sheets after the first mount once the paper is measured, so the marks are found again then.
  const [pages, setPages] = useState(1);
  // Rendered in the browser only (inside a collapsed section or a dialog), so reading this in render is safe.
  const canHighlight = highlightRegistry() !== null;

  useEffect(() => {
    if (!box) return;
    const paperWidth = PAGE_WIDTH_PX[DEFAULT_DESIGN.doc.pageFormat];
    const observer = new ResizeObserver(([entry]) => setFit(Math.min(1, Math.max(0.3, entry.contentRect.width / paperWidth))));
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);

  useEffect(() => {
    if (!highlightRegistry()) return;
    const key = Symbol("paper");
    // Wait a frame: a paper that just mounted (a section opening, a dialog) isn't laid out yet.
    const frame = requestAnimationFrame(() => {
      if (!paperRef.current) return;
      rangesByPaper.set(key, changeRanges(paperRef.current, texts));
      publish();
    });
    return () => {
      cancelAnimationFrame(frame);
      rangesByPaper.delete(key);
      publish();
    };
  }, [texts, pages]);

  return (
    <div ref={setBox} className={cn("w-full", className)}>
      {!canHighlight && texts.length > 0 && <ChangeList changes={changes} />}
      <div ref={paperRef} style={{ zoom: fit }} className={cn("mx-auto w-fit", ALL_FONT_VARS)}>
        {/* The gap is zoomed with the paper, so it's divided by the zoom to stay 25px on screen. */}
        <PagedResume
          design={DEFAULT_DESIGN}
          sections={withContentSections(DEFAULT_SECTIONS, content)}
          content={content}
          chrome={DEFAULT_DESIGN.chrome}
          gap={25 / fit}
          sheetClassName="shadow-[0_2px_18px_rgba(0,0,0,0.12)]"
          onPageCountChange={setPages}
        />
      </div>
    </div>
  );
};

export default ChangesPaper;
