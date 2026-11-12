import type { FitAsk } from './state';
import type { ResumeContent } from '../dashboard/types';
import type { KeywordInjection } from '../dashboard/resume/ai-tools';
import { actionableSkillLabel } from '../resume/skill-labels';

const key = (text: string): string => text.trim().toLowerCase();

/** Both the row button and bulk add use the same independent destinations. */
export function confirmationPlacements(item: FitAsk): FitAsk[] {
  const skills = item.useSkills ?? true;
  const experience = item.useExperience ?? false;
  return [
    ...(skills ? [{ ...item, place: 'skills' as const }] : []),
    ...(experience && item.detail?.trim() && item.entryId ? [{ ...item, place: 'experience' as const }] : []),
  ];
}

/** Questions belong to the application, not the rewrite that discovered them. */
export function openConfirmedAsks(asks: readonly FitAsk[], standing: ReadonlySet<string>): FitAsk[] {
  return asks.filter(ask => !ask.reach && actionableSkillLabel(ask.term) && !ask.no && !ask.superseded && !(ask.addedIn !== null && standing.has(ask.addedIn)));
}

/** Confirmation persists independently of whether an insertion succeeded or was undone. */
export function confirmAsks(existing: readonly FitAsk[], items: readonly FitAsk[]): FitAsk[] {
  const next = new Map(existing.map(ask => [key(ask.term), ask]));
  for (const item of items) next.set(key(item.term), { ...next.get(key(item.term)), ...item, confirmed: true, no: false });
  return [...next.values()];
}

export function factsFor(asks: readonly FitAsk[]): Array<{ term: string; detail?: string; entryId?: string }> {
  return asks.filter(ask => ask.confirmed && !ask.no)
    .map(ask => {
      const experience = ask.useExperience ?? ask.place === 'experience';
      return { term: ask.term, ...(experience && ask.detail ? { detail: ask.detail } : {}), ...(experience && ask.entryId ? { entryId: ask.entryId } : {}) };
    });
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


/** Attach the applicant's figure to the same market statement that prompted the question. */
export function confirmMarketingReach(doc: ResumeContent, ask: NonNullable<FitAsk['reach']>, value: string) {
  const match = /^(?:(about|approximately|over|at least)\s+)?(\d{1,3}(?:,\d{3})+|\d+)(?:\s+(customers?|users?|consumers?|viewers?|subscribers?|clients?))?$/i.exec(value.trim());
  if (!match || (match[3] && match[3].toLowerCase().replace(/s$/, '') !== ask.unit.replace(/s$/, ''))) return null;
  const count = Number(match[2].replace(/,/g, ''));
  if (!Number.isSafeInteger(count) || count < 1) return null;

  const role = doc.experience.find(entry => entry.id === ask.entryId);
  const hidden = new Set(doc.hiddenParts);
  if (!role || role.hidden || hidden.has('experience') || hidden.has('exp:' + role.id)) return null;
  const index = role.bullets.indexOf(ask.before);
  if (index < 0 || hidden.has('exp:' + role.id + ':' + index)) return null;

  const amount = (match[1] ? match[1].toLowerCase() + ' ' : '') + count.toLocaleString('en-US');
  const unit = count === 1 ? ask.unit.replace(/s$/, '') : ask.unit;
  const line = ask.before.trim().replace(/[.!?]?$/, '.') + ' Marketing reached ' + amount + ' ' + unit + '.';
  const experience = doc.experience.map(entry => entry === role
    ? { ...entry, bullets: entry.bullets.map((bullet, i) => i === index ? line : bullet) }
    : entry);
  return { line, content: { ...doc, experience } };
}
