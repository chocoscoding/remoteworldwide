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

import { createContext, useContext, useState, type FC, type ReactNode } from "react";
import { cn } from "@/lib/utils";
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

/** A number the AI suggested, to highlight in the line it went into (RWW/ATS-QUALITY-PLAN.md, 13.8). */
export interface PaperFigure {
  /** The line as Quantify wrote it; a line that has changed a lot since is no longer marked. */
  line: string;
  figure: string;
}

/**
 * The apply wizard's eyes (owner, 2026-10-18): one in the margin beside each section and role, and
 * one beside each line of a role while it is hovered. A hidden part stays on the page, washed out,
 * and is left out of what is scored and sent (`hiddenParts`, `visibleContent`). Keys as in
 * `ResumeContent.hiddenParts`.
 */
export interface PaperEyes {
  hidden: readonly string[];
  onToggle: (key: string) => void;
  /** The experience entries' ids: only a role's lines get their own eyes. */
  experienceIds: readonly string[];
}

export interface PaperHighlight {
  focus: PaperFocus | null;
  marks: PaperMark[];
  underlines?: PaperUnderline[];
  /** The AI's numbers, highlighted while the "AI numbers" pill shows them. */
  figures?: PaperFigure[];
  /** True while the figures' highlight fades out. */
  figuresFading?: boolean;
  /** The apply wizard's show/hide eyes; absent everywhere else. */
  eyes?: PaperEyes;
  /** The apply wizard's click-to-edit lines; absent everywhere else. */
  edits?: PaperEdits;
}

/**
 * The apply wizard's own edits on the page (owner, 2026-10-19: "click it and edit its text ... delete
 * the line, change the number, since I can undo it"): the summary and each role's lines take a click
 * and a few words, saved when the line loses focus. An emptied line is a deleted one.
 */
export interface PaperEdits {
  onSummary: (text: string) => void;
  onBullet: (entryId: string, index: number, text: string) => void;
  /** The name and the title under it, retyped the same way (owner, 2026-10-20). */
  onName?: (text: string) => void;
  onTitle?: (text: string) => void;
  /** One printed Skills line ("Frameworks: React, Express"), by its block's id (`editSkills`). */
  onSkills?: (blockId: string, text: string) => void;
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

/** The sections with an eye of their own, and the key each hides under. Experience is hidden role by role. */
const SECTION_EYE: Partial<Record<FocusSection, string>> = {
  summary: "summary",
  skills: "skills",
  education: "education",
  projects: "projects",
  training: "certifications",
};

const EyeIcon: FC<{ off: boolean; size: number }> = ({ off, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden>
    {off ? (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2" />
        <path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6" />
      </>
    ) : (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

/**
 * One eye in the page's left margin: 75% until pointed at (owner, 2026-10-18), filled ink while
 * its part is hidden. `data-resume-highlight`, so no export or print ever carries it.
 */
const Eye: FC<{ hidden: boolean; label: string; onToggle: () => void; small?: boolean; className?: string }> = ({
  hidden,
  label,
  onToggle,
  small = false,
  className,
}) => (
  <button
    type="button"
    data-resume-highlight
    aria-pressed={hidden}
    aria-label={hidden ? `Show ${label} again` : `Hide ${label} for this job`}
    title={hidden ? `Show ${label} again` : `Hide ${label} for this job`}
    onClick={onToggle}
    className={cn(
      "absolute right-full z-20 grid cursor-pointer place-content-center rounded-md border font-sans opacity-75 transition-opacity hover:opacity-100 focus-visible:opacity-100",
      // Small enough to sit inside the page's own left margin (6mm by default): a sheet clips
      // anything past its edge, since its columns are the pages beside it.
      small ? "top-[0.15em] mr-[3px] h-[14px] w-[14px]" : "top-0 mr-[3px] h-[18px] w-[18px]",
      hidden ? "border-[#222325] bg-[#222325] text-[#e1f073]" : "border-black/15 bg-white text-[#222325] hover:bg-[#eef6ad]",
      className,
    )}>
    <EyeIcon off={hidden} size={small ? 9 : 12} />
  </button>
);

/** A hidden part washed out under a light white layer, so the page keeps its shape (owner, 2026-10-18). */
const Wash: FC = () => (
  <span aria-hidden data-resume-highlight className="pointer-events-none absolute -inset-x-[4px] -inset-y-[2px] z-10 bg-white/80" />
);

/** A section's eye and wash, inside its `relative` wrapper, when the page is showing eyes. */
const SectionEye: FC<{ section: FocusSection }> = ({ section }) => {
  const { eyes } = usePaperHighlight();
  const key = SECTION_EYE[section];
  if (!eyes || !key) return null;
  const hidden = eyes.hidden.includes(key);
  return (
    <>
      <Eye
        hidden={hidden}
        label={section === "training" ? "Certifications" : section[0].toUpperCase() + section.slice(1)}
        onToggle={() => eyes.onToggle(key)}
      />
      {hidden && <Wash />}
    </>
  );
};

/**
 * Frames a whole section (inside a `relative` section wrapper) when nothing narrower in it was named.
 * A custom section is framed by its own id (`customId`), and not while one of its points is.
 */
export const SectionFrame: FC<{ section: FocusSection; customId?: string }> = ({ section, customId }) => (
  <>
    <SectionEye section={section} />
    <SectionFocusFrame section={section} customId={customId} />
  </>
);

const SectionFocusFrame: FC<{ section: FocusSection; customId?: string }> = ({ section, customId }) => {
  const { focus } = usePaperHighlight();
  if (focus === null) return null;
  if (focus.all) return <Frame />;
  if (focus.section !== section || focus.entryId) return null;
  if (section === "custom" && (focus.customId !== customId || (focus.bullets ?? []).length > 0)) return null;
  return <Frame />;
};

/**
 * Frames one entry (inside its `relative` wrapper) when the editor points at it. A role also gets
 * its eye, and its wash while hidden, when the page is showing eyes.
 */
export const EntryFrame: FC<{ entryId: string }> = ({ entryId }) => {
  const { focus, eyes } = usePaperHighlight();
  const key = `exp:${entryId}`;
  const eye = eyes && eyes.experienceIds.includes(entryId);
  const hidden = Boolean(eye && eyes?.hidden.includes(key));
  return (
    <>
      {eye && eyes && <Eye hidden={hidden} label="this role" onToggle={() => eyes.onToggle(key)} />}
      {hidden && <Wash />}
      {focus?.entryId === entryId ? <Frame /> : null}
    </>
  );
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
  const { underlines = [], figures = [], figuresFading = false, edits } = usePaperHighlight();
  if (edits && at.field === "summary") return <EditableLine text={text} label="Summary" onCommit={edits.onSummary} />;
  if (edits && at.field === "bullet")
    return <EditableLine text={text} label="this line" onCommit={(next) => edits.onBullet(at.entryId, at.index, next)} />;
  const line = underlines.find((u) => u.text === text && sameLine(u.at, at));
  if (!line || line.ranges.length === 0) {
    const ranges = figureRanges(text, figures);
    return ranges.length > 0 ? <FigureMarks text={text} ranges={ranges} fading={figuresFading} /> : <>{text}</>;
  }
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
 * A line the person can click into and retype, saved on blur (Enter saves, Escape puts it back).
 * Plain text while editable, and remounted after every save or cancel, so React never has to
 * reconcile with what the browser's own editing wrote into the DOM.
 */
export const EditableLine: FC<{ text: string; label: string; onCommit: (text: string) => void; hint?: string }> = ({
  text,
  label,
  onCommit,
  hint = "Click to edit. Clear it to delete the line.",
}) => {
  const [round, setRound] = useState(0);
  const done = (element: HTMLElement, save: boolean) => {
    const next = (element.innerText ?? "").replace(/\s+/g, " ").trim();
    setRound((n) => n + 1);
    if (save && next !== text.trim()) onCommit(next);
  };
  return (
    <span
      key={round}
      role="textbox"
      aria-label={`Edit ${label}`}
      title={hint}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      onBlur={(event) => done(event.currentTarget, true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.innerText = text;
          event.currentTarget.blur();
        }
      }}
      className="-mx-[2px] cursor-text rounded-sm px-[2px] outline-none transition-colors hover:bg-[#eef6ad]/60 focus:bg-[#fbfde9] focus:shadow-[0_0_0_1px_#222325]">
      {text}
    </span>
  );
};

/** Lowercase meaning words of a line, for "is this still the line the AI wrote?". */
const wordsOf = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2);

/** Where each AI number sits in this line, when the line still keeps at least half the words it had. */
const figureRanges = (text: string, figures: readonly PaperFigure[]): [number, number][] => {
  const ranges: [number, number][] = [];
  const now = new Set(wordsOf(text));
  for (const { line, figure } of figures) {
    const was = wordsOf(line);
    if (was.length > 0 && was.filter((word) => now.has(word)).length * 2 < was.length) continue;
    const at = text.indexOf(figure);
    if (at !== -1 && !ranges.some(([start, end]) => at < end && at + figure.length > start)) ranges.push([at, at + figure.length]);
  }
  return ranges.sort((a, b) => a[0] - b[0]);
};

/** The AI's numbers in lime, fading out when the pill's five seconds are up. `data-resume-mark`, so the PDF prints plain text. */
const FigureMarks: FC<{ text: string; ranges: [number, number][]; fading: boolean }> = ({ text, ranges, fading }) => {
  const runs: ReactNode[] = [];
  let from = 0;
  ranges.forEach(([start, end], i) => {
    if (start > from) runs.push(text.slice(from, start));
    runs.push(
      <span
        key={i}
        data-resume-mark
        // rounded-sm as it reads (owner, 2026-10-18): padding cancelled by an equal negative margin
        // instead of a ring, so the corners stay 2px and the words don't move when it lights.
        className={cn(
          "-mx-[3px] rounded-sm px-[3px] transition-[background-color] duration-700 [box-decoration-break:clone]",
          fading ? "bg-transparent" : "bg-[#f6d77a] text-[#222325]",
        )}>
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
  const { focus, marks, eyes } = usePaperHighlight();
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
  // A role's line has its own eye, shown while the role is hovered; a hidden line fades back.
  const lineKey = `exp:${entryId}:${index}`;
  const lineEye = eyes && eyes.experienceIds.includes(entryId) && !eyes.hidden.includes(`exp:${entryId}`);
  const lineHidden = Boolean(lineEye && eyes?.hidden.includes(lineKey));
  if (lineEye && eyes) {
    return (
      <>
        <Eye
          small
          hidden={lineHidden}
          label="this line"
          onToggle={() => eyes.onToggle(lineKey)}
          className={lineHidden ? undefined : "!opacity-0 group-hover/entry:!opacity-75 hover:!opacity-100 focus-visible:!opacity-100"}
        />
        <span className={cn("transition-opacity", lineHidden && "opacity-25")}>{words}</span>
      </>
    );
  }
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
