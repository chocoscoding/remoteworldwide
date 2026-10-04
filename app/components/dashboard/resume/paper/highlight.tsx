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
export type FocusSection = Exclude<SectionKind, "page-break">;

export interface PaperFocus {
  section: FocusSection;
  /** Frame every section: the whole resume is what is pointed at (an AI tool's pick). */
  all?: boolean;
  /** Frame this entry (a role, a school…) instead of the whole section. */
  entryId?: string;
  /** The custom section pointed at ("custom" has many on one page), by its id. */
  customId?: string;
  /** Lines to highlight inside the entry or custom section, by their index in the stored lines. */
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

/**
 * A line of the page by what it is: where "Fix tone & grammar" can propose a fix, and so where a
 * red underline can sit. An entry's id, never its position, so an underline follows its line.
 */
export type UnderlineAt =
  | { field: "summary" }
  | { field: "bullet"; entryId: string; index: number }
  | { field: "skill"; skill: string }
  | { field: "degree"; entryId: string }
  | { field: "detail"; entryId: string }
  | { field: "project"; entryId: string }
  | { field: "certification"; entryId: string }
  | { field: "point"; customId: string; index: number };

/**
 * Words to underline in red in one line (owner, 2026-10-04): what a proposed tone fix would change.
 * `text` is the line as the fix read it — once the line reads otherwise (applied, edited) the
 * underline no longer matches it and is not drawn.
 */
export interface PaperUnderline {
  at: UnderlineAt;
  text: string;
  /** Character ranges [start, end) of `text`. */
  ranges: [number, number][];
}

export interface PaperHighlight {
  focus: PaperFocus | null;
  marks: PaperMark[];
  underlines?: PaperUnderline[];
}

const NONE: PaperHighlight = { focus: null, marks: [], underlines: [] };

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

/**
 * Frames a whole section (inside a `relative` section wrapper) when nothing narrower in it was named.
 * A custom section is framed by its own id (`customId`), and not while one of its points is.
 */
export const SectionFrame: FC<{ section: FocusSection; customId?: string }> = ({ section, customId }) => {
  const { focus } = usePaperHighlight();
  if (focus === null) return null;
  if (focus.all) return <Frame />;
  if (focus.section !== section || focus.entryId) return null;
  if (section === "custom" && (focus.customId !== customId || (focus.bullets ?? []).length > 0)) return null;
  return <Frame />;
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

const sameLine = (a: UnderlineAt, b: UnderlineAt): boolean => {
  if (a.field !== b.field) return false;
  if (a.field === "summary") return true;
  if (a.field === "skill") return b.field === "skill" && a.skill === b.skill;
  if (a.field === "bullet") return b.field === "bullet" && a.entryId === b.entryId && a.index === b.index;
  if (a.field === "point") return b.field === "point" && a.customId === b.customId && a.index === b.index;
  return "entryId" in b && a.entryId === b.entryId;
};

/**
 * A line with the words a proposed fix would change underlined in red, 2.5px thick (owner,
 * 2026-10-04). `data-resume-mark`, so the PDF export strips the styling and keeps the words.
 */
export const UnderlinedText: FC<{ at: UnderlineAt; text: string }> = ({ at, text }) => {
  const { underlines = [] } = usePaperHighlight();
  const line = underlines.find((u) => u.text === text && sameLine(u.at, at));
  if (!line || line.ranges.length === 0) return <>{text}</>;
  const runs: ReactNode[] = [];
  let from = 0;
  line.ranges.forEach(([start, end], i) => {
    if (start > from) runs.push(text.slice(from, start));
    runs.push(
      <span
        key={i}
        data-resume-mark
        className="underline decoration-[#e5484d] decoration-[2.5px] underline-offset-[3px] [text-decoration-skip-ink:none]">
        {text.slice(start, end)}
      </span>,
    );
    from = end;
  });
  if (from < text.length) runs.push(text.slice(from));
  return <>{runs}</>;
};

/**
 * One bullet's text, highlighted when pointed at, with its marker's number in
 * the gutter left of the line (absolute, inside the `relative` list item) so
 * the line itself never rewraps.
 */
export const BulletText: FC<{ entryId?: string; customId?: string; index: number; text: string }> = ({ entryId, customId, index, text }) => {
  const { focus, marks } = usePaperHighlight();
  // A custom section's point: highlighted and underlined like a bullet, by its section's id.
  if (customId !== undefined) {
    const pointed = focus?.section === "custom" && focus.customId === customId && (focus.bullets ?? []).includes(index);
    const words = <UnderlinedText at={{ field: "point", customId, index }} text={text} />;
    return <span>{pointed ? <Marked>{words}</Marked> : words}</span>;
  }
  if (entryId === undefined) return <span>{text}</span>;
  const mark = marks.find((m) => m.entryId === entryId && m.bulletIndex === index);
  const pointed = focus?.entryId === entryId && (focus.bullets ?? []).includes(index);
  const words = <UnderlinedText at={{ field: "bullet", entryId, index }} text={text} />;
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
      <span>{mark || pointed ? <Marked>{words}</Marked> : words}</span>
    </>
  );
};

/** One skill's text, highlighted when pointed at, underlined where a tone fix would change it. */
export const SkillText: FC<{ skill: string }> = ({ skill }) => {
  const { focus } = usePaperHighlight();
  const words = <UnderlinedText at={{ field: "skill", skill }} text={skill} />;
  return focus?.section === "skills" && focus.skills?.includes(skill) ? <Marked>{words}</Marked> : words;
};
