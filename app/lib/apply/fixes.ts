// What the resume step's score card says, worked out from the scan (owner's design, 2026-10-19):
// the colour of a score, which check to fix first, how each check moved, the keywords that only
// sit in Skills, what a change newly matched, and the Working list. Pure: tests/apply.test.mjs runs
// it under plain `node --test`.

import type { ChunkSection, CoverageState, RequirementVerdict, ScanReport } from "@/app/lib/ats/types";
import type { ResumeContent } from "@/app/lib/dashboard/types";

export type ScoreHue = "low" | "mid" | "high";

/** The design's bands: red under 50, amber under 70, lime from 70. */
export const scoreHue = (value: number): ScoreHue => (value < 50 ? "low" : value < 70 ? "mid" : "high");

export const HUE_COLOR: Record<ScoreHue, string> = { low: "#e02d2d", mid: "#d99a00", high: "#cddd54" };

export const scoreColorOf = (value: number): string => HUE_COLOR[scoreHue(value)];

export const METRIC_GROUPS: Array<{ title: string; hint: string; ids: string[] }> = [
  { title: "Pass the AI", hint: "what the filter reads", ids: ["keyword-match", "parseability"] },
  { title: "Pass the human", hint: "what the recruiter reads", ids: ["impact-language", "length-format"] },
];

/** The check to fix first: the lowest one, while it is under 65. */
export function fixFirstId(report: Pick<ScanReport, "metrics">): string | null {
  const lowest = [...report.metrics].sort((a, b) => a.value - b.value)[0];
  return lowest && lowest.value < 65 ? lowest.id : null;
}

/** Each check's value, by id, to say how far a change moved it. */
export const metricValues = (report: Pick<ScanReport, "metrics">): Record<string, number> =>
  Object.fromEntries(report.metrics.map((metric) => [metric.id, Math.round(metric.value)]));

const RANK: Record<CoverageState, number> = { missing: 0, undetermined: 0, partial: 1, satisfied: 2 };

const nameOf = (verdict: RequirementVerdict): string => verdict.requirement.label?.trim() || verdict.requirement.text.trim();

const SECTION_NAME: Partial<Record<ChunkSection, string>> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
};

/**
 * A requirement the resume now shows only in its Skills list: matched, but with nothing in a role
 * behind it. The design's amber "only in Skills, needs proof".
 */
export const onlyInSkills = (verdict: RequirementVerdict): boolean =>
  verdict.state !== "missing" &&
  verdict.state !== "undetermined" &&
  verdict.evidence.length > 0 &&
  verdict.evidence.every((evidence) => evidence.section === "skills");

/** The keywords matched only in Skills, by name. */
export const skillsOnlyNames = (report: Pick<ScanReport, "verdicts">): string[] => [...new Set(report.verdicts.filter(onlyInSkills).map(nameOf))];

export interface MatchMove {
  name: string;
  up: boolean;
  /** "Skills", "Experience"…: where the line that shows it is. */
  where: string | null;
  /** The section to point at on the page. */
  section: ChunkSection | null;
  quote: string | null;
}

/** What the last change newly matched (or lost), by the requirements' states before it. */
export function matchMoves(report: Pick<ScanReport, "verdicts">, before: Record<string, CoverageState> | undefined): MatchMove[] {
  if (!before) return [];
  return report.verdicts
    .filter((verdict) => before[verdict.requirement.id] !== undefined && RANK[before[verdict.requirement.id]] !== RANK[verdict.state])
    .map((verdict) => {
      // A line of work first: "Found in Experience" says more than the Skills list it is also in.
      const evidence = verdict.evidence.find((item) => item.section === "experience") ?? verdict.evidence[0];
      const quote = evidence ? (evidence.text.length > 48 ? `${evidence.text.slice(0, 48).trimEnd()}…` : evidence.text) : null;
      return {
        name: nameOf(verdict),
        up: RANK[verdict.state] > RANK[before[verdict.requirement.id]],
        where: evidence ? (SECTION_NAME[evidence.section] ?? null) : null,
        section: evidence?.section ?? null,
        quote,
      };
    });
}

const phraseCount = (haystack: string, phrase: string): number => {
  const escaped = phrase
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "[\\s-]+");
  if (!escaped) return 0;
  return haystack.match(new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "giu"))?.length ?? 0;
};

/**
 * The posting's skills in the Skills list that no role or project mentions: the ones the scorer
 * takes a point off for ("N skills from the posting appear nowhere in your experience"). The same
 * test as the AI service's `stuffingOf` (scoringService.ts), so the note names exactly those.
 */
export function unbackedSkills(content: ResumeContent, report: Pick<ScanReport, "verdicts">): string[] {
  const short = (value: string | undefined): value is string => !!value && value.trim().length >= 3 && value.trim().split(/\s+/).length <= 4;
  const terms = new Set(
    report.verdicts
      .flatMap(({ requirement }) => [requirement.label, requirement.category === "skill" ? requirement.text : undefined])
      .filter(short)
      .map((term) => term.trim().toLowerCase()),
  );
  const proof = [
    ...content.experience.flatMap((role) => role.bullets),
    ...content.projects.map((project) => `${project.name} ${project.detail}`),
  ].join("\n");
  return content.skills.filter((skill) => terms.has(skill.trim().toLowerCase()) && phraseCount(proof, skill) === 0);
}

/** A line with a number in it: what Impact language counts as a result. */
const hasNumber = (line: string): boolean => /\d/.test(line);

/**
 * The bullets with no number, across the roles shown: never a role or a line hidden for this job
 * (owner, 2026-10-19: nothing is done to what is hidden). The text of each, so "Show in resume" can
 * point at them.
 */
export const bareBullets = (content: ResumeContent): string[] => {
  const hidden = new Set(content.hiddenParts ?? []);
  return content.experience
    .filter((entry) => !entry.hidden && !hidden.has(`exp:${entry.id}`))
    .flatMap((entry) => entry.bullets.filter((bullet, index) => bullet.trim() && !hasNumber(bullet) && !hidden.has(`exp:${entry.id}:${index}`)));
};

/** How many bullets have no number (`bareBullets`). */
export const bulletsWithoutResult = (content: ResumeContent): number => bareBullets(content).length;

export interface WorkingItem {
  title: string;
  detail: string;
}

/** The Working tab: what already holds up, each with its number. */
export function workingItems(report: Pick<ScanReport, "metrics" | "verdicts">, content: ResumeContent | null): WorkingItem[] {
  const byId = metricValues(report);
  const items: WorkingItem[] = [];
  if ((byId["parseability"] ?? 0) >= 70)
    items.push({ title: "Reads cleanly.", detail: `An ATS reads it without trouble: parseability ${byId["parseability"]}.` });
  if ((byId["length-format"] ?? 0) >= 70) items.push({ title: "Length works.", detail: `Length & format reads ${byId["length-format"]}.` });
  if (content) {
    const figures = content.experience
      .filter((entry) => !entry.hidden)
      .flatMap((entry) => entry.bullets)
      .filter(hasNumber);
    if (figures.length > 0) {
      const examples = figures
        .map((line) => /\d[\d,.%+]*\s?(%|x|k|m|customers|users|weeks|days|teams)?/i.exec(line)?.[0]?.trim())
        .filter((x): x is string => Boolean(x))
        .slice(0, 3);
      items.push({
        title: `Numbers on ${figures.length} ${figures.length === 1 ? "bullet" : "bullets"}.`,
        detail: examples.length > 0 ? `${examples.join(", ")}: keep those.` : "Keep those.",
      });
    }
  }
  const matched = report.verdicts.filter((verdict) => verdict.state === "satisfied" && !onlyInSkills(verdict)).map(nameOf);
  if (matched.length > 0) {
    const shown = matched.slice(0, 3);
    items.push({
      title: `${matched.length} ${matched.length === 1 ? "keyword matches" : "keywords match"} your experience.`,
      detail: `${shown.join(", ")}${matched.length > shown.length ? ` and ${matched.length - shown.length} more` : ""}.`,
    });
  }
  return items;
}
