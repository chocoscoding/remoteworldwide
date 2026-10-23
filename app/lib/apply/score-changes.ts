import type { ScanReport } from "../ats/types";

export interface ScoreDrop { id: string; label: string; before: number; after: number; reasons: string[]; lines: string[] }
/** Compare only complete, same-rule scans. Reasons are recorded scoring factors,
 * not a generated story about causality. Missing detail remains explicitly unknown.
 */
export function scoreDrops(before: ScanReport | null | undefined, after: ScanReport | null | undefined): ScoreDrop[] {
  if (!before || !after || before.degraded || after.degraded || !after.scoringVersion || before.scoringVersion !== after.scoringVersion) return [];
  const drops: ScoreDrop[] = [];
  for (const metric of after.metrics) {
    const previous = before.metrics.find(item => item.id === metric.id);
    if (!previous || previous.value === null || metric.value === null || previous.checked === false || metric.checked === false || metric.value >= previous.value) continue;
    const factors = (metric.factors ?? []).filter(factor => {
      const old = previous.factors?.find(item => item.id === factor.id);
      return old && factor.value < old.value - 0.001;
    });
    let reasons = factors.map(factor => factor.detail);
    let lines = factors.flatMap(factor => factor.lines);
    if (metric.id === "impact-language" && factors.length) {
      const current = new Set(lines);
      const lost = (previous.factors?.find(factor => factor.id === "impact-evidence")?.lines ?? []).filter(line => !current.has(line));
      if (lost.length) reasons = [
        "Some examples supporting your previous impact score were removed or rewritten. Extra responsibilities do not reduce impact credit.",
        ...lost.slice(0, 2).map(line => `Previously counted: “${line}”`),
        ...reasons,
      ];
    }
    if (metric.id === "keyword-match") {
      const weaker = after.verdicts.filter(verdict => {
        const old = before.verdicts.find(item => item.requirement.id === verdict.requirement.id);
        return old && ((verdict.coverage !== undefined && old.coverage !== undefined && verdict.coverage < old.coverage) || (old.state === "satisfied" && verdict.state !== "satisfied") || (!old.mention && verdict.mention));
      });
      const labels = weaker.map(verdict => ({ label: verdict.requirement.label || verdict.requirement.text, mention: Boolean(verdict.mention),
        sources: before.verdicts.find(old => old.requirement.id === verdict.requirement.id)?.evidence.map(item => item.chunkId).filter(Boolean) ?? [] }));
      const words = (label: string) => new Set(label.toLowerCase().match(/[\p{L}\p{N}+#]+/gu)?.filter(word => !['experience','skills','skill','knowledge','of','in','with','and'].includes(word)) ?? []);
      // Keep the most specific overlapping label. Different loss types and
      // independent requirements remain separate; this changes copy, not scores.
      const distinct = labels.filter((item, index) => {
        const own = words(item.label);
        if (!own.size) return true;
        return !labels.some((other, at) => at !== index && other.mention === item.mention &&
          [...own].every(word => words(other.label).has(word)) &&
          (words(other.label).size > own.size || at < index));
      });
      const groups: Array<{labels:string[];sources:Set<string>;mention:boolean}> = [];
      for (const item of distinct) {
        const group = groups.find(group => group.mention === item.mention && item.sources.some(source => group.sources.has(source)));
        if (group) {
          group.labels.push(item.label);
          item.sources.forEach(source => group.sources.add(source));
        } else groups.push({labels:[item.label],sources:new Set(item.sources),mention:item.mention});
      }
      reasons = groups.map(group => group.labels.length === 1
        ? `The latest scan found less support for ${group.labels[0]}${group.mention ? " in Experience; it is now supported only in Skills or Summary" : ""}.`
        : `The same resume evidence now provides less support for ${group.labels.join(' and ')}${group.mention ? '; these are now supported only in Skills or Summary' : ''}.`);
      lines = weaker.flatMap(verdict => verdict.evidence.map(item => item.text));
      if (!reasons.length && before.titleFit && after.titleFit && after.titleFit.points < before.titleFit.points) reasons = ["The resume title now matches the job title less closely."];
    }
    if (!reasons.length) reasons = ["This check scored lower on the latest scan, but a specific cause was not recorded. Review the change before deciding whether to keep it."];
    drops.push({ id: metric.id, label: metric.label, before: previous.value, after: metric.value, reasons, lines: [...new Set(lines)].slice(0, 3) });
  }
  if ((after.stuffingPenalty ?? 0) > (before.stuffingPenalty ?? 0)) drops.push({ id: "repetition", label: "Repetition adjustment", before: before.stuffingPenalty ?? 0, after: after.stuffingPenalty ?? 0, reasons: after.stuffing?.length ? after.stuffing : ["The latest scan applied a larger repetition deduction."], lines: [] });
  if (!drops.length && after.score < before.score) drops.push({ id: "overall", label: "Overall score", before: before.score, after: after.score, reasons: ["The overall score decreased, but the saved details do not isolate the reason. Review the change or rescore."], lines: [] });
  return drops;
}
