// Per-section-kind heading icons for `design.headings.icons` (none/outline/
// filled). Nothing upstream provides this: `ICON_SETS` in
// app/lib/dashboard/resume/icon-sets.ts is header CONTACT icons only
// (mail/phone/pin/link) and has no notion of section kinds. This is a small,
// closed, author-owned map — same house pattern as `HEADING_STYLES` /
// `ICON_SETS` themselves (closed enum -> record of static values).
//
// "custom" / "personal" / "page-break" are deliberately absent: personal is
// rendered outside this map entirely (see ResumePaper), page-break renders no
// heading at all, and "custom" has no natural icon. `SectionHeading` treats a
// missing entry the same as `icons: "none"` — it just doesn't mount one.

import { Award, Briefcase, FileText, FolderKanban, GraduationCap, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SectionKind } from "@/app/lib/dashboard/resume/design-types";

export const SECTION_ICONS: Partial<Record<SectionKind, LucideIcon>> = {
  summary: FileText,
  experience: Briefcase,
  education: GraduationCap,
  skills: Sparkles,
  training: Award,
  projects: FolderKanban,
};
