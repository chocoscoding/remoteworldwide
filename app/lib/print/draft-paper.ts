// An apply-step resume as its paper draws it, for the server's print page and its Word file.
//
// The apply wizard's drafts (and the original they start from) are ingested resumes (`ai_resumes`),
// not built ones: they have no design of their own, and the step shows them in the resume creator's
// default look with the parts hidden for this application left off. The server PDF must be that
// same page (owner, 2026-10-22, PHASE6-OPEN-ITEMS-PLAN.md item I), so this is the one place that
// says what it is; useResumeDownload's dialog fallback draws the same three values.
//
// Pure (type-only imports below it), so tests/pdf-download.test.mjs can load it.

import { DEFAULT_DESIGN, DEFAULT_SECTIONS, withContentSections } from "@/app/lib/dashboard/resume/design-defaults";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { reconcileGroups } from "@/app/lib/resume/skills";
import { visibleContent } from "@/app/lib/resume/visible";

export interface DraftPaper {
  design: ResumeDesign;
  sections: SectionConfig[];
  content: ResumeContent;
}

/** Skills a tool added to the flat list only are brought into the entries (as the step shows them), then the hidden parts go. */
export function draftPaper(stored: ResumeContent): DraftPaper {
  const content = visibleContent(reconcileGroups(stored));
  return { design: DEFAULT_DESIGN, sections: withContentSections(DEFAULT_SECTIONS, content), content };
}
