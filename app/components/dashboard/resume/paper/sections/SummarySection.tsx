import type { FC } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumeDesign } from "@/app/lib/dashboard/resume/design-types";

export interface SummarySectionProps {
  content: ResumeContent;
  design: ResumeDesign;
}

const SummarySection: FC<SummarySectionProps> = ({ content }) =>
  content.summary ? (
    <p className="text-[length:var(--r-fs-base)] leading-[var(--r-lh)] text-[color:var(--r-text)]">{content.summary}</p>
  ) : (
    <p className="text-[length:var(--r-fs-small)] italic text-[color:var(--r-text-muted)]">No summary yet.</p>
  );

export default SummarySection;
