import type {ResumeAiAddition, ResumeContent} from "../types";

/** Match the current text, not a stale proposal from a discarded writer pass. */
export function pendingAiAdditions(content: ResumeContent): ResumeAiAddition[] {
  const hidden = new Set(content.hiddenParts ?? []);
  const seen = new Set<string>();
  return (content.aiAdditions ?? []).filter(item => {
    if (item.reviewed || !item.after) return false;
    const role = content.experience.find(entry=>entry.id===item.entryId);
    const present = item.section === "title" ? content.title===item.after :
      item.section === "summary" ? !hidden.has("summary") && content.summary===item.after :
      item.section === "skills" ? !hidden.has("skills") && content.skills.includes(item.after) :
      role && !role.hidden && !hidden.has("experience") && !hidden.has("exp:"+role.id) &&
        (item.section === "role" ? role.role===item.after : role.bullets.some((line,index)=>
          line===item.after && !hidden.has("exp:"+role.id+":"+index)));
    const key=JSON.stringify([item.section,item.entryId,item.after]);
    if (!present || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
