export interface DraftRole { id: string; label: string; company?: string; role?: string; context?: string }

/** A starting point to confirm, never evidence that the candidate did this work. */
export function experienceDraft(skill: string, role: DraftRole): string {
  const company = role.company?.trim() || "[company]";
  if (/recruit|hiring|candidate screening|talent acquisition/i.test(skill)) {
    return `Supported [${skill} / candidate screening] for [X] roles at ${company}, helping reduce time-to-hire by [X]%.`;
  }
  if (/sales|revenue|account management/i.test(skill)) {
    return `Used [${skill}] at ${company} to support [X] accounts, contributing to [X]% growth in [revenue / retention].`;
  }
  if (/test|quality|automation|engineering|programming|react|python|typescript/i.test(skill)) {
    return `Used [${skill}] at ${company} to improve [system / workflow], reducing [errors / processing time] by [X]%.`;
  }
  return `Applied [${skill}] in my ${role.role?.trim() || "[role]"} work at ${company} to improve [process / deliverable], achieving [measurable outcome].`;
}

export function suggestedExperienceRole(skill: string, roles: readonly DraftRole[]): DraftRole | undefined {
  const terms = skill.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  return roles.find(role => terms.some(term => `${role.label} ${role.context ?? ""}`.toLowerCase().includes(term))) ?? roles[0];
}
