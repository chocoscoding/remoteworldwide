/** Review notices, never errors: freelance and concurrent work can be intentional. */
export function overlappingRoles(roles: readonly { id: string; role: string; company: string; dates: string }[], now = new Date()): string[] {
  const month = (value: string, end: boolean): number | null => {
    if (/^(present|now|current|ongoing)$/i.test(value.trim())) return now.getFullYear() * 12 + now.getMonth();
    const match = value.trim().match(/^(?:(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?((?:19|20)\d{2})$/i);
    if (!match) return null;
    const m = match[1] ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(match[1].slice(0, 3).toLowerCase()) : end ? 11 : 0;
    return Number(match[2]) * 12 + m;
  };
  const ranges = roles.flatMap(role => {
    const parts = role.dates.split(/\s*(?:[–—]|\s-\s|\bto\b)\s*/i);
    if (parts.length !== 2) return [];
    const start = month(parts[0], false), end = month(parts[1], true);
    return start === null || end === null || end < start ? [] : [{ ...role, start, end }];
  });
  return ranges.flatMap((a, i) => ranges.slice(i + 1).filter(b => Math.max(a.start, b.start) < Math.min(a.end, b.end)).map(b => `${a.role} at ${a.company} overlaps ${b.role} at ${b.company}. Confirm the dates, or label concurrent/part-time work.`));
}
