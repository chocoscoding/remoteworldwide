import type { ResumeContent } from '../dashboard/types';

const compact = (value: string) => value.toLowerCase().replace(/\(remote\)/g, '').replace(/[^\p{L}\p{N}]/gu, '');

/** Only split a uniquely matching original header. Preserve IDs, dates,
 * bullets, hidden choices, and all other draft edits. Ambiguity stays for review.
 */
export function repairWorkHeaders(current: ResumeContent, imported: ResumeContent): ResumeContent | null {
  let changed = false;
  const experience = current.experience.map(entry => {
    if (entry.company.trim() || !entry.role.trim()) return entry;
    const matches = imported.experience.filter(next => next.company.trim() && next.role.trim()
      && compact(next.dates) === compact(entry.dates)
      && compact(`${next.role}${next.company}`) === compact(entry.role));
    if (matches.length !== 1) return entry;
    changed = true;
    return { ...entry, role: matches[0].role, company: matches[0].company };
  });
  return changed ? { ...current, experience } : null;
}
