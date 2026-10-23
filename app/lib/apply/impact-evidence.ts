/** Positive evidence, not a per-bullet penalty. The fixed target makes additions
 * monotone: more text cannot dilute evidence already present. Three distinct
 * examples are enough; repeats never increase credit. Relevance and length are
 * scored separately. This measures writing signals, not the truth of a claim.
 */
export const IMPACT_EXAMPLE_TARGET = 3;
export const explicitWeakOpening = (text: string): boolean =>
  /^(?:responsible\s+for|duties\s+included|helped\b|worked\s+(?:on|with)|tasked\s+with)/i.test(text.trim());

/** Accept ordinary action morphology without maintaining a tool/verb whitelist.
 * Unknown forms are not labelled weak; suggestions only flag explicit weak prose.
 */
export const descriptiveAction = (text: string): boolean => {
  if (explicitWeakOpening(text)) return false;
  const words = text.trim().split(/\s+/);
  return words.length >= 5 && /^(?:[a-z]+ed|[a-z]+ized|[a-z]+ised|use[ds]?|appl(?:y|ies|ied))\b/i.test(text.trim());
};

/** Non-numeric scope can be expressed by a setting, purpose, collaboration or
 * result. No particular tool or second verb is required. Bare/generic claims
 * remain insufficient; the evidence portfolio does not require every line to qualify.
 */
export const descriptiveContext = (text: string): boolean => {
  const words = text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
  if (words.length < 10 || explicitWeakOpening(text)) return false;
  const specific = words.filter(word => !/^(?:a|an|the|to|for|with|in|on|and|or|of|by|from|so|that|could|using|used|use|help|helped|improve|improved|many|various|several|things|stuff|tasks|work|worked|good|great|better|very|well|some|more|our|their|my|it|them)$/.test(word));
  return new Set(specific).size >= 5 && /\b(?:to|with|in|for|using|across|through|while|so|and|by|before|after)\b/i.test(text);
};

export interface ImpactExample { text: string; credit: number }
export function impactPortfolio(bullets: string[], creditOf: (text: string) => number): { score: number; examples: ImpactExample[] } {
  const seen = new Set<string>();
  const examples = bullets.filter(text => {
    const key = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(text => ({ text, credit: Math.max(0, Math.min(1, creditOf(text))) }))
    .sort((a, b) => b.credit - a.credit).slice(0, IMPACT_EXAMPLE_TARGET);
  return { score: examples.reduce((sum, example) => sum + example.credit, 0) / IMPACT_EXAMPLE_TARGET, examples };
}
