// Eleven v3 audio tags ([curious], [short pause]…) are how the engine
// interviewer's lines are VOICED, never what it says: nothing on screen shows
// one. The AI service only ever sends its own small list, and only while the
// engine performs them, but the engine may echo them back in `agent_response`,
// and whether it does is undocumented.
//
// The twin of the AI service's src/lib/audioTags.ts (`AUDIO_TAG_VOCABULARY`,
// `withoutAudioTags`): this repo cannot import that one, so its contract test
// (remoteworldwideai tests/contracts/frontend-audio-tags.test.ts) compiles this
// file and holds the two to the same list and the same results. Change both.
//
// Pure: no browser, no React.

/** Every tag the strip removes: what the interviewer may say, what it never says, and the rest of the vocabulary we know. */
export const AUDIO_TAG_VOCABULARY: readonly string[] = [
  // Said by the interviewer, on a v3 engine only.
  "warmly", "curious", "surprised", "reassuring", "sympathetic", "thoughtful", "chuckles", "short pause", "pause",
  // Never said: they grade, mock, laugh at the candidate, stall or are no voice direction at all.
  "impressed", "excited", "happy", "happily", "delighted", "amazed", "disappointed", "sad",
  "laughs", "laughs harder", "starts laughing", "laughing", "wheezing", "giggles", "giggling", "snorts", "cracking up", "stifling laughter",
  "sarcastic", "mischievously", "deadpan",
  "crying",
  "whispers", "whisper", "shouts", "gasps", "dramatically", "alarmed",
  "sighs", "sigh", "exhales", "exhales sharply", "inhales deeply", "tired", "annoyed", "angry", "appalled", "frustrated", "clears throat",
  "long pause",
  "applause", "clapping", "gunshot", "explosion", "swallows", "gulps", "sings", "woo",
  // Documented or pasted directions the interviewer has no use for.
  "professional", "questioning", "worried", "softly", "awe", "rushed", "drawn out", "slow", "interrupting", "overlapping", "nervously", "sheepishly", "desperately", "excitedly", "curiously",
];

/** No tag is longer; a longer bracket group is text. */
const MAX_TAG_CHARS = 40;

/** Compared without any whitespace, so a tag the echo split mid-word ("[thou" + "ghtful]", joined with a space) still matches. */
const vocabularyKey = (inner: string): string => inner.toLowerCase().replace(/\s+/g, "");
const VOCABULARY_KEYS: ReadonlySet<string> = new Set(AUDIO_TAG_VOCABULARY.map(vocabularyKey));

/** Whitespace around each group comes with it, so the words either side close up to one space. */
const vocabularyGroups = (): RegExp => /[ \t]*\[([^[\]\n]{1,40})\][ \t]*/g;

/**
 * Interviewer text as it is shown: every known audio tag removed, any case or
 * spacing, and nothing else touched ("[Company]" stays). The same string comes
 * back when there was none.
 */
export function withoutAudioTags(text: string): string {
  if (!text.includes("[")) return text;
  let out = text;
  // A tag inside another ("[short [warmly] pause]") is only whole once the inner one is gone.
  for (let pass = 0; pass < 4; pass += 1) {
    let hit = false;
    const next = out.replace(vocabularyGroups(), (group, inner: string) => {
      if (!VOCABULARY_KEYS.has(vocabularyKey(inner))) return group;
      hit = true;
      return " ";
    });
    if (!hit) break;
    out = next
      .replace(/ +([,.!?…;:])/g, "$1")
      .replace(/ {2,}/g, " ")
      .trim();
  }
  return out === text ? text : out;
}

/** Every tail of every tag, whitespace-free: the second half of one, wherever it was cut. */
const TAG_TAILS: ReadonlySet<string> = new Set([...VOCABULARY_KEYS].flatMap((key) => Array.from({ length: key.length }, (_unused, cut) => key.slice(cut))));

/**
 * A line still streaming in, as it is shown: its tags gone, and a tag still
 * arriving at its end ("Hi there. [short") hidden until it closes, so the
 * stage card never flashes half of one. A bracket open for longer than any tag
 * is text, and shows. A line that opens on the second half of a tag ("pause]
 * Tell me…") drops that half too: the candidate spoke between the two halves of
 * one echo, so the first closed the interviewer's previous turn, hidden there.
 */
export function shownInterviewerText(text: string): string {
  let out = withoutAudioTags(text);
  const head = /^\s*([^[\]\n]{1,40})\]\s*/.exec(out);
  if (head && TAG_TAILS.has(vocabularyKey(head[1]))) out = out.slice(head[0].length);
  const open = out.lastIndexOf("[");
  if (open < 0 || open < out.lastIndexOf("]") || out.length - open > MAX_TAG_CHARS + 1) return out;
  return out.slice(0, open).trimEnd();
}
