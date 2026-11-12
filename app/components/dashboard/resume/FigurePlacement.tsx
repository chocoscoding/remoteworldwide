import ReviewedWording from "./ReviewedWording";
import { addedFigures } from "@/app/lib/dashboard/resume/ai-figures";

export interface FigureDestination { experience: boolean; skills: boolean; label: string }
export const experienceOnly: FigureDestination = {experience:true,skills:false,label:""};

export function skillProof(before:string, after:string, choice:FigureDestination) {
  if (!choice.skills || !choice.label.trim()) return "";
  const figures=addedFigures(before,after).map(value=>{
    const at=Array.from(after.matchAll(/[$€£₦]?\d+(?:[,.]\d+)*(?:%|[xkmb])?\+?/gi)).find(m=>m[0]===value)?.index;
    if (at === undefined) return value;
    const unit=/^\s+(percentage points?|percent|customers?|accounts?|users?|days?|weeks?|months?|hours?|minutes?|teams?)\b/i.exec(after.slice(at+value.length));
    return unit ? value+" "+unit[1] : value;
  });
  return [choice.label.trim(),...figures].join(" · ");
}

export default function FigurePlacement({before,after,choice,onChange}:{
  before:string; after:string; choice:FigureDestination; onChange:(next:FigureDestination)=>void;
}) {
  const proof=skillProof(before,after,choice);
  return <fieldset className="my-2 space-y-1 text-xs"><legend>Where should this appear?</legend>
    <label className="mr-3"><input type="checkbox" checked={choice.skills} onChange={e=>onChange({...choice,skills:e.target.checked})} /> Skills</label>
    <label><input type="checkbox" checked={choice.experience} onChange={e=>onChange({...choice,experience:e.target.checked})} /> Experience</label>
    {choice.skills && <label className="block">Skill or measure
      <input value={choice.label} maxLength={35} placeholder="e.g. Account retention" className="block w-full rounded border p-1"
        onChange={e=>onChange({...choice,label:e.target.value})} />
      {proof && <span>Skills · <ReviewedWording before="" after={proof} /></span>}
    </label>}
  </fieldset>;
}
