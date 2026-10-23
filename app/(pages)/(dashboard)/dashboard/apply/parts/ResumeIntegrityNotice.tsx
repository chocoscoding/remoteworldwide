"use client";
import { useIngestedResumeQuery } from "@/hooks/queries/useAtsQueries";
import { structureIssues } from "@/app/lib/resume/parse-integrity";
import type { ResumeContent } from "@/app/lib/dashboard/types";

export default function ResumeIntegrityNotice({ resumeId, content, onReview }: { resumeId: string | null; content?: ResumeContent | null; onReview?: () => void }) {
  const query = useIngestedResumeQuery(resumeId);
  const cv = content ?? query.data?.content;
  if (!cv) return null;
  const issues = [...structureIssues(cv), ...cv.experience.flatMap((entry, i) => !entry.company.trim() && !/consultant|freelance|early experience/i.test(entry.role) ? [`Work history ${i + 1}: employer is not identified. Check the original; do not guess a name.`] : [])];
  if (!issues.length) return null;
  return <aside role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-primary">
    <strong>Check your work history before sending</strong>
    <p className="mt-1">The match score does not verify imported employers, dates or job titles. You can continue, or review these fields against your original file.</p>
    <ul className="mt-2 list-disc pl-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
    {onReview && <button type="button" onClick={onReview} className="mt-2 cursor-pointer font-bold underline">Review work history</button>}
  </aside>;
}
