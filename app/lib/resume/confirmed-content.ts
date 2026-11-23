import type { ResumeContent } from "../dashboard/types";

/** Generated figures are applied immediately and remain highlighted for editing. */
export function confirmedContent(content: ResumeContent): ResumeContent {
  const pending = (content.draftProposals ?? []).filter(proposal => proposal.kind === "detail");
  if (!pending.length) return content;
  return {...content, draftProposals:content.draftProposals?.filter(proposal => proposal.kind === "estimate"),
    experience:content.experience.map(role => ({...role, bullets:role.bullets.flatMap(line => {
      const proposal = pending.find(item => item.entryId === role.id && item.after === line);
      return proposal ? (proposal.before ? [proposal.before] : []) : [line];
    })}))};
}
