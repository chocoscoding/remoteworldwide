import type { ResumeContent, ResumeAiFigure } from "../dashboard/types";
import { withYourNumber } from "../apply/impact-asks";

const figures = /[$€£₦]?\d+(?:[,.]\d+)*(?:%|x|[kmb])?\+?/gi;
export function replaceLinkedFigure(doc:ResumeContent, fact:ResumeAiFigure, answer:string): ResumeContent | null {
  if (!fact.own || !fact.entryId || !fact.skill || !doc.skills.includes(fact.skill)) return null;
  const role=doc.experience.find(r=>r.id===fact.entryId);
  if (!role?.bullets.includes(fact.line)) return null;
  // Edit the value only. Its documented unit and period stay visible during confirmation.
  const entered=withYourNumber("",fact.figure,answer.trim());
  const spelledPercent=/^\d[\d,.]*$/.test(fact.figure) && fact.skill.includes(fact.figure+" percent");
  const newValue=spelledPercent && entered?.endsWith("%") ? entered.slice(0,-1) : entered;
  if (!newValue || newValue===fact.figure) return null;
  const replace=(s:string)=>s.replace(figures,token=>token===fact.figure ? newValue : token);
  const line=replace(fact.line), skill=replace(fact.skill);
  if (line===fact.line || skill===fact.skill || skill.length>50 || doc.skills.includes(skill)) return null;
  const rename=(s:string)=>s===fact.skill ? skill : s;
  return {...doc,skills:doc.skills.map(rename),
    skillGroups:doc.skillGroups?.map(g=>({...g,title:rename(g.title),skills:g.skills.map(rename)})),
    experience:doc.experience.map(r=>r.id===role.id ? {...r,bullets:r.bullets.map(b=>b===fact.line ? line : b)} : r),
    aiFigures:doc.aiFigures?.map(f=>f.entryId===role.id && f.skill===fact.skill && f.line===fact.line ?
      {...f,figure:f.figure===fact.figure ? newValue : f.figure,line,skill} : f)};
}
