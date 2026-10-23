// Pure, with type-only imports: the browser (resume/api.ts re-exports it) and the server's print
// page for apply drafts (app/print/draft/[id]) both draw the resume without its hidden parts.

import type { ResumeContent } from "@/app/lib/dashboard/types";

/**
 * The resume without the parts hidden for this application (`hiddenParts`, the apply wizard's
 * eyes): what is scored, written from, downloaded and sent. Mirrors `visibleContent` in the AI
 * service's src/lib/resumeText.ts, so both texts of one resume stay identical.
 */
export function visibleContent(content: ResumeContent): ResumeContent {
  const hidden = new Set(content.hiddenParts ?? []);
  if (hidden.size === 0) return content;
  return {
    ...content,
    summary: hidden.has("summary") ? "" : content.summary,
    skills: hidden.has("skills") ? [] : content.skills,
    ...(content.skillGroups && hidden.has("skills") ? { skillGroups: [] } : {}),
    education: hidden.has("education") ? [] : content.education,
    projects: hidden.has("projects") ? [] : content.projects,
    certifications: hidden.has("certifications") ? [] : content.certifications,
    experience: content.experience
      .filter((entry) => !hidden.has(`exp:${entry.id}`))
      .map((entry) => ({ ...entry, bullets: entry.bullets.filter((_, index) => !hidden.has(`exp:${entry.id}:${index}`)) })),
    hiddenParts: [],
  };
}
