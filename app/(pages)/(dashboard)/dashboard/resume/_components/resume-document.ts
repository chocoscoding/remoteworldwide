// Per-document state for the resume screen.
//
// Each resume version (Linear / Deel / Master / any "+ New resume") owns its
// OWN content AND its own design/section customization — unlike the old
// screen's single shared `docContent`/local-settings that leaked across
// every role in the dropdown. `ResumeDesignProvider` (chunk A3a) is
// uncontrolled internally, so switching the active document is an explicit
// "read the live design/sections out of the hook, stash them on the
// outgoing document, then swap" rather than anything reactive — see
// `ResumeScreenBody.tsx`'s `switchTo`/`createNewResume`.

import { RESUME } from "@/app/lib/dashboard/mock-data";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { DEFAULT_DESIGN, DEFAULT_SECTIONS } from "@/app/lib/dashboard/resume/design-defaults";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";

export interface ResumeDocument {
  id: string;
  label: string;
  content: ResumeContent;
  design: ResumeDesign;
  sections: SectionConfig[];
  /** Score against this document's target role, 0-100. */
  score: number;
  /** Score before this resume was tailored — null for the untailored master resume. */
  before: number | null;
  /** True for a freshly created blank "+ New resume" document. */
  isBlank?: boolean;
}

/**
 * Starter content for a brand-new, not-yet-written resume — same shell as
 * `RESUME`, empty lists and placeholder copy. `portfolio` is set to an empty
 * string and never rendered: `HeaderBlock` (chunk A2) intentionally doesn't
 * read `content.portfolio` — `content.links` is the real header-link source
 * now, which is why the Content form below doesn't surface a portfolio field
 * either.
 */
export function createBlankContent(): ResumeContent {
  return {
    name: "Your name",
    title: "Your title",
    location: "Your location",
    email: "you@email.com",
    phone: "",
    portfolio: "",
    links: [],
    summary: "Write a short summary of your experience and what you're looking for next.",
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
 * Seeds the 3 starting documents from the same shared `RESUME` mock content —
 * there is no distinct mock dataset per role today, so all 3 start identical
 * and only diverge once the user edits one of them. `design`/`sections` start
 * at the shared `DEFAULT_DESIGN`/`DEFAULT_SECTIONS` module references for all
 * 3; sharing the reference is safe because nothing ever mutates them in
 * place — every update flows through the design reducer (which returns new
 * objects on change) or through `setDocuments` (ditto).
 */
export const INITIAL_DOCUMENTS: ResumeDocument[] = [
  { id: "res-linear", label: "Linear — Sr PD", content: RESUME, design: DEFAULT_DESIGN, sections: DEFAULT_SECTIONS, score: 89, before: 71 },
  { id: "res-deel", label: "Deel — Sr Designer", content: RESUME, design: DEFAULT_DESIGN, sections: DEFAULT_SECTIONS, score: 76, before: 72 },
  { id: "res-master", label: "Master resume", content: RESUME, design: DEFAULT_DESIGN, sections: DEFAULT_SECTIONS, score: 74, before: null },
];
