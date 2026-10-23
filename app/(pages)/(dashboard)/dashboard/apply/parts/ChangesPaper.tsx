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

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FC } from "react";
import { PagedResume } from "@/app/components/dashboard/resume/paper";
import { PaperHighlightProvider, type PaperEdits, type PaperEyes } from "@/app/components/dashboard/resume/paper/highlight";
import { DEFAULT_DESIGN, DEFAULT_SECTIONS, withContentSections } from "@/app/lib/dashboard/resume/design-defaults";
import { ALL_FONT_VARS } from "@/app/lib/dashboard/resume/fonts";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { highlightMarks, highlightTexts, resumeChanges, type HighlightMark, type ResumeChanges } from "@/app/lib/apply/changes";
import { cn } from "@/lib/utils";

const HIGHLIGHT = "rww-resume-change";
const HOVER = "rww-resume-change-hover";
/** "Show in resume": the lines a card means, leaf green over the change marks, for `FLASH_MS`. */
const FLASH = "rww-resume-flash";
const FLASH_MS = 2_600;

/** The paper's own width at 96dpi: Letter is 8.5in, A4 210mm. */
const PAGE_WIDTH_PX = { letter: 816, a4: 794 } as const;

export const highlightRegistry = (): HighlightRegistry | null =>
  typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined" ? CSS.highlights : null;

/** Every paper's ranges, so two on screen (the inline preview and a popup) don't wipe each other's marks. */
const rangesByPaper = new Map<symbol, Range[]>();
const hoveredByPaper = new Map<symbol, Range[]>();

function publish() {
  const registry = highlightRegistry();
  if (!registry) return;
  const all = [...rangesByPaper.values()].flat();
  if (all.length > 0) registry.set(HIGHLIGHT, new Highlight(...all));
  else registry.delete(HIGHLIGHT);
  const hovered = [...hoveredByPaper.values()].flat();
  if (hovered.length > 0) registry.set(HOVER, new Highlight(...hovered));
  else registry.delete(HOVER);
}

/** Headings address their group; body text addresses only its own line or paragraph. */
function hoverScope(target: EventTarget | null, paper: HTMLElement): Element | null {
  if (!(target instanceof Element) || !paper.contains(target)) return null;
  if (target.closest("[data-resume-keep-with-next]")) {
    return target.closest("[data-resume-entry], [data-resume-section]");
  }
  return target.closest('[data-resume-bullet], [role="textbox"], p, li')
    ?? target.closest("[data-resume-entry], [data-resume-section]");
}

/** A changed string counts only as whole words, never inside another ("Java" in "JavaScript", 2026-10-22). */
const isWord = (char: string | undefined) => Boolean(char && /[\p{L}\p{N}]/u.test(char));

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/** Whether a text node is (part of) a line: it holds the line's start, or the line holds all of it. */
const inLine = (data: string, within: string): boolean => {
  const node = collapse(data);
  const line = collapse(within);
  return node.length > 0 && (node.includes(line.slice(0, 40)) || line.includes(node));
};

/**
 * Ranges for every place a changed string appears in the paper's text, longest strings first, never
 * overlapping. A mark with `within` is looked for only inside that line, so the few words a reworded
 * bullet gained are marked there and nowhere else on the page.
 */
function changeRanges(root: Node, marks: readonly (string | HighlightMark)[]): Range[] {
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = node.textContent ?? "";
    if (!data.trim()) continue;
    const taken: [number, number][] = [];
    for (const mark of marks) {
      const text = typeof mark === "string" ? mark : mark.text;
      if (typeof mark !== "string" && mark.within && !inLine(data, mark.within)) continue;
      for (let from = data.indexOf(text); from !== -1; from = data.indexOf(text, from + 1)) {
        const to = from + text.length;
        if ((isWord(text[0]) && isWord(data[from - 1])) || (isWord(text[text.length - 1]) && isWord(data[to]))) continue;
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
  /** The show/hide eyes beside each section, role and line (the resume step); absent: a plain paper. */
  eyes?: PaperEyes;
  /** Click-to-edit lines (the resume step); absent: read only. */
  edits?: PaperEdits;
  /** Lines to bring into view and light up for a moment ("Show in resume"); a new `key` lights them again. */
  flash?: { texts: string[]; key: number } | null;
}

/** Never in a key: section and part keys, and entry ids, are plain words and ids. */
const SEP = "\u0000";

const ChangesPaper: FC<ChangesPaperProps> = ({ content: given, before, className, eyes, edits, flash = null }) => {
  const paperRef = useRef<HTMLDivElement | null>(null);
  // The paper is the slowest thing on the resume step (owner, 2026-10-20: undo "slow and laggy"), so
  // it renders again only when its words or what is hidden change: the step hands it a new object on
  // every render, and a save that comes back with the same words is the same paper.
  const contentKey = JSON.stringify(given);
  const [held, setHeld] = useState({ key: contentKey, content: given });
  if (held.key !== contentKey) setHeld({ key: contentKey, content: given });
  const content = held.key === contentKey ? held.content : given;
  // The eyes' and edits' handlers are the step's latest, read when one is used, so they never change the paper.
  const eyesRef = useRef(eyes);
  const editsRef = useRef(edits);
  useLayoutEffect(() => {
    eyesRef.current = eyes;
    editsRef.current = edits;
  });
  const hiddenKey = eyes ? eyes.hidden.join(SEP) : null;
  const idsKey = eyes ? eyes.experienceIds.join(SEP) : null;
  const hasEdits = edits !== undefined;
  const highlight = useMemo(
    () => ({
      focus: null,
      marks: [],
      eyes:
        hiddenKey === null || idsKey === null
          ? undefined
          : {
              hidden: hiddenKey ? hiddenKey.split(SEP) : [],
              experienceIds: idsKey ? idsKey.split(SEP) : [],
              onToggle: (key: string) => eyesRef.current?.onToggle(key),
            },
      edits: hasEdits
        ? {
            onSummary: (text: string) => editsRef.current?.onSummary(text),
            onBullet: (entryId: string, index: number, text: string) => editsRef.current?.onBullet(entryId, index, text),
            onName: (text: string) => editsRef.current?.onName?.(text),
            onTitle: (text: string) => editsRef.current?.onTitle?.(text),
            onSkills: (blockId: string, text: string) => editsRef.current?.onSkills?.(blockId, text),
          }
        : undefined,
    }),
    [hiddenKey, idsKey, hasEdits],
  );
  const changes = useMemo(() => resumeChanges(before, content), [before, content]);
  const texts = useMemo(() => highlightTexts(changes), [changes]);
  // Only what was added is marked: a reworded line's new words, inside that line (owner, 2026-10-21).
  const marks = useMemo(() => highlightMarks(before, content), [before, content]);
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
    const root = paperRef.current;
    if (!highlightRegistry() || !root) return;
    const key = Symbol("paper");
    let scope: Element | null = null;
    const setScope = (next: Element | null) => {
      if (next === scope) return;
      scope = next;
      hoveredByPaper.set(key, (rangesByPaper.get(key) ?? []).filter((range) =>
        next?.contains(range.startContainer) && next.contains(range.endContainer),
      ));
      publish();
    };
    const onOver = (event: PointerEvent) => setScope(hoverScope(event.target, root));
    const onLeave = () => setScope(null);
    root.addEventListener("pointerover", onOver);
    root.addEventListener("pointerleave", onLeave);
    // Wait a frame: a paper that just mounted (a section opening, a dialog) isn't laid out yet.
    const frame = requestAnimationFrame(() => {
      rangesByPaper.set(key, changeRanges(root, marks));
      // A refresh can finish while the pointer is already over the paper.
      const hovered = Array.from(root.querySelectorAll(":hover")).at(-1);
      scope = null;
      if (hovered) setScope(hoverScope(hovered, root));
      publish();
    });
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerleave", onLeave);
      rangesByPaper.delete(key);
      hoveredByPaper.delete(key);
      publish();
    };
  }, [marks, pages]);

  // "Show in resume": the first place on a sheet's visible part is scrolled to, and every place lit.
  const flashKey = flash?.key ?? null;
  const flashTexts = flash?.texts;
  useEffect(() => {
    const registry = highlightRegistry();
    if (flashKey === null || !flashTexts || flashTexts.length === 0 || !paperRef.current) return;
    const ranges = changeRanges(paperRef.current, flashTexts);
    // Each sheet holds the whole resume and clips it: the range to scroll to is one its sheet shows.
    const shown = ranges.find((range) => {
      const sheet = range.startContainer.parentElement?.closest("[data-resume-sheet]");
      if (!sheet) return false;
      const box = range.getBoundingClientRect();
      const frame = sheet.getBoundingClientRect();
      return (
        box.width > 0 && box.left >= frame.left - 1 && box.right <= frame.right + 1 && box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1
      );
    });
    shown?.startContainer.parentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!registry || ranges.length === 0) return;
    const lit = new Highlight(...ranges);
    lit.priority = 1;
    registry.set(FLASH, lit);
    const timer = window.setTimeout(() => registry.delete(FLASH), FLASH_MS);
    return () => {
      window.clearTimeout(timer);
      registry.delete(FLASH);
    };
  }, [flashKey, flashTexts]);

  // The same element while nothing it shows changed, so React skips the whole paper.
  const paper = useMemo(
    () => (
      // The gap is zoomed with the paper, so it's divided by the zoom to stay 25px on screen.
      <PaperHighlightProvider value={highlight}>
        <PagedResume
          design={DEFAULT_DESIGN}
          sections={withContentSections(DEFAULT_SECTIONS, content)}
          content={content}
          chrome={DEFAULT_DESIGN.chrome}
          gap={25 / fit}
          sheetClassName="shadow-[0_2px_18px_rgba(0,0,0,0.12)]"
          onPageCountChange={setPages}
        />
      </PaperHighlightProvider>
    ),
    [highlight, content, fit],
  );

  return (
    <div ref={setBox} className={cn("w-full", className)}>
      {!canHighlight && texts.length > 0 && <ChangeList changes={changes} />}
      {/* `rww-sent-paper`: sections with nothing in them are left off, as in every download. `isolate`
          keeps the eyes' z-index inside the paper, so they scroll under the sticky header (owner, 2026-10-22). */}
      <div ref={paperRef} style={{ zoom: fit }} className={cn("rww-sent-paper isolate mx-auto w-fit", ALL_FONT_VARS)}>
        {paper}
      </div>
    </div>
  );
};

export default ChangesPaper;
