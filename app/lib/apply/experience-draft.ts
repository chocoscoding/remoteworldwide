export interface DraftRole { id: string; label: string; company?: string; role?: string; context?: string }

/** The row and bulk Add use the same default. An intentional edit, including
 * clearing the text, always wins over the generated starting point. */
export function experiencePlacement(skill: string, roles: readonly DraftRole[], saved: {detail?: string; entryId?: string; detailEdited?: boolean} = {}) {
  const role = roles.find(role => role.id === saved.entryId) ?? suggestedExperienceRole(skill, roles);
  const detailEdited = saved.detailEdited ?? Boolean(saved.detail?.trim());
  return {entryId:role?.id ?? '', detail:detailEdited ? saved.detail ?? '' : saved.detail?.trim() || (role ? experienceDraft(skill,role) : ''), detailEdited};
}

const topicOf = (value: string) => value.trim()
  .replace(/^Add evidence for:\s*/i, '')
  .replace(/^You have (?:used|worked with)\s+/i, '')
  .replace(/,?\s*if you have used it[.!]?$/i, '')
  .replace(/^(?:(?:proven|demonstrated|strong|solid|excellent|deep|hands.on|extensive|prior|relevant|working)\s+)*(?:(?:experience|expertise|proficiency|knowledge|familiarity|background|ability|understanding)\s+(?:with|in|of|using|to)\s+)?/i, '')
  .replace(/\s+skills\b/i, '').replace(/\s*\((?:or similar|or equivalent)\)/i, '')
  .replace(/[.!?;]+$/, '').trim();
const termsOf = (value: string) => (topicOf(value).toLowerCase().match(/[a-z0-9+#]{2,}/g) ?? [])
  .filter(term => !/^(?:and|or|for|the|with|in|to|of|similar|equivalent|you|have|used|using)$/.test(term));
const past: Record<string,string> = {build:'Built',lead:'Led',run:'Ran',write:'Wrote',drive:'Drove',manage:'Managed',develop:'Developed',create:'Created',design:'Designed',implement:'Implemented',deliver:'Delivered',analyze:'Analyzed',analyse:'Analysed',collaborate:'Collaborated',support:'Supported',maintain:'Maintained',coordinate:'Coordinated',monitor:'Monitored',prepare:'Prepared',conduct:'Conducted',identify:'Identified',improve:'Improved',work:'Worked',use:'Used',automate:'Automated',integrate:'Integrated',ensure:'Ensured',track:'Tracked',report:'Reported',test:'Tested',own:'Owned',partner:'Partnered'};

/** A starting point to confirm, never evidence that the candidate did this work. */
export function experienceDraft(skill: string, role: DraftRole): string {
  // Reuse a relevant line the candidate already supplied before offering a new draft.
  const terms = termsOf(skill);
  const existing = role.context?.split(/\n+/).find(line => terms.length > 0 && terms.every(term => line.toLowerCase().includes(term)));
  if (existing?.trim()) return existing.trim().slice(0, 500);
  const topic = topicOf(skill).replace(/^(?:you (?:will|can|must)|you['’]ll)\s+/i, '');
  const action = /^(\w+)\s+(.+)/.exec(topic);
  if (action && past[action[1].toLowerCase()]) return `${past[action[1].toLowerCase()]} ${action[2]}.`.slice(0,500);
  // Complete editable drafts, not blank fields or multi-part templates. No
  // invented employer, timeline or measured outcome is needed to get started.
  if (/\b(?:SQL|BigQuery)\b/i.test(topic)) return `Wrote SQL queries${/BigQuery/i.test(topic) ? ' in BigQuery' : ''} to extract and validate data for reports and analysis.`;
  if (/\b(?:CAC|LTV|ROMI|payback|marketing metrics)\b/i.test(topic)) return `Analyzed ${topic.replace(/^marketing metrics:\s*/i,'')} to assess campaign performance and inform marketing decisions.`;
  if (/\b(?:Tableau|Power BI|Looker|dashboard|data visualization)\b/i.test(topic)) return `Built reports and dashboards using ${topic} to explain performance trends and support team decisions.`;
  if (/\b(?:Amplitude|AppsFlyer|analytics)\b/i.test(topic)) return `Used ${topic} to analyze user behavior, track conversion funnels and share findings with the team.`;
  if (/\b(?:Python|JavaScript|TypeScript|Ruby|Java|C\+\+|C#)\b/i.test(topic)) return `Used ${topic} to build and test scripts that automated recurring tasks.`;
  if (/\b(?:recruiting|recruitment)\b/i.test(topic)) return 'Supported recruiting by screening candidates, coordinating interviews and sharing feedback with hiring managers.';
  if (/\btraining\b/i.test(topic)) return `Delivered ${topic[0].toLowerCase()+topic.slice(1)} sessions and answered follow-up questions to help participants apply what they learned.`;
  if (/\b(?:customer success|account management)\b/i.test(topic)) return 'Managed customer onboarding and account follow-ups, coordinating with internal teams to resolve issues and support adoption.';
  if (/\b(?:machine learning|ML models|data science)\b/i.test(topic)) return 'Prepared datasets and evaluated model outputs to support analysis and explain findings to the team.';
  return `Worked on ${topic || 'project delivery'}, documented the approach and shared results with the team.`.slice(0,500);
}

export function suggestedExperienceRole(skill: string, roles: readonly DraftRole[]): DraftRole | undefined {
  const terms = termsOf(skill);
  // Prefer the role with the most relevant evidence, rather than the first
  // role containing one generic word from the question.
  return [...roles].sort((a,b) => {
    const matches = (role: DraftRole) => terms.filter(term => `${role.label} ${role.context ?? ''}`.toLowerCase().includes(term)).length;
    return matches(b)-matches(a);
  })[0];
}
