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
// state below — `check` and `suggestions`. The check is a real scan now (see
// `ResumeCheck`), but it is a record of one moment of one document and the
// library has nowhere to keep it; it starts empty on every load, and the card
// offers the two ways to run one. The scan itself is not lost — the AI service
// stores it, and re-checking an unedited document is served from its cache.

import type { ScanReport } from "@/app/lib/ats/types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { resumeContentToText } from "@/app/lib/resume/api";
import { hydrateDesign, hydrateSections } from "@/app/lib/dashboard/resume/hydrate-design";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import type { StoredResumeDocument } from "@/app/lib/resume/api";

/**
 * The ATS check standing on a document: one real scan, from the AI service.
 *
 * Every number the card shows comes out of `report`. Nothing on this screen
 * adds to it, and in particular nothing moves it because a tool ran — the
 * editor used to add 13 after a tailor and 4 per keyword chip, which reported
 * a measurement nobody had taken. A check describes the text it scored and
 * only that text, which is why it carries `text`: the moment the document
 * reads differently, the card says the check is out of date and offers to run
 * it again, rather than quietly presenting an old score as the current one.
 */
/** What a job check needs from a picked posting. */
export interface CheckPosting {
  id?: string;
  company: string;
  role: string;
  description: string;
}

export interface ResumeCheck {
  report: ScanReport;
  /** When the score landed — drives the "scanned X ago" stamp. */
  at: Date;
  /** The posting it was scored against, as the card names it ("Linear — Senior Designer"). Null for a general check. */
  job: string | null;
  /**
   * The posting itself, held so a check the resume has outgrown can be run
   * again against the same job without picking it a second time. In memory
   * only, like the rest of the check.
   */
  posting: CheckPosting | null;
  /** Exactly the text that was scored (`resumeContentToText`). Compared against the document to tell a stale check. */
  text: string;
}

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
  /** The standing ATS check; null once removed or never run. */
  check: ResumeCheck | null;
  /** What the standing job check proposed — see `ResumeSuggestions`. */
  suggestions?: ResumeSuggestions;
}

/**
 * True when the document no longer reads the way it did when its check ran —
 * an edit by hand, a tool from the AI rail, anything. The check stays on the
 * card (it is still what that text scored) but stops being presented as this
 * resume's score.
 *
 * Compared on the rendered TEXT rather than the content object, because the
 * text is what was scored: a change the text does not show (an entry id, a
 * link label) cannot have moved the score and does not make the check stale.
 */
export const isStaleCheck = (doc: Pick<ResumeDocument, "check" | "content">): boolean =>
  doc.check !== null && doc.check.text !== resumeContentToText(doc.content);

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
 * (see `hydrate-design.ts`); the ATS check starts empty — the card opens on
 * the two ways to run one.
 */
export function fromStored(stored: StoredResumeDocument): ResumeDocument {
  return {
    id: stored.id,
    label: stored.label,
    content: stored.content,
    design: hydrateDesign(stored.template, stored.design),
    sections: hydrateSections(stored.template, stored.sections),
    updatedAt: stored.updatedAt,
    check: null,
  };
}
