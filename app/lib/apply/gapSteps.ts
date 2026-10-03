// What to do about one gap the ATS score found: shown on a "Missing from your
// resume" chip's hover card and in the picked gaps' summary (owner, 2026-10-03).
//
// Written from the scan's own verdict, never by a model: the requirement, how
// it was judged (missing, or only partly covered), its category, and the line
// of the resume that came closest. That keeps them free (the owner asked for
// scoring to stay cheap).
//
// Short by design (owner: "so much information ... your eyes are going
// everywhere"): each step is a few words for a pill with one sentence of how
// behind it, and the closest line is cut to the one sentence of it that shares
// the most with the requirement.
//
// They say what to do, not whether to (owner: "our company does not stand for
// telling the user what they want or what they don't want"). When nothing on
// the resume comes close, the one extra line is advice: be ready to back it up
// in an interview.
//
// A chip's label is the requirement cut to 60 characters, so a long one is
// called "it" rather than quoted half-finished, and only a short skill name is
// ever suggested for the Skills list. No em dashes in any of it (owner).
//
// Pure and type-only in its imports, for tests/apply.test.mjs.

import type { RequirementVerdict } from "@/app/lib/ats/types";

export interface GapAction {
  /** A few words, for a pill. */
  label: string;
  /** One sentence on how, shown when the pill is opened. */
  how: string;
}

export interface GapSteps {
  /** The requirement as the posting put it. */
  requirement: string;
  weight: "Required" | "Nice to have";
  status: "missing" | "partial";
  /** The resume's closest line when it partly covers this, cut to its most relevant sentence: where to start. */
  closest: { text: string; role: string | null } | null;
  actions: GapAction[];
  /** Nothing on the resume comes close: be ready to speak to it. Null when something does. */
  advice: string | null;
}

/** Short enough to read as a skill name ("Docker", "GraphQL APIs"), not a sentence from the posting. */
const isSkillName = (label: string) => label.length <= 32 && label.split(/\s+/).length <= 4;

export const INTERVIEW_ADVICE = "Nothing in your resume or profile backs this up yet, so make sure you can back it up in an interview.";
/** The advice, short enough for a pill. */
export const INTERVIEW_ADVICE_LABEL = "Be ready to back it up in an interview";

/** The longest a closest-line excerpt runs, in characters. */
const MAX_EXCERPT = 180;

/** Words too common in postings and resumes to say which sentence is about the requirement. */
const COMMON = new Set([
  "ability", "about", "across", "applicable", "building", "experience", "from", "have", "including", "into", "other",
  "skills", "strong", "that", "their", "them", "they", "this", "using", "where", "which", "while", "with", "within",
  "work", "working", "your",
]);

const termsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(" ")
    .filter((word) => word.length >= 4 && !COMMON.has(word));

/**
 * The sentence of a closest line that shares the most words with the requirement, cut at a word to
 * MAX_EXCERPT. A resume's summary arrives as one long chunk, and quoting it whole buried the point.
 */
export function excerpt(text: string, requirement: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/).filter(Boolean);
  const wanted = new Set(termsOf(requirement));
  let best = sentences[0] ?? clean;
  let bestShared = -1;
  for (const sentence of sentences) {
    const shared = new Set(termsOf(sentence).filter((word) => wanted.has(word))).size;
    if (shared > bestShared) {
      best = sentence;
      bestShared = shared;
    }
  }
  if (best.length <= MAX_EXCERPT) return best;
  const cut = best.slice(0, MAX_EXCERPT);
  const space = cut.lastIndexOf(" ");
  return `${(space > MAX_EXCERPT * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, "")}…`;
}

const POSTING_WORDS: GapAction = { label: "Use the posting's words", how: "Scanners match words, not meaning, so copy the posting's wording." };

export function stepsForGap(verdict: RequirementVerdict, label: string): GapSteps {
  const { requirement } = verdict;
  const status = verdict.state === "partial" ? "partial" : "missing";
  const best = [...verdict.evidence].sort((a, b) => b.score - a.score)[0];
  const closest = status === "partial" && best ? { text: excerpt(best.text, requirement.text), role: best.role } : null;
  const skill = isSkillName(label);
  const named = skill ? `“${label}”` : "it";

  const actions: GapAction[] = [];
  switch (requirement.category) {
    case "skill":
      actions.push(
        closest
          ? { label: "Name it in that line", how: `Say ${named} outright in that line, in the posting's words, so a scanner finds it.` }
          : { label: "Add a bullet", how: `Under your most relevant role, show ${named}: what you built with it, and what came of it.` },
      );
      if (skill) actions.push({ label: "Add it to Skills", how: `Add ${named} to your Skills list.` });
      actions.push(POSTING_WORDS);
      break;
    case "education":
      actions.push({ label: "Add it under Education", how: "The degree or course, the school, and the year." });
      actions.push({ label: "List related courses", how: "Any related course or certification beside it, and what it taught you." });
      break;
    case "responsibility":
      actions.push(
        closest
          ? { label: "Reword that line", how: "Say plainly what you were responsible for, and what changed because of you." }
          : { label: "Add a bullet", how: "About owning this: what you did, and what changed because of it." },
      );
      actions.push(POSTING_WORDS);
      break;
    default:
      // "experience", and anything a newer scorer adds.
      actions.push(
        closest
          ? { label: "Build on that line", how: `Say ${named} outright, with the scale and the result.` }
          : { label: "Add a bullet", how: "Under your most relevant role: the situation, what you did, and the outcome." },
      );
      actions.push({ label: "Add a number", how: "The size of the system, the time saved, or a percentage." });
      actions.push({ label: "Mention it in your summary", how: "A phrase about it in your summary as well." });
      break;
  }

  return {
    requirement: requirement.text,
    weight: requirement.type === "required" ? "Required" : "Nice to have",
    status,
    closest,
    actions,
    advice: closest ? null : INTERVIEW_ADVICE,
  };
}
