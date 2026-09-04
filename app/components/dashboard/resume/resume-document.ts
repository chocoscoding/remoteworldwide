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
import { scoreApplication } from "@/app/lib/dashboard/ats-stub";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { DEFAULT_DESIGN, DEFAULT_SECTIONS } from "@/app/lib/dashboard/resume/design-defaults";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";

/**
 * The ATS check currently standing on a document. `null` means none — the
 * card offers the two ways to run one instead of a number. A job check
 * carries the job it was scored against, which is what the card names (never
 * the document's own label).
 */
export type ResumeScan = { kind: "general"; at: Date } | { kind: "job"; at: Date; job: string };

export interface ResumeDocument {
  id: string;
  label: string;
  content: ResumeContent;
  design: ResumeDesign;
  sections: SectionConfig[];
  /** The ATS score the card shows while `scan` stands, 0-100. */
  score: number;
  /** The general baseline a job check moved from — null for a general check. */
  before: number | null;
  /** The standing ATS check; null once removed or never run. */
  scan: ResumeScan | null;
  /** True for a freshly created blank "+ New resume" document. */
  isBlank?: boolean;
}

/** The same general number the ATS screen reports for an id — the two surfaces agree. */
export const generalScoreFor = (id: string) => scoreApplication(id, undefined).score;

// Seed stamps live at module scope (not render) so the purity rule stays
// happy; timeago-react re-renders itself on an interval after mount, so any
// server/client drift self-corrects.
const SCANNED_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000);
const SCANNED_DAYS_AGO = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
const SCANNED_2_DAYS_AGO = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

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
 * The landing's "start from a resume you have" path — an uploaded file
 * becomes an editable draft. There's no real parser at the UI-only stage, so
 * the draft opens pre-filled with the shared mock content; the label comes
 * from the file name so the document reads as theirs.
 */
export function createImportedDocument(fileName: string): ResumeDocument {
  const label = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Imported resume";
  const id = `res-import-${Date.now()}`;
  return {
    id,
    label,
    content: cloneContent(RESUME),
    design: DEFAULT_DESIGN,
    sections: DEFAULT_SECTIONS,
    score: generalScoreFor(id),
    before: null,
    // Nothing has checked it yet — the card opens on the two ways to run one.
    scan: null,
  };
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
// Seeded scores derive from the same general baseline a fresh check returns,
// so "remove, then check again" lands on a number the user has already seen.
const LINEAR_GENERAL = generalScoreFor("res-linear");
const DEEL_GENERAL = generalScoreFor("res-deel");

export const INITIAL_DOCUMENTS: ResumeDocument[] = [
  {
    id: "res-linear",
    label: "Linear — Sr PD",
    content: RESUME,
    design: DEFAULT_DESIGN,
    sections: DEFAULT_SECTIONS,
    score: Math.min(97, LINEAR_GENERAL + 18),
    before: LINEAR_GENERAL,
    scan: { kind: "job", at: SCANNED_HOURS_AGO, job: "Linear — Senior Product Designer" },
  },
  {
    id: "res-deel",
    label: "Deel — Sr Designer",
    content: RESUME,
    design: DEFAULT_DESIGN,
    sections: DEFAULT_SECTIONS,
    score: Math.min(97, DEEL_GENERAL + 4),
    before: DEEL_GENERAL,
    scan: { kind: "job", at: SCANNED_DAYS_AGO, job: "Deel — Senior Designer" },
  },
  {
    id: "res-master",
    label: "Master resume",
    content: RESUME,
    design: DEFAULT_DESIGN,
    sections: DEFAULT_SECTIONS,
    score: generalScoreFor("res-master"),
    before: null,
    scan: { kind: "general", at: SCANNED_2_DAYS_AGO },
  },
];
