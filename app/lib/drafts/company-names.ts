/** Unify spelling only when the letters/numbers agree; never merge job postings. */
export function normalizeDraftCompanies<T extends { company: string | null }>(drafts: T[]): T[] {
  const companies = new Map<string, string>();
  const keyOf = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const quality = (name: string) => (/\s/.test(name) ? 2 : 0) + (/[A-Z]/.test(name) ? 1 : 0);
  for (const draft of drafts) if (draft.company?.trim()) {
    const name = draft.company.trim(), key = keyOf(name), current = companies.get(key);
    if (!current || quality(name) > quality(current)) companies.set(key, name);
  }
  return drafts.map(draft => ({ ...draft, company: draft.company ? companies.get(keyOf(draft.company)) ?? draft.company : null }));
}
