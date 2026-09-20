// Per-document state for the resume screen.
//
// Each resume owns its OWN content AND its own design/section customization —
// unlike the old screen's single shared `docContent`/local-settings that
// leaked across every role in the dropdown. `ResumeDesignProvider` (chunk A3a)
// is uncontrolled internally, so switching the active document is an explicit
// "read the live design/sections out of the hook, stash them on the outgoing
// document, then swap" rather than anything reactive — see
// `ResumeScreenBody.tsx`'s `switchTo`/`createNewResume`.
//
// Documents are real now: they come from the AI service's library and are
// autosaved back to it (`useResumeAutosave`). What is NOT saved is the ATS
// state below — `score`, `before`, `scan`, `suggestions`. The scorer behind it
// is still a stub, and a made-up number should not outlive the session that
// made it up; those fields start empty on every load until a real scan owns them.

import { scoreApplication } from "@/app/lib/dashboard/ats-stub";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { hydrateDesign, hydrateSections } from "@/app/lib/dashboard/resume/hydrate-design";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import type { StoredResumeDocument } from "@/app/lib/resume/api";

/**
 * The ATS check currently standing on a document. `null` means none — the
 * card offers the two ways to run one instead of a number. A job check
 * carries the job it was scored against, which is what the card names (never
 * the document's own label).
 */
export type ResumeScan = { kind: "general"; at: Date } | { kind: "job"; at: Date; job: string };

/**
 * What a job check proposed changing. Only a check that actually read THIS
 * resume against a posting can produce one, so it is absent on everything a
 * user starts or imports: offering them a rewrite nothing derived from their
 * resume means offering them someone else's summary. Nothing produces one
 * yet — this is the shape the real scorer's findings arrive in.
 */
export interface ResumeSuggestions {
  /** A rewritten Summary, and the one-line reason shown beside Accept. */
  summary: { text: string; reason: string };
}

export interface ResumeDocument {
  id: string;
  label: string;
  content: ResumeContent;
  design: ResumeDesign;
  sections: SectionConfig[];
  /** When the library last took a save of this document. */
  updatedAt: Date;
  /** The ATS score the card shows while `scan` stands, 0-100. */
  score: number;
  /** The general baseline a job check moved from — null for a general check. */
  before: number | null;
  /** The standing ATS check; null once removed or never run. */
  scan: ResumeScan | null;
  /** What the standing job check proposed — see `ResumeSuggestions`. */
  suggestions?: ResumeSuggestions;
}

/**
 * Whether a resume has nothing on it yet for a check or a suggestion to read.
 * Derived from the content rather than stamped on the document at creation: a
 * resume started from scratch stops being blank the moment it is written, and
 * an import the parser found nothing in is blank however it arrived.
 */
export const isBlankContent = (content: ResumeContent): boolean =>
  !content.summary.trim() &&
  content.skills.length === 0 &&
  // A role just added and not yet typed into is a row in the form, not content.
  content.experience.every((entry) => !entry.role.trim() && !entry.company.trim() && entry.bullets.every((bullet) => !bullet.trim()));

/** The same general number the ATS screen reports for an id — the two surfaces agree. */
export const generalScoreFor = (id: string) => scoreApplication(id, undefined).score;

/**
 * Starter content for a brand-new, not-yet-written resume — same shell as
 * `RESUME`, every field empty. The "Your name" / "you@email.com" prompts are
 * the Content form's input placeholders, never values: anything stored here is
 * on the page, and a resume that prints "you@email.com" is worse than one that
 * prints nothing. `portfolio` is never rendered: `HeaderBlock` (chunk A2)
 * intentionally doesn't read `content.portfolio` — `content.links` is the real
 * header-link source now, which is why the Content form doesn't surface a
 * portfolio field either.
 */
export function createBlankContent(): ResumeContent {
  return {
    name: "",
    title: "",
    location: "",
    email: "",
    phone: "",
    portfolio: "",
    links: [],
    summary: "",
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    skills: [],
  };
}

/**
 * Deep copy for "duplicate the current document's content" when creating a
 * new resume. `ResumeContent` is plain JSON-safe data, so a JSON round-trip
 * is sufficient and needs no extra dependency.
 */
export function cloneContent(content: ResumeContent): ResumeContent {
  return JSON.parse(JSON.stringify(content)) as ResumeContent;
}

/**
 * The name an imported resume starts with — its file name, read as words, so
 * the document reads as theirs.
 */
export const importLabel = (fileName: string): string =>
  fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim().slice(0, 80) || "Imported resume";

/**
 * A stored document -> the one the editor runs on. The saved look is a patch
 * (see `hydrate-design.ts`); everything about ATS starts empty — the card opens
 * on the two ways to run a check.
 */
export function fromStored(stored: StoredResumeDocument): ResumeDocument {
  return {
    id: stored.id,
    label: stored.label,
    content: stored.content,
    design: hydrateDesign(stored.template, stored.design),
    sections: hydrateSections(stored.template, stored.sections),
    updatedAt: stored.updatedAt,
    score: 0,
    before: null,
    scan: null,
  };
}
