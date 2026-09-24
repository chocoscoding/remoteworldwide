// When a spoken interview answer is over, and the interview can move on.
//
// An interview answer is not chat dictation. It often opens with a stall ("um,
// let me think of a good one for that"), goes quiet while the candidate finds
// the story, and then runs for a minute or more with pauses in the middle of
// thoughts. The rule this replaces was a dictation rule — any text at all, then
// two seconds of quiet — and it took "um" plus a thinking pause as the whole
// answer and asked the next question over the candidate.
//
// So the silence that ends a turn depends on how much answer there is, and on
// whether the last thing said left a sentence open. Filler and stall phrases
// alone are not an answer and never end the turn; a few words get a long
// window; a sentence left hanging ("…and the first thing I did was") gets a
// long one too, however much came before it; only an answer plainly under way
// and at a full stop gets the shortest. `null` from the quiet functions means
// "not an answer yet": only the Next button (the manual fallback) ends the turn.
//
// Both of PrepLive's auto-send loops call this, so the unsaved (dictated) and
// recorded paths cannot drift apart again — they did when each had its own
// copy of the rule. No imports, so a scratch script can load it under Node's
// type stripping.
//
// The numbers are margins chosen over fixtures.ts's delivery model, not
// measurements: fixtures.ts is hand-written UI data (118-172 wpm, thinking
// lead-ins up to 4.2 s, pauses mid-answer up to 1.6 s, 3 s of trailing silence
// read as "the answer is over"), and nothing here has timed real candidates.
// So every window is set well past it, on the side of waiting: an answer cut
// off is the bug this file exists for, and a finished answer that waits a few
// seconds longer is what Next is for.

/**
 * Hesitation sounds. Never an answer, never a word of one, and never what a
 * sentence stops on — a trailing "um" leaves the sentence as open as it was.
 */
const HESITATIONS: ReadonlySet<string> = new Set(["um", "umm", "uh", "uhh", "uhm", "erm", "er", "ah", "eh", "oh", "hmm", "hm", "mm", "mmm", "mhm"]);

/**
 * Tokens that carry no answer on their own. Wider than the scoring's filler
 * regex on purpose: that one asks "how polished was this", this one asks "is
 * this an answer at all", and a longer list only makes the rule more patient.
 * Dropping "so" from "so I rebuilt the pipeline" still leaves four words.
 */
export const FILLER_WORDS: ReadonlySet<string> = new Set([...HESITATIONS, "so", "like", "well", "anyway", "basically", "actually"]);

/**
 * Filler inside an answer, but a whole answer on their own: "Yeah." is a
 * complete reply to "would you accept on the spot?". Counted as one word when
 * nothing else was said — hesitations aside — and no stall phrase went with
 * them, so "Yeah." ends on the long window while "yeah, let me think" still
 * waits for the answer it announces.
 */
const ASSENT_WORDS: ReadonlySet<string> = new Set(["yeah", "yep", "yup", "yea", "okay", "ok", "alright", "right"]);

/**
 * Stall phrases, removed as whole runs of tokens. These are what people say
 * right before thinking in silence — the exact moment the old rule cut them
 * off — and none of their words is filler on its own. A stall is rarely just
 * its core ("let me think"): it trails into "about that", "for a second", "of
 * a good one", and each leftover used to count as answer, which put
 * "Hmm, that's a good question, let me think about that for a second" at seven
 * words and moved on after the silence that followed it. So the list carries
 * the long forms and the tails that outlive a shorter match. Longest first
 * (below), so the long form goes whole before its core can leave the tail.
 * Stripping one of these out of a real answer costs it a word or three, which
 * only makes the rule more patient.
 */
export const FILLER_PHRASES: readonly string[] = [
  // Mid-answer filler.
  "you know",
  "i mean",
  "i guess",
  "sort of",
  "kind of",
  // Buying time.
  "let me think",
  "let me think about that",
  "let me think about it",
  "let me think about this",
  "let me think back",
  "let me think of a good one",
  "let me think of a good example",
  "let me think of an example",
  "let me think of one",
  "let me just think",
  "let me see",
  "let's see",
  "let me remember",
  "let me recall",
  "i need to think",
  "i have to think",
  "i'd have to think",
  "i'm trying to think",
  "i'm trying to remember",
  "thinking about it",
  "think about that",
  "think about it",
  "to think about that",
  "to think about it",
  "think back",
  "hold on",
  "hang on",
  "give me a second",
  "give me a sec",
  "give me a moment",
  "give me a minute",
  "one second",
  "one sec",
  "one moment",
  "just a second",
  "just a sec",
  "just a moment",
  "for a second",
  "for a sec",
  "for a moment",
  "for a minute",
  "where do i start",
  "where do i begin",
  "where to start",
  "how do i put this",
  "how should i put this",
  // Rating the question.
  "good question",
  "great question",
  "interesting question",
  "tough question",
  "hard question",
  "that's a good question",
  "that's a great question",
  "that's an interesting question",
  "that's a tough question",
  "that's a hard question",
  "that's a good one",
  "that's a great one",
  "that's a tough one",
  "that's a hard one",
  "good one",
  "tough one",
  "that's interesting",
];

/**
 * Where the long window ends. A stall sentence is nine content words or fewer
 * even when the list above misses part of it (fixtures.ts's own "Um, let me
 * think of a good one for that" is two), and ten words is 3.5-4.6 s of speech
 * at the fixtures' pace, past the opening claim of every modelled answer. A
 * genuinely short answer ("around 120 base") waits the long window or takes a
 * press: too high costs seconds, too low cuts the answer off, and the second is
 * the bug.
 */
export const FIRM_ANSWER_WORDS = 10;
/** Where the window is shortest: one complete beat of a STAR answer (the fixtures' beats are 26-37 words). */
export const SETTLED_ANSWER_WORDS = 25;

/**
 * Silence that ends a turn of 1-9 content words. What lands here is almost
 * always the opening of an answer, or a stall the list above did not catch,
 * followed by the candidate thinking — so it is set for thinking, not for
 * pausing: nearly 3x the longest modelled lead-in (4.2 s). Any sound resets it,
 * so this is twelve seconds of total silence. A real one-liner waits it out or
 * takes a press of Next.
 */
export const QUIET_AFTER_BRIEF_MS = 12_000;
/**
 * An answer under way whose last word leaves the sentence open ("…five percent
 * of users and"). The browser's recognition finalises at pauses, so the draft's
 * last word is where the candidate stopped, and stopping there is stopping to
 * find the rest — the metric, the name, the next step — however long the answer
 * already is. 5x the longest modelled mid-answer pause.
 */
export const QUIET_AFTER_OPEN_MS = 8_000;
/** 10-24 content words at a full stop: 4x the longest modelled mid-answer pause (1.6 s). */
export const QUIET_AFTER_ANSWER_MS = 6_500;
/**
 * 25 or more at a full stop. Not the fixtures' 3 s TRAILING_BASE_MS, which
 * described a finished answer: a candidate ten seconds into a story stops for
 * longer than that to recall a number, and at 3 s the story went as the answer
 * and its second half landed in the next one.
 */
export const QUIET_AFTER_LONG_ANSWER_MS = 5_000;

// The same tiers for a recorded turn the captions caught nothing of, in time
// spoken rather than words: ten words is about 4.1 s and twenty-five about
// 10.3 s at the fixtures' ~145 wpm median. The floor sits above an "um" (about
// 0.5 s voiced at the slowest modelled pace) and "um, let me think" (about 1.2 s).
export const VOICED_FLOOR_MS = 1_500;
export const VOICED_FIRM_MS = 4_000;
export const VOICED_SETTLED_MS = 10_000;

/**
 * Words a finished sentence does not stop on: conjunctions, articles, the
 * prepositions and verbs that need what comes next, subject pronouns. Kept to
 * the words that almost never end a sentence in speech; the ones that often do
 * ("in", "on", "about", "can", "then", "though") are left out, because a false
 * "open" costs a finished answer a longer wait and nothing else.
 */
const OPEN_ENDINGS: ReadonlySet<string> = new Set([
  "and",
  "but",
  "or",
  "nor",
  "so",
  "because",
  "cause",
  "although",
  "whereas",
  "unless",
  "until",
  "if",
  "when",
  "whenever",
  "where",
  "while",
  "which",
  "who",
  "whose",
  "that",
  "than",
  "the",
  "a",
  "an",
  "to",
  "of",
  "for",
  "from",
  "with",
  "into",
  "onto",
  "by",
  "as",
  "like",
  "was",
  "were",
  "is",
  "my",
  "our",
  "their",
  "his",
  "your",
  "its",
  "i",
  "we",
  "they",
  "he",
  "she",
  "i'm",
  "i've",
  "we're",
  "we've",
  "they're",
  "it's",
  "that's",
  "there's",
  "also",
  "plus",
]);

/** Lower case, straight apostrophes, hyphenated words split ("follow-up" is two), everything else but letters and digits gone. */
function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/-/g, " ")
    .replace(/[^a-z0-9'\s]/g, "")
    .split(/\s+/)
    .filter((token) => token !== "" && token !== "'");
}

// Longest first: see FILLER_PHRASES.
const PHRASE_TOKENS: readonly (readonly string[])[] = FILLER_PHRASES.map((phrase) => phrase.split(" ")).sort((a, b) => b.length - a.length);

/** Removes every run of `phrase` from `tokens`. True when anything went. */
function stripPhrase(tokens: string[], phrase: readonly string[]): boolean {
  let removed = false;
  for (let i = 0; i + phrase.length <= tokens.length; ) {
    if (phrase.every((word, k) => tokens[i + k] === word)) {
      tokens.splice(i, phrase.length);
      removed = true;
    } else {
      i += 1;
    }
  }
  return removed;
}

/**
 * How many words in `text` are answer rather than filler. Contractions stay one
 * word ("that's"). Single fillers go first, so a stall phrase with one inside
 * it ("you, um, know") still goes whole — no stall phrase contains a filler
 * word, so this only ever removes more — and the phrases are stripped until
 * nothing changes. A lone assent ("Yeah.") is one word: see ASSENT_WORDS.
 */
export function contentWords(text: string): number {
  const all = tokensOf(text);
  const tokens = all.filter((token) => !FILLER_WORDS.has(token) && !ASSENT_WORDS.has(token));
  let stalled = false;
  let changed = true;
  while (changed) {
    changed = false;
    for (const phrase of PHRASE_TOKENS) {
      if (stripPhrase(tokens, phrase)) {
        changed = true;
        stalled = true;
      }
    }
  }
  if (tokens.length > 0) return tokens.length;
  return !stalled && all.some((token) => ASSENT_WORDS.has(token)) ? 1 : 0;
}

/** The draft stops mid-sentence: its last word, hesitations aside, is one a finished sentence does not end on. */
export function endsOpen(text: string): boolean {
  const tokens = tokensOf(text).filter((token) => !HESITATIONS.has(token));
  const last = tokens[tokens.length - 1];
  return last !== undefined && OPEN_ENDINGS.has(last);
}

/**
 * The silence that ends a turn holding `words` content words; null while there
 * are none. `open`: the draft stops mid-sentence (endsOpen), which never gets
 * less than QUIET_AFTER_OPEN_MS.
 */
export function quietForWords(words: number, open = false): number | null {
  if (!(words > 0)) return null;
  if (words < FIRM_ANSWER_WORDS) return QUIET_AFTER_BRIEF_MS;
  if (open) return QUIET_AFTER_OPEN_MS;
  if (words < SETTLED_ANSWER_WORDS) return QUIET_AFTER_ANSWER_MS;
  return QUIET_AFTER_LONG_ANSWER_MS;
}

/**
 * The silence that ends a recorded turn with no usable text, from how long the
 * candidate has been audibly speaking; null while that is too little to be an
 * answer. The recording is the answer there, so sound is all there is to go on.
 */
export function quietForVoice(voicedMs: number): number | null {
  if (!(voicedMs >= VOICED_FLOOR_MS)) return null;
  if (voicedMs < VOICED_FIRM_MS) return QUIET_AFTER_BRIEF_MS;
  if (voicedMs < VOICED_SETTLED_MS) return QUIET_AFTER_ANSWER_MS;
  return QUIET_AFTER_LONG_ANSWER_MS;
}

// ---------------------------------------------------------------------------
// The interviewer, heard through the speakers
// ---------------------------------------------------------------------------

/** Spoken numbers as the recognizer writes them: it hears "ten times" and writes "10 times". */
const NUMBER_WORDS: Readonly<Record<string, string>> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  hundred: "100",
  thousand: "1000",
};

/**
 * One spelling for what the question says and what the recognizer heard of it.
 * The question is written text — commas, hyphens, "ten", "What's" — and the
 * recognizer's output is none of those, so a plain substring test missed the
 * question read back word for word whenever it had any of them.
 */
function spokenTokens(text: string): string[] {
  return tokensOf(
    text
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/\bwon't\b/g, "will not")
      .replace(/\bcan't\b/g, "can not")
      .replace(/n't\b/g, " not")
      .replace(/'re\b/g, " are")
      .replace(/'m\b/g, " am")
      .replace(/'ve\b/g, " have")
      .replace(/'ll\b/g, " will")
      .replace(/'d\b/g, " would")
      .replace(/'s\b/g, " is"),
  )
    .map((token) => NUMBER_WORDS[token] ?? token.replace(/'/g, ""))
    .filter((token) => token !== "" && !HESITATIONS.has(token));
}

/**
 * `said` is nothing but a stretch of `question`, in order: the interviewer's
 * words picked up by the mic and finalised as if they were the candidate's.
 * Any length — "and why" is two words of the question and no answer. Both
 * sides are spelled the same way first (spokenTokens), and hesitations are
 * dropped from both, so a "hmm" caught in the same result does not hide it.
 */
export function echoesQuestion(said: string, question: string): boolean {
  const heard = spokenTokens(said);
  if (heard.length === 0) return false;
  const asked = spokenTokens(question);
  for (let i = 0; i + heard.length <= asked.length; i++) {
    if (heard.every((token, k) => asked[i + k] === token)) return true;
  }
  return false;
}
