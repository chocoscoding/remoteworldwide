// Password strength, as a pure function.
//
// The score comes from `tai-password-strength`, which estimates entropy from a
// trigraph model of English rather than counting character classes. That
// matters: composition counting rates "Aa1!Aa1!" as good because it ticks every
// box, while the trigraph model reads it at 42 bits — two repeated predictable
// runs. The library also ships ~10k breach-corpus passwords, which is the real
// check the hand-rolled list here was only ever standing in for.
//
// Loaded on demand, never at import time. The trigraph map and password list
// are ~170KB gzipped between them, and Next puts anything statically reachable
// from a client component into a chunk that every public page pulls — a blog
// reader would pay for the signup form. `loadStrengthModel()` fetches them when
// a password field is actually mounted; until it resolves, the rules below
// still gate submission using the short fallback list.
//
// What did NOT move to the library: the checklist and the veto. A bare
// "Weak / Strong" bar tells someone their password is wrong without telling
// them what would make it right, so the rules stay the primary output and the
// level can never contradict them. And the library's own common-password test
// is exact-match, which passes "Password1!" — so the veto normalises before it
// looks, and caps the level regardless of entropy.

import type { PasswordStrengthStatistics } from "tai-password-strength";

export interface PasswordRule {
  id: string;
  /** Present tense, phrased as the thing they'll have done — not a scolding. */
  label: string;
  test: (password: string) => boolean;
  /** Required to submit at all. Non-required rules only strengthen the score. */
  required: boolean;
}

/** Long enough that length alone does most of the work. Matches the backend. */
export const MIN_PASSWORD_LENGTH = 8;

/** Where a password stops being merely acceptable and starts being good. */
const STRONG_LENGTH = 12;

/**
 * Enough of the breach corpus to be useful before the real list arrives, small
 * enough that substring matching is safe — at ten thousand entries it would
 * start rejecting decent passwords for containing "love".
 */
const FALLBACK_COMMON = [
  "password",
  "passw0rd",
  "12345678",
  "123456789",
  "qwerty",
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
  "remoteworldwide",
  "remotework",
];

type StrengthModel = {
  check: (password: string) => PasswordStrengthStatistics;
  common: Set<string>;
};

let model: StrengthModel | null = null;
let pending: Promise<void> | null = null;

export const isStrengthModelReady = (): boolean => model !== null;

/**
 * Pulls in the entropy model and the full breach list. Safe to call on every
 * render: the import is de-duplicated and resolves immediately once loaded.
 * A failure is swallowed — the rules keep working on the fallback list, and a
 * coarser meter is a far better outcome than a signup form that throws.
 */
export function loadStrengthModel(): Promise<void> {
  if (model) return Promise.resolve();
  if (!pending) {
    pending = import("tai-password-strength")
      .then(({ PasswordStrength, commonPasswords, trigraphs }) => {
        const checker = new PasswordStrength();
        checker.addCommonPasswords(commonPasswords);
        checker.addTrigraphMap(trigraphs);
        model = { check: (password) => checker.check(password), common: new Set(commonPasswords) };
      })
      .catch(() => {
        pending = null;
      });
  }
  return pending;
}

// Enough to undo the substitutions people reach for first. "1" is left out: it
// reads as both "i" and "l", and the trailing-digit strip below already catches
// the "password1" shape it usually appears in.
const LEET: Record<string, string> = { "0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

const unleet = (value: string) => value.replace(/[03457@$]/g, (c) => LEET[c]);

/**
 * The forms of a password worth testing against the breach list. Exact match
 * alone passes "password123" and "P@ssw0rd1", which are the two shapes a
 * composition rule actively pushes people toward.
 */
function lookupForms(password: string): string[] {
  const lower = password.toLowerCase();
  const forms = new Set<string>();
  for (const base of [lower, lower.replace(/[^a-z0-9]+$/, "").replace(/\d+$/, "")]) {
    if (base) {
      forms.add(base);
      forms.add(unleet(base));
    }
  }
  return [...forms];
}

function isCommon(password: string): boolean {
  if (model) return lookupForms(password).some((form) => model!.common.has(form));
  const lower = password.toLowerCase();
  return FALLBACK_COMMON.some((entry) => lower.includes(entry));
}

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
    test: (p) => p.length > 0 && !isCommon(p),
    required: true,
  },
];

export type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordStrength {
  level: StrengthLevel;
  /** 0-4, one step per entropy band cleared. */
  score: number;
  /** Entropy in bits, or null until the model has loaded. */
  entropyBits: number | null;
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

// The library's five bands collapsed onto four labels. Both bottom bands read
// as "Weak" because the difference between "minutes to crack" and "a week to
// crack" is not a distinction worth offering as encouragement.
const BANDS: Record<string, { level: StrengthLevel; score: number }> = {
  VERY_WEAK: { level: "weak", score: 0 },
  WEAK: { level: "weak", score: 1 },
  REASONABLE: { level: "fair", score: 2 },
  STRONG: { level: "good", score: 3 },
  VERY_STRONG: { level: "strong", score: 4 },
};

/** Rule-counting, used only in the moment before the entropy model resolves. */
function provisional(passed: string[], password: string): { level: StrengthLevel; score: number } {
  const points = passed.length + (password.length >= STRONG_LENGTH ? 1 : 0);
  const level: StrengthLevel = points >= 6 ? "strong" : points >= 5 ? "good" : "fair";
  return { level, score: Math.min(points - 2, 4) };
}

export function evaluatePassword(password: string): PasswordStrength {
  if (password.length === 0) {
    return { level: "empty", score: 0, entropyBits: null, passed: [], meetsRequirements: false };
  }

  const passed = PASSWORD_RULES.filter((r) => r.test(password)).map((r) => r.id);
  const meetsRequirements = PASSWORD_RULES.every((r) => !r.required || passed.includes(r.id));

  const stats = model?.check(password) ?? null;
  const entropyBits = stats ? (stats.trigraphEntropyBits ?? stats.shannonEntropyBits) : null;
  const band = stats ? BANDS[stats.strengthCode] : null;

  // A password off the breach list is weak however the entropy model reads it:
  // "Password1!" scores REASONABLE and is still the first thing anyone would
  // guess. Same for any failed requirement — the meter must never look better
  // than the checklist under it.
  if (!passed.includes("uncommon") || !meetsRequirements) {
    return { level: "weak", score: Math.min(band?.score ?? 1, 1), entropyBits, passed, meetsRequirements };
  }

  const graded = band ?? provisional(passed, password);
  return { level: graded.level, score: graded.score, entropyBits, passed, meetsRequirements };
}
