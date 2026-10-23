"use client";

// `ResumePaper` behind a client boundary, for the server print pages (app/print/resume, app/print/draft).
//
// Why: since the apply step's click-to-edit (owner, 2026-10-20) HeaderBlock and SkillsSection read
// `usePaperHighlight()`, a hook from the client-only highlight module. Rendered straight from a
// server component they throw ("Attempted to call usePaperHighlight() from the server"), and every
// print page answered 500, so no server PDF could be made (found 2026-10-22 building item I of
// PHASE6-OPEN-ITEMS-PLAN.md). Behind this boundary the paper is still rendered to HTML on the
// server, so the PDF keeps its real text; outside a provider the hook reads its "nothing pointed
// at" default, so nothing editor-only is drawn. Every prop is plain data, safe to pass across.

import ResumePaper, { type ResumePaperProps } from "./ResumePaper";

export default function ClientResumePaper(props: ResumePaperProps) {
  return <ResumePaper {...props} />;
}
