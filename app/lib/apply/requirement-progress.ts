import { strictness } from "../ats/strictness";
import type { ScanReport, RequirementVerdict } from '../ats/types';

const credit = (verdict: RequirementVerdict): number => {
  const state = verdict.coverage ?? (verdict.state === 'satisfied' ? 1 : verdict.state === 'partial' ? strictness().partialCredit : 0);
  return state * (verdict.mention ? strictness().mentionCredit : 1) * (verdict.examples ?? 1);
};

/** Match requirements by stable text as well as ID: extraction can renumber them. */
export function requirementProgress(before: ScanReport | null | undefined, after: ScanReport | null | undefined): string[] {
  if (!before || !after || before.degraded || after.degraded) return [];
  const key = (v: RequirementVerdict) => v.requirement.text.toLowerCase().replace(/\s+/g, ' ').trim();
  const old = new Map(before.verdicts.map(v => [key(v), v]));
  return after.verdicts.filter(v => {
    const was = old.get(key(v));
    return was && was.state !== 'undetermined' && v.state !== 'undetermined' && credit(v) > credit(was);
  }).map(v => v.requirement.label || v.requirement.text);
}
