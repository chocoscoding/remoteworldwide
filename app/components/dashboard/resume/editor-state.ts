// Everything the resume editor can undo, in one history (`history.ts`).
//
// A point in the history is the whole editable state of the open resume: its
// look (`design`, `sections`), its words (`content`), the standing ATS check,
// and `marks` — what the AI side of the screen says was done about the resume
// (a suggestion accepted, a take used, a tool's caption). The marks travel
// with the words so the two can never disagree: undo a rewrite and its
// "Applied" goes with it, and the button to apply it comes back.
//
// What is a step and what is not:
//   - every design control                       a step (a drag is one run)
//   - typing into a field                        one run per field, closed when typing pauses
//   - adding, removing or moving an entry        a step
//   - an AI tool or suggestion that changed text a step, with its caption
//   - accepting or dismissing a suggestion       a step
//   - removing the ATS check                     a step
//   - a check landing, a tool changing nothing   a fact (see `history.ts`), never a step
// Proposals waiting to be picked (Rewrite's takes, Quantify's list) are the
// screen's, not the resume's, and stay out; whether one was used is a mark.

import type { SetStateAction } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign, ResumeTemplateId, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import { snapshotReducer, transientGroup, type DesignAction } from "@/app/lib/dashboard/resume/design-reducer";
import { everywhere, record, redo, settle, soleLeafPath, startHistory, undo, type History } from "@/app/lib/dashboard/resume/history";
import type { ResumeCheck } from "./resume-document";

export interface EditorMarks {
  /** The last template card applied, for the gallery's tick. Seeded "atlas": a fresh resume IS Atlas (see TemplatesPanel). */
  template: ResumeTemplateId;
  /** What was done about the standing check's proposed Summary. */
  summarySuggestion: "pending" | "accepted" | "dismissed";
  /** The Rewrite take in use, by its text. The takes stay out until one is used, and come back when that is undone. */
  rewriteUsed: string | null;
  /** Quantify upgrades applied, by `quantifyKey`. */
  quantified: string[];
  /** What acting on a suggestion card came to, by card id — shown in place of its button. */
  outcomes: Record<string, string>;
  /** Fix cards set aside with Dismiss, by card id. A step: Undo brings the card back. */
  dismissed: string[];
  /**
   * "Add missing keywords" proposals set aside with ✗, folded to lowercase. A step: Undo brings the
   * proposal back. One ticked in needs no mark — it is in Skills, and Undo takes it out again.
   */
  rejectedKeywords: string[];
  /** "Fix tone & grammar" proposals set aside with ✗, by `toneFixKey`. A step: Undo brings the fix back. */
  dismissedFixes: string[];
  /** Each AI tool's caption, by tool id. A tool with one has run ("Run again"). */
  captions: Record<string, string>;
  /** What the last "Ask for a rewrite" did, or why it couldn't. */
  askStatus: string | null;
}

export interface EditorSnapshot {
  design: ResumeDesign;
  sections: SectionConfig[];
  content: ResumeContent;
  check: ResumeCheck | null;
  marks: EditorMarks;
}

export type EditorHistory = History<EditorSnapshot>;

export type EditorAction =
  | DesignAction
  /**
   * A change to the resume, or to what was done about a suggestion: one step.
   * `typing` lets a change to a single field fold into the run of typing into
   * it; a change to the shape (an entry added or removed) is a step regardless.
   */
  | {
      type: "edit";
      content?: SetStateAction<ResumeContent>;
      /**
       * The section list, changed in the same step as the content: a custom section added or
       * removed with its points, its name typed (`typing` folds that like any field), the Summary
       * removed with its text.
       */
      sections?: (prev: SectionConfig[]) => SectionConfig[];
      marks?: Partial<EditorMarks> | ((prev: EditorMarks) => Partial<EditorMarks>);
      removeCheck?: true;
      typing?: true;
    }
  /** Something learned rather than done — written into every point, never a step. */
  | {
      type: "learn";
      check?: ResumeCheck | null;
      outcome?: { id: string; text: string };
      caption?: { id: string; text: string };
      askStatus?: string | null;
    }
  /** Closes the open run, so the next change starts a step of its own. */
  | { type: "history/settle" };

/** Runs of typing are told apart from drags by this prefix: only they close on a pause. */
export const TYPING_GROUP = "type:";

export const quantifyKey = (q: { entryIndex: number; bulletIndex: number; after: string; customId?: string }): string =>
  `${q.customId ?? q.entryIndex}:${q.bulletIndex}:${q.after}`;

const START_MARKS: EditorMarks = {
  template: "atlas",
  summarySuggestion: "pending",
  rewriteUsed: null,
  quantified: [],
  outcomes: {},
  dismissed: [],
  rejectedKeywords: [],
  dismissedFixes: [],
  captions: {},
  askStatus: null,
};

export function startEditor(seed: Omit<EditorSnapshot, "marks">): EditorHistory {
  return startHistory({ ...seed, marks: START_MARKS });
}

/** `prev` with `patch` laid over it, or `prev` itself when the patch changes nothing. */
function patched<T extends object>(prev: T, patch: Partial<T> | undefined): T {
  if (!patch) return prev;
  const changed = (Object.keys(patch) as (keyof T)[]).some((key) => !Object.is(patch[key], prev[key]));
  return changed ? { ...prev, ...patch } : prev;
}

/** Two points that read the same everywhere — by reference, since nothing here is ever mutated. */
const samePoint = (a: EditorSnapshot, b: EditorSnapshot): boolean =>
  a.design === b.design && a.sections === b.sections && a.content === b.content && a.check === b.check && a.marks === b.marks;

function edit(s: EditorSnapshot, a: Extract<EditorAction, { type: "edit" }>): EditorSnapshot {
  const content = a.content === undefined ? s.content : typeof a.content === "function" ? a.content(s.content) : a.content;
  const sections = a.sections ? a.sections(s.sections) : s.sections;
  const marks = patched(s.marks, typeof a.marks === "function" ? a.marks(s.marks) : a.marks);
  const check = a.removeCheck ? null : s.check;
  if (content === s.content && sections === s.sections && marks === s.marks && check === s.check) return s;
  return { ...s, content, sections, marks, check };
}

function learn(s: EditorSnapshot, a: Extract<EditorAction, { type: "learn" }>): EditorSnapshot {
  const { outcome, caption } = a;
  const marks = patched(s.marks, {
    ...(outcome && s.marks.outcomes[outcome.id] !== outcome.text ? { outcomes: { ...s.marks.outcomes, [outcome.id]: outcome.text } } : {}),
    ...(caption && s.marks.captions[caption.id] !== caption.text ? { captions: { ...s.marks.captions, [caption.id]: caption.text } } : {}),
    ...(a.askStatus !== undefined ? { askStatus: a.askStatus } : {}),
  });
  const check = a.check === undefined ? s.check : a.check;
  if (marks === s.marks && check === s.check) return s;
  return { ...s, marks, check };
}

export function editorReducer(h: EditorHistory, a: EditorAction): EditorHistory {
  switch (a.type) {
    case "history/undo":
      return undo(h);
    case "history/redo":
      return redo(h);
    case "history/settle":
      return settle(h);
    case "learn":
      return everywhere(h, (s) => learn(s, a), samePoint);
    case "edit": {
      const next = edit(h.present, a);
      if (!a.typing || next === h.present) return record(h, next);
      // Read across the words and the section list together, so typing a custom section's name folds too.
      const field = soleLeafPath({ content: h.present.content, sections: h.present.sections }, { content: next.content, sections: next.sections });
      // A single field changed and nothing else did: part of typing into it.
      const typing = typeof field === "string" && next.marks === h.present.marks && next.check === h.present.check;
      return record(h, next, typing ? `${TYPING_GROUP}${field}` : null);
    }
    default: {
      const s = h.present;
      const look = snapshotReducer(s, a);
      if (look === s) return record(h, s, transientGroup(a));
      const marks = a.type === "template/apply" ? patched(s.marks, { template: a.id }) : s.marks;
      return record(h, { ...s, design: look.design, sections: look.sections, marks }, transientGroup(a));
    }
  }
}
