import { APPS, JD_CONTENT } from "@/app/lib/dashboard/mock-data";

/**
 * A job this screen can answer questions about.
 *
 * Two ways one gets here, and the distinction is worth keeping: `platform`
 * jobs are listings already on Remote Worldwide, `pasted` ones the user put
 * in themselves. A pasted job joins the same list afterwards, so it can be
 * picked again without re-pasting.
 */
export interface JobOption {
  id: string;
  company: string;
  role: string;
  salary?: string;
  jdText: string;
  /** Phrase to highlight inside `jdText`, where one is worth calling out. */
  highlight?: string;
  source: "platform" | "pasted";
}

/**
 * Stands in for a real JD body on listings that don't carry one in the mock
 * data. Written generically enough to read as a plausible posting for any
 * design role without pretending to be specific to a company we have nothing
 * real about.
 */
function genericJd(company: string, role: string): string {
  return `${company} is hiring a ${role} to work across product surfaces with engineering and product partners. You'll own problems end to end — from framing the question through to what ships — and be expected to show your reasoning, not just the final screens. We're looking for someone with strong systems thinking, comfort working async across time zones, and a track record of shipping work that measurably moved something.`;
}

/** The Vercel listing has a real, specific JD in the mock data — use it verbatim. */
const FEATURED: JobOption = {
  id: "job-vercel-featured",
  company: JD_CONTENT.company,
  role: JD_CONTENT.role,
  salary: JD_CONTENT.salary,
  jdText: JD_CONTENT.jdText,
  highlight: JD_CONTENT.highlight,
  source: "platform",
};

export const PLATFORM_JOBS: JobOption[] = [
  FEATURED,
  ...APPS.filter((a) => a.meta.split("·")[0].trim() !== JD_CONTENT.company).map((a) => {
    const company = a.meta.split("·")[0].trim();
    return {
      id: `job-${a.id}`,
      company,
      role: a.title,
      jdText: genericJd(company, a.title),
      source: "platform" as const,
    };
  }),
];

let seq = 0;

export function createPastedJob(input: { company: string; role: string; jdText?: string; url?: string }): JobOption {
  return {
    id: `job-pasted-${++seq}`,
    company: input.company.trim() || "Untitled company",
    role: input.role.trim() || "Untitled role",
    jdText: input.jdText?.trim() || genericJd(input.company, input.role),
    source: "pasted",
  };
}
