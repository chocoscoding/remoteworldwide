export type DiscoveryLink = { title: string; href: string; terms: string[] };
/** Match explicit phrases, so "data" does not accidentally match "metadata". */
export function relevantLinks(
  text: string,
  candidates: DiscoveryLink[],
  limit: number,
): DiscoveryLink[] {
  const normalized = ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
  return candidates
    .map((link, index) => ({
      link,
      index,
      score: link.terms.reduce((score, term) => {
        const phrase = term
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
        return (
          score +
          (phrase && normalized.includes(` ${phrase} `)
            ? phrase.split(" ").length
            : 0)
        );
      }, 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ link }) => link);
}
