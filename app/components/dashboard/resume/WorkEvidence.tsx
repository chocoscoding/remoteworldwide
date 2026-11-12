"use client";

import { useState } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { addSkillNear } from "@/app/lib/resume/skills";
import ReviewedWording from "./ReviewedWording";

export type WorkPlacement = {skill: string; detail: string; entryId: string};
export function placeWork(doc: ResumeContent, fact: WorkPlacement): ResumeContent {
  const withSkill = fact.skill ? addSkillNear(doc,fact.skill,[]) : doc;
  return {...withSkill, hiddenParts:withSkill.hiddenParts?.filter(id=>!(fact.skill && id==="skills")),
    experience:withSkill.experience.map(role=>role.id===fact.entryId && fact.detail && !role.bullets.includes(fact.detail)
      ? {...role,bullets:[...role.bullets,fact.detail]} : role)};
}

export default function WorkEvidence({content, onSave, disabled, prompt, initialSkill, preferExperience=false}: {
  content: ResumeContent; onSave:(fact: WorkPlacement)=>boolean|Promise<boolean>; disabled?:boolean; prompt?:string; initialSkill?:string; preferExperience?:boolean;
}) {
  const [skills,setSkills]=useState(!preferExperience);
  const [experience,setExperience]=useState(preferExperience);
  const [skill,setSkill]=useState(initialSkill ?? "");
  const [detail,setDetail]=useState("");
  const [entryId,setEntryId]=useState("");
  const [saving,setSaving]=useState(false);
  const roles=content.experience.filter(r=>!r.hidden && !content.hiddenParts?.includes("exp:"+r.id));
  const valid=(skills||experience) && (!skills||skill.trim()) && (!experience||(detail.trim() && roles.some(r=>r.id===entryId)));
  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      if(await onSave({skill:skills?skill.trim():"",detail:experience?detail.trim():"",entryId:experience?entryId:""})){
        setSkill(""); setDetail("");
      }
    } finally {setSaving(false);}
  }
  return <details className="rounded-md border border-black/10 p-2.5 text-sm">
    <summary className="cursor-pointer font-semibold">{prompt || "Add a skill or work example"}</summary>
    <fieldset disabled={saving || disabled} className="mt-2 grid gap-2">
      <div className="flex gap-3"><label><input type="checkbox" checked={skills} onChange={e=>setSkills(e.target.checked)} /> Skills</label>
      <label><input type="checkbox" checked={experience} onChange={e=>setExperience(e.target.checked)} /> Experience</label></div>
      {skills && <label>Skill<input value={skill} onChange={e=>setSkill(e.target.value)} maxLength={50} className="block w-full rounded border p-1" /></label>}
      {experience && <><label>Employer and role<select value={entryId} onChange={e=>setEntryId(e.target.value)} className="block w-full rounded border p-1">
        <option value="">Choose a role</option>{roles.map(r=><option key={r.id} value={r.id}>{[r.role,r.company,r.dates].filter(Boolean).join(" · ")}</option>)}
      </select></label>{!roles.length && <p>Add the employer where you did this work first.</p>}
      <label>What did you do?<textarea value={detail} maxLength={500} onChange={e=>setDetail(e.target.value)} className="block w-full rounded border p-1" /></label></>}
      {skills && skill && <p>Skills · <ReviewedWording before="" after={skill} /></p>}
      {experience && detail && <p>Experience · <ReviewedWording before="" after={detail} /></p>}
      <button type="button" disabled={!valid} className="w-fit rounded bg-black px-3 py-1 text-white disabled:opacity-40" onClick={save}>Confirm and add</button>
    </fieldset>
  </details>;
}
