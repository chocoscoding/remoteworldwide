export interface DraftRole { id: string; label: string; company?: string; role?: string; context?: string }

/** The row and bulk Add use the same default. An intentional edit, including
 * clearing the text, always wins over the generated starting point. */
export function experiencePlacement(skill: string, roles: readonly DraftRole[], saved: {detail?: string; entryId?: string; detailEdited?: boolean;draftPrepared?:boolean} = {}) {
  const role = roles.find(role => role.id === saved.entryId) ?? suggestedExperienceRole(skill, roles);
  const detailEdited = saved.detailEdited ?? Boolean(saved.detail?.trim());
  // A starting point saved unedited is made again by today's rules (2026-11-27: an old draft that only
  // repeated the posting stayed on its row); a detail of unknown origin (a writer's) is kept.
  const regenerate = saved.detailEdited === false && !saved.draftPrepared;
  return {entryId:role?.id ?? '', detail:detailEdited ? saved.detail ?? '' : (!regenerate && saved.detail?.trim()) || (role ? experienceDraft(skill,role) : ''), detailEdited};
}

const topicOf = (value: string) => value.trim()
  .replace(/^Add evidence for:\s*/i, '')
  .replace(/^(?:(?:good|nice)[\s-]to[\s-]have|bonus(?: points)?|plus|preferred|optional)\s*[:–—-]\s*/i, '')
  .replace(/^You have (?:used|worked with)\s+/i, '')
  .replace(/,?\s*if you have used it[.!]?$/i, '')
  .replace(/^(?:(?:proven|demonstrated|strong|solid|excellent|deep|hands.on|extensive|prior|relevant|working)\s+)*(?:(?:experience|expertise|proficiency|knowledge|familiarity|background|ability|understanding)\s+(?:working\s+)?(?:with|in|of|using|to)\s+)?/i, '')
  .replace(/\s+skills\b/i, '').replace(/\s*\((?:or similar|or equivalent)\)/i, '')
  .replace(/[.!?;]+$/, '').trim();
const termsOf = (value: string) => (topicOf(value).toLowerCase().match(/[a-z0-9+#]{2,}/g) ?? [])
  .filter(term => !/^(?:and|or|for|the|with|in|to|of|similar|equivalent|you|have|used|using)$/.test(term));
/**
 * A starting point to confirm, never evidence that the candidate did this work, and never the
 * posting said back (owner, 2026-11-27: "Built and drive processes that truly move the needle for
 * clients." was the requirement with its verb put in the past, and Add made it a bullet). With no
 * line of the role's own that fits and no example the topic suggests, it is empty: the row then asks
 * "What did you do, and what changed?".
 */
export function experienceDraft(skill: string, role: DraftRole): string {
  // Reuse a relevant line the candidate already supplied before offering a new draft.
  const terms = termsOf(skill);
  const existing = role.context?.split(/\n+/).find(line => terms.length > 0 && terms.every(term => line.toLowerCase().includes(term)));
  if (existing?.trim()) return existing.trim().slice(0, 500);
  const topic = topicOf(skill).replace(/^(?:you (?:will|can|must)|you['’]ll)\s+/i, '');
  // A scale from this employer can describe the same data, but a latency or
  // uptime result must never become an invented analysis outcome.
  const scale = role.context?.match(/\b[\d,]+\+?\s+(?:daily|monthly|weekly)\s+(?:transactions|events|records)\b/i)?.[0];
  if (/\b(?:datasets?|transaction.level|event.level)\b/i.test(topic)) return `Validated and reconciled ${scale ? `data covering ${scale}` : 'transaction and event datasets'}, resolving inconsistencies before preparing analysis-ready reports.`;
  if (/\b(?:CAC|LTV|ROMI|payback|marketing metrics)\b/i.test(topic)) return 'Calculated acquisition cost, lifetime value and payback from spend and revenue data, comparing campaign results to guide budget decisions.';
  if (/\bfunnel\b/i.test(topic)) return 'Analyzed conversion from acquisition through payment, identified drop-off points and presented findings to guide product improvements.';
  if (/\bdata quality\b/i.test(topic)) return 'Investigated missing and inconsistent records, traced errors to their sources and added validation checks to keep reporting datasets reliable.';
  // Complete editable drafts, not blank fields or multi-part templates. No
  // invented employer, timeline or measured outcome is needed to get started.
  if (/\b(?:SQL|BigQuery)\b/i.test(topic)) return `Wrote SQL queries${/BigQuery/i.test(topic) ? ' in BigQuery' : ''} to extract and validate data for reports and analysis.`;
  if (/\b(?:Tableau|Power BI|Looker|dashboard|data visualization)\b/i.test(topic)) return `Built reports and dashboards using ${topic} to explain performance trends and support team decisions.`;
  if (/\b(?:Amplitude|AppsFlyer|analytics)\b/i.test(topic)) return `Used ${topic} to analyze user behavior, track conversion funnels and share findings with the team.`;
  if (/\b(?:Python|JavaScript|TypeScript|Ruby|Java|C\+\+|C#)\b/i.test(topic)) return `Used ${topic} to build and test scripts that automated recurring tasks.`;
  if (/\b(?:recruiting|recruitment)\b/i.test(topic)) return 'Supported recruiting by screening candidates, coordinating interviews and sharing feedback with hiring managers.';
  if (/\btraining\b/i.test(topic)) return `Delivered ${topic[0].toLowerCase()+topic.slice(1)} sessions and answered follow-up questions to help participants apply what they learned.`;
  if (/\b(?:customer success|account management)\b/i.test(topic)) return 'Managed customer onboarding and account follow-ups, coordinating with internal teams to resolve issues and support adoption.';
  if (/\b(?:machine learning|ML models|data science)\b/i.test(topic)) return 'Prepared datasets and evaluated model outputs to support analysis and explain findings to the team.';
  // Reuse the role's own line only when it shares most of the requirement's words: one shared word
  // is no fit (owner, 2026-11-27: "Industry Knowledge and Trends" offered a support-ticket line for its
  // "knowledge base", and Add changed nothing). The incorporation editor handles the wording on Add.
  const relevant=role.context?.split(/\n+/).filter(Boolean).map(line=>({line,matches:terms.filter(term=>line.toLowerCase().includes(term)).length})).sort((a,b)=>b.matches-a.matches)[0];
  if(relevant && relevant.matches>=2 && relevant.matches*2>=terms.length) return relevant.line.slice(0,500);
  return '';
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
