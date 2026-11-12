export interface DraftRole { id: string; label: string; company?: string; role?: string; context?: string }

/** A starting point to confirm, never evidence that the candidate did this work. */
export function experienceDraft(skill: string, role: DraftRole): string {
  // Reuse a relevant line the candidate already supplied before offering a new draft.
  const terms = skill.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const existing = role.context?.split(/\n+/).find(line => terms.length > 0 && terms.every(term => line.toLowerCase().includes(term)));
  if (existing?.trim()) return existing.trim().slice(0, 500);
  return "";
}

export function suggestedExperienceRole(skill: string, roles: readonly DraftRole[]): DraftRole | undefined {
  const terms = skill.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  return roles.find(role => terms.some(term => `${role.label} ${role.context ?? ""}`.toLowerCase().includes(term))) ?? roles[0];
}
