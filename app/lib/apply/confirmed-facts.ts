import type { FitAsk } from './state';
import type { ResumeContent } from '../dashboard/types';
import type { KeywordInjection } from '../dashboard/resume/ai-tools';

const key = (text: string): string => text.trim().toLowerCase();

/** Questions belong to the application, not the rewrite that discovered them. */
export function openConfirmedAsks(asks: readonly FitAsk[], standing: ReadonlySet<string>): FitAsk[] {
  return asks.filter(ask => !ask.no && !ask.superseded && !(ask.addedIn !== null && standing.has(ask.addedIn)));
}

/** Confirmation persists independently of whether an insertion succeeded or was undone. */
export function confirmAsks(existing: readonly FitAsk[], items: readonly FitAsk[]): FitAsk[] {
  const next = new Map(existing.map(ask => [key(ask.term), ask]));
  for (const item of items) next.set(key(item.term), { ...next.get(key(item.term)), ...item, confirmed: true, no: false });
  return [...next.values()];
}

export function factsFor(asks: readonly FitAsk[]): Array<{ term: string; detail?: string; entryId?: string }> {
  return asks.filter(ask => ask.confirmed && !ask.no)
    .map(ask => ({ term: ask.term, ...(ask.detail ? { detail: ask.detail } : {}), ...(ask.entryId ? { entryId: ask.entryId } : {}) }));
}

/** Verify placements against the saved content, after frontend guards have run. */
export function appliedAsks(items: readonly FitAsk[], content: ResumeContent, result: KeywordInjection | null): FitAsk[] {
  const skills = new Set(content.skills.map(key));
  const lines = new Set(content.experience.flatMap(entry => entry.bullets).map(key));
  const applied = items.filter(item => item.place === 'skills'
    ? skills.has(key(item.term))
    : (result?.placed?.[item.term] ?? []).some(line => line !== 'Skills' && lines.has(key(line))));
  // A single term can target both destinations; complete it only when both landed.
  return applied.filter(item => items.filter(wanted => key(wanted.term) === key(item.term)).every(wanted => applied.includes(wanted)));
}

/** Replace only unanswered, unedited questions reviewed by this request. Answers
 * and in-progress examples belong to the user, not the editorial model. */
export function mergeReviewedAsks(existing: readonly FitAsk[], proposed: readonly FitAsk[], replaced: readonly string[]): FitAsk[] {
  const replace = new Set(replaced.map(key));
  const fresh = new Set(proposed.map(item => key(item.term)));
  const protectedAsk = (item: FitAsk) => Boolean(item.confirmed || item.no || item.detail?.trim() || item.entryId || item.addedIn);
  const kept = existing.filter(item => protectedAsk(item) || (!replace.has(key(item.term)) && !fresh.has(key(item.term))))
    .map(item => item.confirmed && item.addedIn && replace.has(key(item.term)) && !fresh.has(key(item.term))
      ? { ...item, superseded: true } : item);
  const retired = replaced.filter(term => !fresh.has(key(term)) && !kept.some(item => key(item.term) === key(term))).map(term => ({
    term, ifTrue: term, place: 'experience' as const, fromStep: null, no: false, addedIn: null, superseded: true,
  }));
  return [...kept, ...retired, ...proposed.filter(item => !kept.some(old => key(old.term) === key(item.term)))];
}
