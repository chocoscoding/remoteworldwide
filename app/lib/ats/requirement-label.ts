/**
 * A requirement's short label, made from the posting's sentence when no model label fits.
 * Byte for byte with the website's app/lib/ats/requirement-label.ts, so the chips the site builds
 * itself read the same as the ones the scan sends.
 *
 * Owner, 2026-11-27: "Understanding of and experience with key technology concepts, such as SaaS
 * and APIs" was labelled "And experience with key technology concepts, such as SaaS", and
 * "Experience working with, or for, both large and small companies" lost "companies". The opener
 * was trimmed only up to its first "of", and a 60-character cut fell inside the phrase.
 */

const LEAD = "(?:(?:proven|demonstrated|strong|solid|excellent|deep|hands[-\\s]?on|extensive|prior|relevant|working)\\s+)*";
const NOUN = "(?:experience|expertise|proficiency|proficient|knowledge|familiarity|background|ability|understanding)(?:\\s+working)?";
const PREP = "(?:with|in|of|using|across|building|developing|to|for)";
const PREPS = `${PREP}(?:\\s*,?\\s+(?:and|or)\\s+${PREP})*,?`;

/** "Proven experience with", "Understanding of and experience with", "Knowledge and experience in", "Experience working with, or for,". */
const OPENER = new RegExp(`^(?:${LEAD}${NOUN}(?:\\s+${PREPS})?\\s*,?\\s+(?:and|or)\\s+)*${LEAD}${NOUN}\\s+${PREPS}\\s+`, "i");

/** What is left of an opener this does not know ("Experience in and passion for ..."): keep the sentence whole. */
const LEFTOVER = /^(?:and|or|but|plus|nor|with|in|of|for|to)\b/i;

/**
 * The keyword route's ceiling on one term, which every label is sent as. A label stays whole up to
 * it, past a chip's 60 characters: a longer label beats one that says something else.
 */
export const LABEL_CEILING = 80;

/** Words a cut must never end on ("... such as", "... large and"). */
const DANGLING = /(?:[\s,;:(]+(?:and|or|of|with|in|for|to|the|a|an|both|such as|including|like|e\.g\.))+[\s,;:(]*$|[\s,;:(]+$/i;

const fit = (label: string): string => {
  if (label.length <= LABEL_CEILING) return label;
  const hard = label.slice(0, LABEL_CEILING + 1);
  // A clause break first, so what is kept is a whole phrase; a word break only when there is none.
  const clause = Math.max(hard.lastIndexOf(", "), hard.lastIndexOf("; "), hard.lastIndexOf(" ("));
  const at = clause >= 20 ? clause : hard.lastIndexOf(" ");
  return (at > 0 ? hard.slice(0, at) : label.slice(0, LABEL_CEILING)).replace(DANGLING, "").trim();
};

/** How a posting marks a line optional ("Good to have: Chinese language skills"): the type says it, the label need not. */
const OPTIONAL = /^(?:(?:good|nice)[\s-]to[\s-]have|bonus(?: points)?|plus|preferred|optional)\s*[:–—-]\s*/i;

export function requirementLabel(text: string): string {
  const sentence = text.replace(/\s+/g, " ").trim().replace(OPTIONAL, "");
  const stripped = sentence.replace(OPENER, "");
  const subject = (stripped && !LEFTOVER.test(stripped) ? stripped : sentence)
    // "both large and small companies" names the same thing as "large and small companies".
    .replace(/^both\s+(?=\S[^,]*\s(?:and|&)\s)/i, "")
    .replace(/[.;:,]+$/, "")
    .trim();
  return fit(subject || sentence);
}
