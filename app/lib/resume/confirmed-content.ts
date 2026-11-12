import type { ResumeContent } from "../dashboard/types";
import { pendingAiFigures } from "../dashboard/resume/ai-figures";

export function needsFigureReview(content:ResumeContent):boolean {
  const lines=[content.summary,...content.experience.flatMap(r=>r.bullets),...(content.customSections ?? []).flatMap(s=>s.items)];
  return pendingAiFigures(content).some(f=>f.before===undefined || !lines.includes(f.line));
}

/** Export only the accepted revision. Older unchecked figures have no recoverable original. */
export function confirmedContent(content: ResumeContent): ResumeContent {
  const pending = pendingAiFigures(content);
  const proposals = content.draftProposals ?? [];
  if (!pending.length && !proposals.length) return content;
  const original = (line: string) => {
    const words = new Set(line.toLowerCase().split(/[^\p{L}\p{N}]+/u));
    const match = pending.find(f=>{
      if (f.line===line) return true;
      const tokens=f.line.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2);
      return line.includes(f.figure) && tokens.filter(w=>words.has(w)).length*2 >= Math.max(1,tokens.length);
    });
    return match ? match.before ?? "" : line;
  };
  return {...content, summary:original(content.summary),draftProposals:[],aiFigures:content.aiFigures?.filter(f=>f.own),
    experience:content.experience.map(role=>({...role,bullets:role.bullets.map(line=>{
      const proposal=proposals.find(p=>p.entryId===role.id && p.after===line);
      return original(proposal ? proposal.before : line);
    }).filter(Boolean)})),
    customSections:content.customSections?.map(s=>({...s,items:s.items.map(original).filter(Boolean)}))};
}
