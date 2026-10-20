// What the resume step's score card says, worked out from the scan (owner's design, 2026-10-19):
// the colour of a score, which check to fix first, how each check moved, the keywords that only
// sit in Skills, what a change newly matched, and the Working list. Pure: tests/apply.test.mjs runs
// it under plain `node --test`.

import type { ChunkSection, CoverageState, RequirementVerdict, ScanReport } from "@/app/lib/ats/types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { ResumePlace } from "@/app/lib/resume/ai";

export type ScoreHue = "low" | "mid" | "high";

/** The design's bands: red under 50, amber under 70, lime from 70. */
export const scoreHue = (value: number): ScoreHue => (value < 50 ? "low" : value < 70 ? "mid" : "high");

export const HUE_COLOR: Record<ScoreHue, string> = { low: "#e02d2d", mid: "#d99a00", high: "#cddd54" };

export const scoreColorOf = (value: number): string => HUE_COLOR[scoreHue(value)];

export const METRIC_GROUPS: Array<{ title: string; ids: string[] }> = [
  { title: "Pass the AI", ids: ["keyword-match", "parseability"] },
  { title: "Pass the human", ids: ["impact-language", "length-format"] },
];

/**
 * Keyword match from which nothing more is asked for (owner, 2026-10-19: "there should be a point
 * where it's like, nothing left to add, move on"). A senior already this close is not shown
 * "Personalized communication" to add.
 */
export const ENOUGH_KEYWORD_MATCH = 90;

/** Impact language under which its row shows; above it, three bullets without a number are no reason to nag. */
export const IMPACT_WORTH_FIXING_BELOW = 80;

/**
 * Whether a requirement the scan did not find in full is worth a chip: one the posting requires,
 * missing outright, or partly shown and weighted 4 or 5. Never a nice-to-have ("Western market
 * experience is a plus"), and never a lighter one the resume already partly shows, which its work
 * answers to anyone reading it.
 */
export const worthAdding = (verdict: Pick<RequirementVerdict, "state" | "requirement">): boolean =>
  verdict.requirement.type !== "preferred" && (verdict.state === "missing" || (verdict.state === "partial" && verdict.requirement.weight >= 4));

/** Letters and digits only, lowercased: "Cross‑functional" with a non-breaking hyphen is "cross functional". */
const fold = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Words a posting's label adds that no resume says ("Agency experience" is "agency"). */
const LABEL_FILLER =
  /\b(?:experience|expertise|skills?|knowledge|proficiency|ability|abilities|background|familiarity|exposure|execution|understanding)\b/g;
const coreOf = (label: string): string => fold(label).replace(LABEL_FILLER, " ").replace(/\s+/g, " ").trim() || fold(label);

/** A plural and its singular are one word, as the AI reads them: "microservices" says "microservice". */
const stemWord = (word: string): string => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);
const wordSet = (folded: string): Set<string> => new Set(folded.split(" ").filter(Boolean).map(stemWord));
/** Words that carry no meaning of a term ("Experience in Employee Support" is "employee support"). */
const LINK_WORDS = new Set(["a", "an", "and", "or", "of", "in", "on", "for", "with", "to", "the", "at", "by", "as"]);
const termWords = (folded: string): string[] => [
  ...new Set(
    folded
      .split(" ")
      .filter((word) => word.length > 1 && !LINK_WORDS.has(word))
      .map(stemWord),
  ),
];

/**
 * A keyword the AI tried and could place nowhere (`ApplyResumeState.worked`), kept as `[TRIED,
 * ...the places it tried]`: asked again in those places it adds nothing either.
 */
export const TRIED = "(tried)";

/**
 * The keywords the AI worked in that are still where it put them (`ApplyResumeState.worked`), by
 * label, lowercased: never offered again as a chip while they stand. A line edited away, or a step
 * undone, brings the chip back. "Skills" is one entry of the list, or one line, that still has every
 * word of it, as the AI reads it already there (50-job run, 2026-10-19: "Senior Product Designer ...
 * design systems" carried "Senior product design experience" for the AI, not for a phrase match, and
 * the chip came back to change nothing; review, 2026-10-19: a raw substring let "AI" or "Go" in Skills
 * stand for "Email marketing" or "Google Ads").
 *
 * One it tried and could place nowhere (`TRIED`) stands only while `places`, where the next run
 * would go, are all places it tried: never once another place is on, and never for Skills alone,
 * which adds it with no AI (review, 2026-10-19: a Bullets-only miss hid the chip for good).
 * `content` is the resume as it is sent, hidden parts out: a term on a hidden line is gone.
 */
export function workedIn(
  worked: ReadonlyArray<{ label: string; lines: string[] }>,
  content: ResumeContent,
  places: readonly ResumePlace[] = [],
): Set<string> {
  const said = [content.summary, ...content.experience.flatMap((entry) => entry.bullets)].filter(Boolean).map(fold);
  const lines = new Set(said);
  // The flat list is what is shown: an entry's sub skills, else its name. A heading over sub skills
  // ("Tools", "Soft Skills") is not a skill of its own. Each one, and each line, by its words.
  const wordsIn = [...content.skills.map(fold).filter(Boolean), ...said].map(wordSet);
  const triedAgain = places.some((place) => place !== "skills");
  const out = new Set<string>();
  for (const term of worked) {
    const core = termWords(coreOf(term.label));
    const stands = term.lines.includes(TRIED)
      ? triedAgain && places.every((place) => term.lines.includes(place))
      : term.lines.some((line) =>
          line === "Skills" ? core.length > 0 && wordsIn.some((words) => core.every((word) => words.has(word))) : lines.has(fold(line)),
        );
    if (stands) out.add(term.label.toLowerCase());
  }
  return out;
}

/**
 * The skills already worked into a line, or tried in Bullets and placed nowhere: no "Prove" chip for
 * them. A term that went into Skills for now was never put in a line, so Skills alone never hides
 * its chip (review, 2026-10-19: a Summary-only run left the term with no chip at all).
 */
export function provedIn(worked: ReadonlyArray<{ label: string; lines: string[] }>, content: ResumeContent): Set<string> {
  const inLines = worked.flatMap((term) => {
    const lines = term.lines.filter((line) => line !== "Skills");
    return lines.length > 0 ? [{ ...term, lines }] : [];
  });
  return workedIn(inLines, content, ["bullets"]);
}

/** Whether the resume already matches enough of the posting that nothing more is suggested for it. */
export const matchesEnough = (report: Pick<ScanReport, "metrics">): boolean => {
  const keyword = report.metrics.find((metric) => metric.id === "keyword-match");
  return typeof keyword?.value === "number" && keyword.checked !== false && keyword.value >= ENOUGH_KEYWORD_MATCH;
};

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

/**
 * Whether a gap is worth a "Missing" chip: worth adding, and not one only Skills shows, which is a
 * proof chip instead (review, 2026-10-19: the same requirement showed as both, and adding it to
 * Skills again changed nothing). A gap with no verdict to read is shown.
 */
export const worthGapChip = (verdict: RequirementVerdict | undefined): boolean =>
  !verdict ||
  (worthAdding(verdict) &&
    !onlyInSkills(verdict) &&
    verdict.requirement.category === "skill" &&
    !TRAIT_LABEL.test(verdict.requirement.label ?? verdict.requirement.text) &&
    // A skill has a short name; a window of a requirement line ("Own go-to-market for everything
    // Flex ships") is a duty or a trait, never a keyword chip (owner, 2026-10-20).
    (verdict.requirement.label ?? verdict.requirement.text).trim().split(/\s+/).length <= MAX_CHIP_WORDS);

/** Words a keyword chip's label may run to. */
const MAX_CHIP_WORDS = 4;

/**
 * A label that names a disposition, not a skill: "Phone comfort" (from "comfortable picking up the
 * phone") went in as a skill and into a bullet as outbound dialing nobody did (owner, 2026-10-20).
 */
const TRAIT_LABEL = /\b(?:comfort\w*|confiden\w*|willing\w*|eager\w*|energy|initiative|instinct\w*|passion\w*|curio\w*|resilien\w*|mindset|attitude|motivat\w*)\b/i;

/**
 * A duty the posting describes ("Own month-end reconciliation") is no keyword to add: worked in as a
 * term it read as stuffing for every model the bake-off tried (judges, 2026-10-19). It gets no chip;
 * "Tailor to this job" reframes the real work that matches it instead (owner, 2026-10-20).
 */
export const fitGap = (verdict: RequirementVerdict | undefined): boolean => !verdict || worthAdding(verdict);

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

/** Whether a text names the language ("English: fluent", "English proficiency"). */
export const namesLanguage = (text: string, language: string): boolean => new RegExp(`\\b${language}\\b`, "i").test(text);

/** A level as the scorer reads one (cascadeService.ts `levelIn`): a CEFR step or the words for one. */
const STATES_LEVEL =
  /\b(?:[abc][12]|native|mother tongue|bilingual|fluent|fluency|proficient|full professional|advanced|professional working|upper[- ]intermediate|intermediate)\b/i;

/** The levels the person picks from, as they go on the resume ("English: fluent (C1)"). */
export const LANGUAGE_LEVELS = ["native", "fluent (C1)", "upper intermediate (B2)"] as const;

/**
 * A language the posting asks for that the resume never states and the scan did not find met (owner,
 * 2026-10-19: a fluent English speaker lost a weight-5 requirement for not writing "English"
 * anywhere). Only one worth adding (`worthAdding`), as the chips are: a nice-to-have ("Spanish is a
 * plus") is never asked for, nor takes the ask from a required one (review, 2026-10-19). Null when
 * there is none.
 */
export function languageAsk(report: Pick<ScanReport, "verdicts">, content: ResumeContent): LanguageAsk | null {
  const named = new RegExp(`\\b(${LANGUAGES})\\b`, "i");
  for (const verdict of report.verdicts) {
    // Not met, or only inferred from other lines ("4.8/5 on onboarding calls" read as English): an ATS looks for the language named.
    if (!worthAdding(verdict)) continue;
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
