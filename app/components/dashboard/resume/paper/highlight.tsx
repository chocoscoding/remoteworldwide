"use client";

// What the editor is pointing at on the paper (owner, 2026-10-04): whatever a
// control on either side of the preview is about — the role being edited, a
// fix card, an AI tool's proposal — gets a frame on the page, and the exact
// line or skill inside it a highlight. A role is framed on its own; a section
// without entries (Summary, Skills) is framed whole.
//
// A context rather than props, so the paper's pure render path (the server's
// print page, the apply wizard's preview) never has to know about it: with no
// provider every reader gets "nothing pointed at" and the page renders exactly
// as it prints. The frame and the numbered markers carry
// `data-resume-highlight`, and a highlighted line `data-resume-mark`, so the
// browser PDF export can strip all of it from its copy of the page.

import { createContext, useContext, type FC, type ReactNode } from "react";
import type { SectionKind } from "@/app/lib/dashboard/resume/design-types";

/** A section of the page a control can point at. "personal" is the header block. */
export type FocusSection = Exclude<SectionKind, "page-break" | "custom">;

export interface PaperFocus {
  section: FocusSection;
  /** Frame this entry (a role, a school…) instead of the whole section. */
  entryId?: string;
  /** Lines to highlight inside the entry, by their index in the stored bullets. */
  bullets?: number[];
  /** Skills to highlight, by their text. */
  skills?: string[];
}

/** A numbered marker on one bullet: the fix card with the same number is about this line. */
export interface PaperMark {
  entryId: string;
  bulletIndex: number;
  n: number;
}

export interface PaperHighlight {
  focus: PaperFocus | null;
  marks: PaperMark[];
}

const NONE: PaperHighlight = { focus: null, marks: [] };

const PaperHighlightContext = createContext<PaperHighlight>(NONE);

export const PaperHighlightProvider: FC<{ value: PaperHighlight; children: ReactNode }> = ({ value, children }) => (
  <PaperHighlightContext.Provider value={value}>{children}</PaperHighlightContext.Provider>
);

export const usePaperHighlight = (): PaperHighlight => useContext(PaperHighlightContext);

// ---------------------------------------------------------------------------
// The readers. Each is a small client component the paper's section bodies
// render, so the sections themselves stay server components: the server's
// print page draws the same paper, and only these few wrappers hydrate there
// (where, with no provider, they draw nothing extra).
// ---------------------------------------------------------------------------

/**
 * The frame, drawn as an overlay on a `relative` parent so it never moves the
 * text: a page that reflowed under the pointer would change its page count.
 */
const Frame: FC = () => (
  <span
    aria-hidden
    data-resume-highlight
    className="pointer-events-none absolute -inset-x-[10px] -bottom-[6px] -top-[5px] z-10 rounded-md br-shadow br-lime"
  />
);

/** Frames a whole section (inside a `relative` section wrapper) when nothing narrower in it was named. */
export const SectionFrame: FC<{ section: FocusSection }> = ({ section }) => {
  const { focus } = usePaperHighlight();
  return focus !== null && focus.section === section && !focus.entryId ? <Frame /> : null;
};

/** Frames one entry (inside its `relative` wrapper) when the editor points at it. */
export const EntryFrame: FC<{ entryId: string }> = ({ entryId }) => {
  const { focus } = usePaperHighlight();
  return focus?.entryId === entryId ? <Frame /> : null;
};

/** A highlighted run of text. Ink on lime whatever the column's own colour, so it reads on a filled sidebar too. */
const Marked: FC<{ children: ReactNode }> = ({ children }) => (
  <span data-resume-mark className="rounded-sm bg-[#eef6ad] text-[#222325] ring-[3px] ring-[#eef6ad] [box-decoration-break:clone]">
    {children}
  </span>
);

/**
 * One bullet's text, highlighted when pointed at, with its marker's number in
 * the gutter left of the line (absolute, inside the `relative` list item) so
 * the line itself never rewraps.
 */
export const BulletText: FC<{ entryId?: string; index: number; text: string }> = ({ entryId, index, text }) => {
  const { focus, marks } = usePaperHighlight();
  if (entryId === undefined) return <span>{text}</span>;
  const mark = marks.find((m) => m.entryId === entryId && m.bulletIndex === index);
  const pointed = focus?.entryId === entryId && (focus.bullets ?? []).includes(index);
  return (
    <>
      {mark && (
        <span
          aria-hidden
          data-resume-highlight
          className="absolute right-full top-[0.15em] mr-[5px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#222325] font-sans text-[10px] font-extrabold leading-none text-white">
          {mark.n}
        </span>
      )}
      <span>{mark || pointed ? <Marked>{text}</Marked> : text}</span>
    </>
  );
};

/** One skill's text, highlighted when pointed at. */
export const SkillText: FC<{ skill: string }> = ({ skill }) => {
  const { focus } = usePaperHighlight();
  return focus?.section === "skills" && focus.skills?.includes(skill) ? <Marked>{skill}</Marked> : <>{skill}</>;
};
