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

/** The checks the scan could measure, with their numbers: one it could not ("not checked") is never 0. */
const measured = (report: Pick<ScanReport, "metrics">): Array<{ id: string; value: number }> =>
  report.metrics.flatMap((metric) => (metric.checked === false || metric.value === null ? [] : [{ id: metric.id, value: metric.value }]));

/** The check to fix first: the lowest one measured, while it is under 65. */
export function fixFirstId(report: Pick<ScanReport, "metrics">): string | null {
  const lowest = measured(report).sort((a, b) => a.value - b.value)[0];
  return lowest && lowest.value < 65 ? lowest.id : null;
}

/** Each measured check's value, by id, to say how far a change moved it. */
export const metricValues = (report: Pick<ScanReport, "metrics">): Record<string, number> =>
  Object.fromEntries(measured(report).map((metric) => [metric.id, Math.round(metric.value)]));

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
  // A language belongs in Skills ("English: fluent (C1)"): it needs no line of work to prove it.
  !/\b(?:english|spanish|french|german|portuguese|italian|dutch|arabic|mandarin|chinese|japanese|korean|russian|ukrainian|polish|turkish|hindi)\b/i.test(
    `${verdict.requirement.label ?? ""} ${verdict.requirement.text}`,
  ) &&
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

// ---- Keep what proves a requirement --------------------------------------------------------------

/** Words too common to tell one requirement from another. */
const COMMON = new Set(
  "the and for with from that this your you our are was were has have had into over across their them they its per via all any each more most other such than then very able will can".split(
    " ",
  ),
);

/** A line's meaning words, lowercased: letters and digits, three characters or more, common words out. */
const meaningWords = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 2 && !COMMON.has(word)),
  );

/** The same line, compared loosely: case, spacing and trailing full stops do not make two lines different. */
const sameLine = (a: string, b: string): boolean => {
  const norm = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.\s]+$/, "")
      .trim();
  return norm(a) === norm(b) || (norm(b).length > 20 && norm(a).includes(norm(b)));
};

/**
 * The words in a line that show this requirement: those it shares with the requirement's label, its
 * text and its proof terms. What a rewrite of the line has to keep for it to still prove it.
 */
const provingWords = (line: string, verdict: RequirementVerdict): string[] => {
  const asked = meaningWords([verdict.requirement.label ?? "", verdict.requirement.text, ...(verdict.requirement.proof ?? [])].join(" "));
  return [...meaningWords(line)].filter((word) => asked.has(word));
};

export interface KeptProof {
  content: ResumeContent;
  /** The requirements whose proving lines were put back, by name. */
  kept: string[];
}

/**
 * No AI change may remove what proves a requirement (owner, 2026-10-19: a rewrite took "copywriting"
 * and "English" off the resume, and the score went from 61 to 45). Every line the scan quotes as
 * evidence for a met or partly met requirement, which the change rewrote so it no longer carries at
 * least half of the words that showed it, goes back to how it was. Everything else in the change stays.
 */
export function keepProof(before: ResumeContent, after: ResumeContent, report: Pick<ScanReport, "verdicts">): KeptProof {
  let content = after;
  const kept = new Set<string>();
  const lost = (was: string, now: string, verdict: RequirementVerdict): boolean => {
    if (sameLine(now, was)) return false;
    const proving = provingWords(was, verdict);
    if (proving.length === 0) return false;
    const words = meaningWords(now);
    return proving.filter((word) => words.has(word)).length * 2 < proving.length;
  };

  for (const verdict of report.verdicts) {
    if (verdict.state !== "satisfied" && verdict.state !== "partial") continue;
    // The line the scan leans on most, never every line it quotes: "inside the platform" read as
    // proof of Zendesk, already met in Skills, put back a picked keyword's line (owner, 2026-10-19).
    for (const evidence of verdict.evidence.slice(0, 1)) {
      if (
        evidence.section === "summary" &&
        before.summary &&
        sameLine(before.summary, evidence.text) &&
        lost(before.summary, content.summary, verdict)
      ) {
        content = { ...content, summary: before.summary };
        kept.add(nameOf(verdict));
      }
      if (evidence.section === "experience") {
        for (const entry of before.experience) {
          entry.bullets.forEach((bullet, index) => {
            if (!sameLine(bullet, evidence.text)) return;
            const now = content.experience.find((e) => e.id === entry.id);
            if (!now || index >= now.bullets.length || !lost(bullet, now.bullets[index], verdict)) return;
            content = {
              ...content,
              experience: content.experience.map((e) =>
                e.id === entry.id ? { ...e, bullets: e.bullets.map((b, i) => (i === index ? bullet : b)) } : e,
              ),
            };
            kept.add(nameOf(verdict));
          });
        }
      }
      if (evidence.section === "projects") {
        before.projects.forEach((project, index) => {
          const now = content.projects[index];
          if (!now || (!sameLine(`${project.name} ${project.detail}`, evidence.text) && !sameLine(project.detail, evidence.text))) return;
          if (!lost(project.detail, now.detail, verdict)) return;
          content = { ...content, projects: content.projects.map((p, i) => (i === index ? { ...p, detail: project.detail } : p)) };
          kept.add(nameOf(verdict));
        });
      }
    }
  }
  return { content, kept: [...kept] };
}

// ---- A language level the posting asks for -------------------------------------------------------

const LANGUAGES =
  "English|Spanish|French|German|Portuguese|Italian|Dutch|Arabic|Mandarin|Chinese|Japanese|Korean|Russian|Ukrainian|Polish|Turkish|Hindi|Swedish|Norwegian|Danish|Finnish|Czech|Romanian|Greek|Hebrew";

export interface LanguageAsk {
  /** "English". */
  language: string;
  /** The level the posting names ("B2"), when it names one. */
  level: string | null;
}

/**
 * A language the posting asks for that the resume never states and the scan did not find met (owner,
 * 2026-10-19: a fluent English speaker lost a weight-5 requirement for not writing "English"
 * anywhere). Null when there is none.
 */
/** Whether a text names the language ("English: fluent", "English proficiency"). */
export const namesLanguage = (text: string, language: string): boolean => new RegExp(`\\b${language}\\b`, "i").test(text);

/** A level as the scorer reads one (cascadeService.ts `levelIn`): a CEFR step or the words for one. */
const STATES_LEVEL =
  /\b(?:[abc][12]|native|mother tongue|bilingual|fluent|fluency|proficient|full professional|advanced|professional working|upper[- ]intermediate|intermediate)\b/i;

/** The levels the person picks from, as they go on the resume ("English: fluent (C1)"). */
export const LANGUAGE_LEVELS = ["native", "fluent (C1)", "upper intermediate (B2)"] as const;

export function languageAsk(report: Pick<ScanReport, "verdicts">, content: ResumeContent): LanguageAsk | null {
  const named = new RegExp(`\\b(${LANGUAGES})\\b`, "i");
  for (const verdict of report.verdicts) {
    // Not met, or only inferred from other lines ("4.8/5 on onboarding calls" read as English): an ATS looks for the language named.
    if (verdict.state === "satisfied") continue;
    const said = `${verdict.requirement.label ?? ""} ${verdict.requirement.text}`;
    const match = named.exec(said);
    if (!match) continue;
    const language = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
    // Named with a level, as the scorer reads it ("English: fluent (C1)"). A bare "English" counts for
    // nothing there, so the level is still asked for (owner, 2026-10-19: the keyword tool had added one).
    const onResume = [...content.skills, ...(content.skillGroups ?? []).flatMap((group) => [group.title, ...group.skills])].some(
      (skill) => namesLanguage(skill, language) && STATES_LEVEL.test(skill),
    );
    if (onResume) continue;
    const level = /\b([ABC][12])\b/.exec(verdict.requirement.text)?.[1] ?? null;
    return { language, level };
  }
  return null;
}
