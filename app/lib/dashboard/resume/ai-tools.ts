// The AI Tools engine — every tool on the resume screen's AI rail, as pure,
// deterministic transforms over `ResumeContent`. No model call: each function
// derives its output from what the resume already says (plus a job's JD for
// tailoring), so the same input always produces the same edit and the paper
// preview visibly changes the moment a tool runs. A real generation service
// replaces these bodies one-for-one; the signatures are the contract.

import type { ResumeContent } from "../types";

// ---------------------------------------------------------------------------
// Shared text helpers
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  "the and for with you your our their this that from will have has are is we they them able into across more than most very team teams work working role roles looking experience years ideal strong candidate candidates every about".split(" ")
);

/** The N most frequent meaningful words in a JD — crude, deterministic, enough. */
export function topJdKeywords(jdText: string, n = 2): string[] {
  const counts = new Map<string, number>();
  for (const raw of jdText.toLowerCase().split(/[^a-z0-9-]+/)) {
    if (raw.length < 5 || STOPWORDS.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([w]) => w);
}

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

// ---------------------------------------------------------------------------
// 1 · Tailor to a job
// ---------------------------------------------------------------------------

export interface TailorResult {
  content: ResumeContent;
  /** The JD terms woven in — surfaced in the done-caption. */
  woven: string[];
}

export function tailorToJob(content: ResumeContent, job: { company: string; role: string; jdText: string }): TailorResult {
  const woven = topJdKeywords(job.jdText, 2);
  const base = content.summary.trim().replace(/\.$/, "");
  const summary = `${base}. Currently aimed at ${job.role} work — recent projects lean hard on ${woven.join(" and ")}, which is exactly where ${job.company} is going.`;

  const have = new Set(content.skills.map((s) => s.toLowerCase()));
  const skills = [...content.skills, ...woven.filter((w) => !have.has(w))];

  return { content: { ...content, summary, skills }, woven };
}

// ---------------------------------------------------------------------------
// 2 · Rewrite a section (Summary) — three styled takes
// ---------------------------------------------------------------------------

export interface RewriteVariant {
  style: string;
  text: string;
}

export function rewriteVariants(content: ResumeContent): RewriteVariant[] {
  const title = content.title || "Product designer";
  const roles = content.experience.length;
  const firstCompany = content.experience[content.experience.length - 1]?.company;
  const lastCompany = content.experience[0]?.company;
  const skills = content.skills.slice(0, 3).join(", ");
  const firstSentence = content.summary.split(/(?<=\.)\s/)[0] ?? content.summary;

  return [
    {
      style: "Punchy",
      text: `${title} who ships. ${skills} — proven across ${roles} role${roles === 1 ? "" : "s"}, with the receipts in the work below.`,
    },
    {
      style: "Narrative",
      text:
        firstCompany && lastCompany && firstCompany !== lastCompany
          ? `From ${firstCompany} to ${lastCompany}: ${roles} roles spent turning ambiguous product problems into shipped, measured design.`
          : `${firstSentence} Every role below ends with something shipped and a number that moved.`,
    },
    {
      style: "Skills-forward",
      text: `${title} · ${skills}. ${firstSentence}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// 3 · Add missing keywords
// ---------------------------------------------------------------------------

export interface KeywordInjection {
  content: ResumeContent;
  added: string[];
}

export function injectKeywords(content: ResumeContent, wanted: string[]): KeywordInjection {
  const have = new Set(content.skills.map((s) => s.toLowerCase()));
  const inSummary = content.summary.toLowerCase();
  const added = wanted.filter((w) => !have.has(w.toLowerCase()) && !inSummary.includes(w.toLowerCase()));
  if (added.length === 0) return { content, added };

  const summary = `${content.summary.trim().replace(/\.$/, "")}. Hands-on with ${added.join(" and ")} day to day.`;
  return { content: { ...content, summary, skills: [...content.skills, ...added] }, added };
}

// ---------------------------------------------------------------------------
// 4 · Quantify my bullets
// ---------------------------------------------------------------------------

export interface QuantifySuggestion {
  /** Index into `content.experience`. */
  entryIndex: number;
  bulletIndex: number;
  role: string;
  before: string;
  after: string;
}

/** Deterministic quantifiers, rotated by position so repeats don't twin. */
const QUANTIFIERS = [
  "cutting review cycles by ~30%",
  "now used by 4 product teams",
  "saving the team ~6 hours a week",
  "shipped to 12k weekly users",
  "lifting task completion 18%",
];

export function quantifySuggestions(content: ResumeContent): QuantifySuggestion[] {
  const out: QuantifySuggestion[] = [];
  content.experience.forEach((entry, entryIndex) => {
    entry.bullets.forEach((bullet, bulletIndex) => {
      if (/\d/.test(bullet)) return; // already carries a number
      const quantifier = QUANTIFIERS[out.length % QUANTIFIERS.length];
      out.push({
        entryIndex,
        bulletIndex,
        role: entry.role,
        before: bullet,
        after: `${bullet.trim().replace(/\.$/, "")} — ${quantifier}`,
      });
    });
  });
  return out;
}

export function applyQuantify(content: ResumeContent, suggestion: QuantifySuggestion): ResumeContent {
  return {
    ...content,
    experience: content.experience.map((entry, i) =>
      i === suggestion.entryIndex
        ? { ...entry, bullets: entry.bullets.map((b, j) => (j === suggestion.bulletIndex ? suggestion.after : b)) }
        : entry
    ),
  };
}

// ---------------------------------------------------------------------------
// 5 · Shorten to one page
// ---------------------------------------------------------------------------

export interface ShortenResult {
  content: ResumeContent;
  removedWords: number;
  trimmedBullets: number;
}

export function shortenToOnePage(content: ResumeContent): ShortenResult {
  let removedWords = 0;
  let trimmedBullets = 0;

  // Every role keeps its two strongest (first two) bullets.
  const experience = content.experience.map((entry) => {
    if (entry.bullets.length <= 2) return entry;
    const dropped = entry.bullets.slice(2);
    removedWords += dropped.reduce((n, b) => n + countWords(b), 0);
    trimmedBullets += dropped.length;
    return { ...entry, bullets: entry.bullets.slice(0, 2) };
  });

  // Summary tightens to its first two sentences.
  const sentences = content.summary.split(/(?<=\.)\s+/);
  let summary = content.summary;
  if (sentences.length > 2) {
    summary = sentences.slice(0, 2).join(" ");
    removedWords += countWords(content.summary) - countWords(summary);
  }

  return { content: { ...content, experience, summary }, removedWords, trimmedBullets };
}

// ---------------------------------------------------------------------------
// 6 · Fix tone & grammar
// ---------------------------------------------------------------------------

export interface ToneResult {
  content: ResumeContent;
  fixes: string[];
}

const TYPOS: [RegExp, string, string][] = [
  [/\bteh\b/g, "the", 'typo "teh"'],
  [/\brecieve(d?)\b/g, "receive$1", 'typo "recieve"'],
  [/\bseperate\b/g, "separate", 'typo "seperate"'],
  [/\s{2,}/g, " ", "double spaces"],
  [/\bi\b/g, "I", 'lowercase "i"'],
];

function fixText(text: string, fixes: Set<string>): string {
  let out = text;
  for (const [re, repl, label] of TYPOS) {
    if (re.test(out)) {
      out = out.replace(re, repl);
      fixes.add(label);
    }
    re.lastIndex = 0;
  }
  return out;
}

export function fixToneAndGrammar(content: ResumeContent): ToneResult {
  const fixes = new Set<string>();

  const summary = fixText(content.summary, fixes);
  const experience = content.experience.map((entry) => {
    const bullets = entry.bullets.map((b) => {
      let next = fixText(b, fixes);
      // Bullets read as fragments — consistent no-trailing-period style.
      if (/\.$/.test(next)) {
        next = next.replace(/\.$/, "");
        fixes.add("trailing periods on bullets");
      }
      // Sentence-case the first character.
      if (next && next[0] !== next[0].toUpperCase()) {
        next = next[0].toUpperCase() + next.slice(1);
        fixes.add("bullet capitalisation");
      }
      return next;
    });
    return { ...entry, bullets };
  });

  return { content: { ...content, summary, experience }, fixes: [...fixes] };
}
