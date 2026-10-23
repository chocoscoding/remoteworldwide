/**
 * The open asks the apply step sends as `pending` on every keywords and Tailor call (owner,
 * 2026-10-22, fix plan B). The page already hides a chip an ask names (`askedFor`), but a broader chip
 * ("Analytics tools proficiency") let the AI write in the very tools Tailor had just asked about
 * ("Google Analytics", "Amplitude"). The AI service now holds those terms back while the person
 * answers, and says which in `awaitingAnswer`.
 */

/** The most open asks one call sends: the AI service's own bound (MAX_PENDING in keywordGuard). */
export const MAX_PENDING = 24;
/** And the longest term it takes (the service refuses the call past it). */
const MAX_PENDING_CHARS = 80;

/**
 * The open asks' terms, each once (case and spacing folded), never `answering`: the ask the person
 * just said yes to is the one being written in, so it is no longer waiting.
 */
export function pendingTerms(asks: ReadonlyArray<{ term: string; confirmed?: boolean }>, answering: string | null = null): string[] {
  const key = (term: string) => term.toLowerCase().replace(/\s+/g, " ").trim();
  const skip = answering ? key(answering) : null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ask of asks) {
    if (ask.confirmed) continue;
    const term = (ask.term ?? "").replace(/\s+/g, " ").trim();
    const k = key(term);
    if (!term || term.length > MAX_PENDING_CHARS || k === skip || seen.has(k)) continue;
    seen.add(k);
    out.push(term);
    if (out.length >= MAX_PENDING) break;
  }
  return out;
}

/** The short note for terms the AI held for an open ask: "Answer the question about Google Analytics first." Null for none. */
export function awaitingNote(terms: readonly string[]): string | null {
  const names = [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
  if (names.length === 0) return null;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Answer the ${names.length === 1 ? "question" : "questions"} about ${list} first.`;
}
