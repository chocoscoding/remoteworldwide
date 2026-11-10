"use client";

import type { PublicJobFacts, SalaryBand } from "@/types/main";

export const blankJobFacts = (): PublicJobFacts => ({salaryBands:[],visaSponsorship:"unknown",visaTypes:[],sponsorshipConditions:null,countries:[],regions:[],worldwideEligible:null,workLocation:null,timezoneOverlap:null,roleCategory:null,seniority:null,employmentType:null,contractModel:null,remotePolicy:null,relocationSupport:null,relocationConditions:null,languages:[],benefits:[],skills:[],education:null,experienceMin:null,experienceMax:null,requiredQualifications:[],preferredQualifications:[]});
const inputClass = "mt-1 w-full rounded-md border border-neutral-300 bg-white p-2 text-sm text-neutral-900";
const selects = [
  ["visaSponsorship","Visa sponsorship",["yes","no","unknown"]],
  ["employmentType","Employment type",["full-time","part-time","contract","freelance","internship","temporary"]],
  ["contractModel","Contract model",["employee","contractor","eor"]],
  ["remotePolicy","Working arrangement",["fully-remote","remote-first","hybrid","onsite"]],
  ["seniority","Normalized seniority",["intern","entry","mid","senior","lead","executive"]],
  ["roleCategory","Role category",["software-engineer","frontend","backend","devops","data","product","design","marketing","sales","customer-support","customer-success","operations","finance","hr","legal","writing","qa","security","ai-ml","executive"]],
] as const;
const textFields = [["workLocation","Stated job location"],["timezoneOverlap","Required timezone overlap"],["sponsorshipConditions","Sponsorship conditions"],["relocationConditions","Relocation conditions"],["education","Education requirements"]] as const;
const lists = [["countries","Eligible countries (ISO codes, e.g. US, GB)"],["regions","Eligible regions"],["visaTypes","Visa types (e.g. H1B)"],["languages","Required languages"],["skills","Skills"],["benefits","Benefits"],["requiredQualifications","Required qualifications"],["preferredQualifications","Preferred qualifications"]] as const;

export function EvidenceReview({evidence}:{evidence:unknown}) {
  if (!evidence || typeof evidence !== "object") return null;
  const raw = evidence as Record<string,unknown>;
  const fields = raw.facts && typeof raw.facts === "object" ? raw.facts : raw;
  const rows = Object.entries(fields).flatMap(([key,value]) => {
    if (!value || typeof value !== "object") return [];
    const fact=value as {status?:unknown;evidence?:unknown};
    if (!Array.isArray(fact.evidence) || !fact.evidence.length) return [];
    return [{key,status:String(fact.status ?? "unreviewed"),quotes:fact.evidence.flatMap(e => e && typeof e === "object" && typeof e.quote === "string" ? [e.quote as string] : [])}];
  });
  if (!rows.length) return null;
  return <details className="rounded-md border p-3"><summary className="cursor-pointer font-semibold">Review extracted source evidence</summary><div className="mt-3 space-y-4">{rows.map(row=><div key={row.key}><p className="font-medium">{row.key.replace(/([A-Z])/g," $1")} <span className="text-xs text-neutral-500">{row.status}</span></p>{[...new Set(row.quotes)].map((quote,i)=><blockquote key={i} className="mt-1 border-l-2 border-lime-500 pl-3 text-sm text-neutral-600">{quote}</blockquote>)}</div>)}</div></details>;
}

export default function JobFactsEditor({value,onChange,reviewed,onReviewedChange,evidence}:{value:PublicJobFacts|null;onChange:(facts:PublicJobFacts)=>void;reviewed:boolean;onReviewedChange:(value:boolean)=>void;evidence?:unknown}) {
  const facts=value ?? blankJobFacts();
  const set = (key:keyof PublicJobFacts,next:PublicJobFacts[keyof PublicJobFacts]) => {onChange({...facts,[key]:next});onReviewedChange(false);};
  const changeBand=(index:number,key:keyof SalaryBand,next:SalaryBand[keyof SalaryBand])=>set("salaryBands",facts.salaryBands.map((band,i)=>i===index?{...band,[key]:next}:band));
  return <section className="space-y-4 rounded-lg border border-neutral-300 bg-neutral-50 p-4">
    <h2 className="text-lg font-semibold">Salary, eligibility and job details</h2>
    <p className="text-sm text-neutral-600">Leave anything unstated unknown. Only reviewed details are published on job cards and used by filters.</p>
    <EvidenceReview evidence={evidence}/>
    <div className="grid gap-4 md:grid-cols-2">{selects.map(([key,label,options])=><label key={key} className="text-sm font-medium">{label}<select className={inputClass} value={facts[key] ?? ""} onChange={e=>set(key,e.target.value || null)}>{key!=="visaSponsorship"&&<option value="">Unknown</option>}{options.map(option=><option key={option} value={option}>{option}</option>)}</select></label>)}
      {([ ["worldwideEligible","Open to applicants worldwide"],["relocationSupport","Relocation support"]] as const).map(([key,label])=><label key={key} className="text-sm font-medium">{label}<select className={inputClass} value={facts[key]===null?"":String(facts[key])} onChange={e=>set(key,e.target.value===""?null:e.target.value==="true")}><option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option></select></label>)}
      {textFields.map(([key,label])=><label key={key} className="text-sm font-medium">{label}<textarea className={inputClass} value={facts[key]??""} onChange={e=>set(key,e.target.value || null)}/></label>)}
      {lists.map(([key,label])=><label key={key} className="text-sm font-medium">{label}<textarea className={inputClass} placeholder="One item per line" key={facts[key].join("\n")} defaultValue={facts[key].join("\n")} onBlur={e=>set(key,e.target.value.split(/\n/).map(v=>key==="countries"?v.trim().toUpperCase():v.trim()).filter(Boolean))}/></label>)}
      {([ ["experienceMin","Minimum years of experience"],["experienceMax","Maximum years of experience"]] as const).map(([key,label])=><label key={key} className="text-sm font-medium">{label}<input type="number" min="0" max="60" className={inputClass} value={facts[key]??""} onChange={e=>set(key,e.target.value===""?null:Number(e.target.value))}/></label>)}
    </div>
    <div className="space-y-3"><h3 className="font-semibold">Salary bands</h3><p className="text-xs text-neutral-600">Keep different locations, levels, base pay and OTE in separate bands. Do not assume a currency from $ alone.</p>{facts.salaryBands.map((band,index)=><fieldset key={index} className="grid gap-3 rounded border bg-white p-3 sm:grid-cols-3"><legend className="px-1 text-sm">Band {index+1}</legend>{(["min","max"] as const).map(key=><label key={key} className="text-sm">{key==="min"?"Minimum":"Maximum"}<input className={inputClass} type="number" min="0" step="any" value={band[key]??""} onChange={e=>changeBand(index,key,e.target.value===""?null:Number(e.target.value))}/></label>)}<label className="text-sm">Currency<input className={inputClass} placeholder="USD" maxLength={3} value={band.currency??""} onChange={e=>changeBand(index,"currency",e.target.value.toUpperCase()||null)}/></label><label className="text-sm">Pay period<select className={inputClass} value={band.period??""} onChange={e=>changeBand(index,"period",e.target.value as SalaryBand["period"]||null)}><option value="">Unknown</option>{["hour","day","week","month","year"].map(period=><option key={period}>{period}</option>)}</select></label><label className="text-sm">Compensation type<select className={inputClass} value={band.kind} onChange={e=>changeBand(index,"kind",e.target.value as SalaryBand["kind"])}>{["base","total","ote","unspecified"].map(kind=><option key={kind}>{kind}</option>)}</select></label><label className="text-sm">Location or other conditions<input className={inputClass} value={band.conditions??""} onChange={e=>changeBand(index,"conditions",e.target.value||null)}/></label><button type="button" className="text-left text-sm text-red-700" onClick={()=>set("salaryBands",facts.salaryBands.filter((_,i)=>i!==index))}>Remove band</button></fieldset>)}<button type="button" className="rounded border bg-white px-3 py-2 text-sm" onClick={()=>set("salaryBands",[...facts.salaryBands,{min:null,max:null,currency:null,period:null,kind:"unspecified",conditions:null}])}>Add salary band</button></div>
    <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" className="mt-1" checked={reviewed} onChange={e=>onReviewedChange(e.target.checked)}/>I checked these details against the posting and want to publish them.</label>
    {!reviewed&&value&&<p className="text-sm text-neutral-600">These edits will not be published until reviewed. Existing reviewed details remain unchanged.</p>}
  </section>;
}

export type LifecycleEdit = {postedAt?:string|null;employerExpiresAt?:string|null;closedAt?:string|null;closureReason?:string|null;archiveIndexable?:boolean|null};
const localDate = (value:string|null|undefined) => {if(!value)return "";const date=new Date(value);if(!Number.isFinite(date.getTime()))return "";date.setMinutes(date.getMinutes()-date.getTimezoneOffset());return date.toISOString().slice(0,16);};
export function JobLifecycleEditor({value,onChange}:{value:LifecycleEdit;onChange:(value:LifecycleEdit)=>void}) {
  return <section className="space-y-3 rounded-lg border p-4"><h2 className="text-lg font-semibold">Listing lifetime and archive</h2><p className="text-sm text-neutral-600">Listings expire after three months, or the employer’s earlier deadline. Editing a listing does not restart the clock.</p><div className="grid gap-3 md:grid-cols-3">{([ ["postedAt","Original posting date"],["employerExpiresAt","Employer’s deadline"],["closedAt","Confirmed employer closure"]] as const).map(([key,label])=><label key={key} className="text-sm">{label}<input type="datetime-local" className={inputClass} value={localDate(value[key])} onChange={e=>onChange({...value,[key]:e.target.value?new Date(e.target.value).toISOString():null})}/></label>)}</div><label className="block text-sm">Closure reason<input className={inputClass} value={value.closureReason??""} onChange={e=>onChange({...value,closureReason:e.target.value||null})}/></label><label className="block text-sm">Search after it expires or closes<select className={inputClass} value={value.archiveIndexable===false?"false":""} onChange={e=>onChange({...value,archiveIndexable:e.target.value==="false"?false:null})}><option value="">Keep in search (default)</option><option value="false">Don&apos;t index</option></select></label></section>;
}
