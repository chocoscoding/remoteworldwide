/** Structural warnings are independent of match and writing scores. No model or I/O. */
export const STRUCTURE_VERSION = 2;
export function structureIssues(content: { title: string; experience: Array<{ role: string; company: string; dates: string }> }, source = ""): string[] {
  const issues: string[] = [];
  content.experience.forEach((entry, index) => {
    const prefix = `Work history ${index + 1}`;
    if (/^[\d\s.,/-]+$/.test(entry.company.trim())) issues.push(`${prefix}: employer is a number or punctuation`);
    if (/^(?:Asia|America|Europe|EMEA|B2B|B2C|клиентами\b.*)$/i.test(entry.role.trim())) issues.push(`${prefix}: description or geography was read as a job title`);
    if (/^(?:a |an |the |connecting |and |B2C subscriptions)/i.test(entry.company.trim()) && /[.!]$/.test(entry.company.trim())) issues.push(`${prefix}: employer looks like a product or company description`);
    if (!entry.role.trim() && entry.company.trim()) issues.push(`${prefix}: job title is missing`);
  });
  if (!content.title.trim() && /\b(?:chief\s+\w+\s+officer|(?:senior |lead )?(?:product|marketing|software)\s+(?:manager|engineer|officer))\b/i.test(source.slice(0, 700))) issues.push('Headline is missing despite a role in the source header');
  return issues;
}
