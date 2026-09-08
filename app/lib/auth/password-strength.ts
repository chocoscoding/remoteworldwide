// Password strength, as a pure function.
//
// Deliberately requirement-led rather than score-led. A bare "Weak / Medium /
// Strong" bar tells someone their password is wrong without telling them what
// would make it right, so the checklist is the primary output and the score is
// derived from it — the meter can never disagree with the list underneath it.
//
// The rules are the ones that actually resist the attacks people face: length
// first (it dominates every other factor against offline cracking), then
// character variety, then a check against the passwords that appear at the top
// of every breach corpus. Composition rules alone are known to push people
// toward "Password1!", which is why length carries the most weight here and
// why the common-password check can veto an otherwise passing password.
//
// No dependency, no network, same input → same output.

export interface PasswordRule {
  id: string;
  /** Present tense, phrased as the thing they'll have done — not a scolding. */
  label: string;
  test: (password: string) => boolean;
  /** Required to submit at all. Non-required rules only strengthen the score. */
  required: boolean;
}

/** Long enough that length alone does most of the work. */
export const MIN_PASSWORD_LENGTH = 8;

/** Where a password stops being merely acceptable and starts being good. */
const STRONG_LENGTH = 12;

/**
 * The handful that dominate breach corpora, plus the ones this product invites
 * by name. Not a substitute for a real breach check — that belongs on the
 * backend against something like Have I Been Pwned's k-anonymity API, and this
 * list is the honest stopgap until then.
 */
const COMMON = [
  "password",
  "passw0rd",
  "12345678",
  "123456789",
  "qwerty",
  "qwerty123",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "abc123",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "remoteworldwide",
  "remotework",
];

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    test: (p) => p.length >= MIN_PASSWORD_LENGTH,
    required: true,
  },
  {
    id: "case",
    label: "Upper and lower case letters",
    test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p),
    required: true,
  },
  {
    id: "number",
    label: "A number",
    test: (p) => /\d/.test(p),
    required: true,
  },
  {
    id: "symbol",
    label: "A symbol, like ! or ?",
    test: (p) => /[^A-Za-z0-9]/.test(p),
    required: false,
  },
  {
    id: "uncommon",
    label: "Not a commonly used password",
    // Substring, not equality: "password123" is no safer than "password".
    test: (p) => p.length > 0 && !COMMON.some((c) => p.toLowerCase().includes(c)),
    required: true,
  },
];

export type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordStrength {
  level: StrengthLevel;
  /** 0-4, for the segmented meter. */
  score: number;
  /** Rule ids currently satisfied. */
  passed: string[];
  /** True when every `required` rule passes — the gate on submitting. */
  meetsRequirements: boolean;
}

export const STRENGTH_LABEL: Record<StrengthLevel, string> = {
  empty: "",
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

export function evaluatePassword(password: string): PasswordStrength {
  if (password.length === 0) {
    return { level: "empty", score: 0, passed: [], meetsRequirements: false };
  }

  const passed = PASSWORD_RULES.filter((r) => r.test(password)).map((r) => r.id);
  const meetsRequirements = PASSWORD_RULES.every((r) => !r.required || passed.includes(r.id));

  // Every rule is worth a point, and real length is worth one more — 16
  // characters of plain lowercase beats 8 characters of punctuation soup, and
  // a score that said otherwise would be teaching the wrong lesson.
  let score = passed.length;
  if (password.length >= STRONG_LENGTH) score += 1;

  // A common password is capped regardless of what else it satisfies:
  // "Password1!" clears length, case, number and symbol and is still the first
  // thing anyone would guess.
  if (!passed.includes("uncommon")) {
    return { level: "weak", score: Math.min(score, 1), passed, meetsRequirements };
  }

  const level: StrengthLevel = !meetsRequirements ? "weak" : score >= 6 ? "strong" : score >= 5 ? "good" : "fair";
  return { level, score: Math.min(score, 6), passed, meetsRequirements };
}
