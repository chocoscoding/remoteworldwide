"use client";

import { useState } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { addSkillNear } from "@/app/lib/resume/skills";
import { experiencePlacement, experienceDraft } from "@/app/lib/apply/experience-draft";
import { useSuggestionDrafts } from "@/app/lib/resume/use-suggestion-drafts";
import { skillNames, isLanguageSkill } from "@/app/lib/resume/skill-labels";
import ReviewedWording from "./ReviewedWording";

export type WorkPlacement = {skill: string; detail: string; entryId: string};
export function placeWork(doc: ResumeContent, fact: WorkPlacement): ResumeContent {
  const withSkill = fact.skill ? addSkillNear(doc,fact.skill,[]) : doc;
  return {...withSkill, hiddenParts:withSkill.hiddenParts?.filter(id=>!(fact.skill && id==="skills")),
    experience:withSkill.experience.map(role=>role.id===fact.entryId && fact.detail && !role.bullets.includes(fact.detail)
      ? {...role,bullets:[...role.bullets,fact.detail]} : role)};
}

export default function WorkEvidence({content, onSave, disabled, prompt, initialSkill, jdText, preferExperience=false, defaultOpen=false}: {
  content: ResumeContent; onSave:(fact: WorkPlacement)=>boolean|Promise<boolean>; disabled?:boolean; prompt?:string; initialSkill?:string; jdText?:string; preferExperience?:boolean;
  /** Open from the start: the AI's prepared wording waiting on a confirm (an ATS fix card's terms). */
  defaultOpen?:boolean;
}) {
  const [skills,setSkills]=useState(!preferExperience);
  const [experience,setExperience]=useState(preferExperience);
  const [skill,setSkill]=useState(initialSkill ?? "");
  const roles=content.experience.filter(r=>!r.hidden && !content.hiddenParts?.includes("experience") && !content.hiddenParts?.includes("exp:"+r.id));
  const draftRoles=roles.map(r=>({...r,label:r.role+' · '+r.company,context:r.bullets.filter((_,i)=>!content.hiddenParts?.includes(`exp:${r.id}:${i}`)).join('\n')}));
  const initial=initialSkill ? experiencePlacement(initialSkill,draftRoles) : {detail:'',entryId:''};
  const [detail,setDetail]=useState(initial.detail);
  const [entryId,setEntryId]=useState('');
  const bank=useSuggestionDrafts(content,initialSkill?[{term:initialSkill,...(entryId?{entryId}:{})}]:[],jdText);
  const prepared=bank.data?.find(d=>d.term===initialSkill);
  const canSkills=!initialSkill || (prepared?.skills ?? skillNames(initialSkill)).length>0;
  const canExperience=roles.length>0 && (!initialSkill || (prepared?.experience ?? !isLanguageSkill(initialSkill)));
  const [edited,setEdited]=useState(false);
  const [saving,setSaving]=useState(false);
  const addSkills=canSkills && (skills || !canExperience);
  const addExperience=canExperience && (experience || !canSkills);
  const wording=edited ? detail : prepared?.detail ?? detail;
  const targetId=entryId || prepared?.entryId || initial.entryId;
  const skillWording=skill===initialSkill ? (prepared?.skills ?? skillNames(skill)).join(', ') : skill;
  const awaiting=Boolean(initialSkill && !prepared);
  const valid=!awaiting && (addSkills||addExperience) && (!addSkills||skillWording.trim()) && (!addExperience||(wording.trim() && roles.some(r=>r.id===targetId)));
  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      if(await onSave({skill:addSkills?skillWording.trim():"",detail:addExperience?wording.trim():"",entryId:addExperience?targetId:""})){
        setSkill(""); setDetail(""); setEdited(true);
      }
    } finally {setSaving(false);}
  }
  return <details open={defaultOpen || undefined} className="rounded-md border border-black/10 p-2.5 text-sm">
    <summary className="cursor-pointer font-semibold">{prompt || "Add a skill or work example"}</summary>
    <fieldset disabled={saving || disabled} className="mt-2 grid gap-2">
      <div className="flex gap-3">{canSkills && <label><input type="checkbox" checked={addSkills} onChange={e=>setSkills(e.target.checked)} /> Skills</label>}
      {canExperience && <label><input type="checkbox" checked={addExperience} onChange={e=>setExperience(e.target.checked)} /> Experience</label>}</div>
      {addSkills && <label>Skill<input value={skillWording} onChange={e=>setSkill(e.target.value)} maxLength={50} className="block w-full rounded border p-1" /></label>}
      {addExperience && <><label>Employer and role<select value={targetId} onChange={e=>{setEntryId(e.target.value);const role=draftRoles.find(r=>r.id===e.target.value);if(initialSkill && role && !edited)setDetail(experienceDraft(initialSkill,role));}} className="block w-full rounded border p-1">
        <option value="">Choose a role</option>{roles.map(r=><option key={r.id} value={r.id}>{[r.role,r.company,r.dates].filter(Boolean).join(" · ")}</option>)}
      </select></label>{!roles.length && <p>Add the employer where you did this work first.</p>}
      <label>{initialSkill ? 'Suggested work example' : 'What did you do?'}<textarea value={wording} maxLength={500} onChange={e=>{setDetail(e.target.value);setEdited(true);}} className="block w-full rounded border p-1" /></label></>}
      {addSkills && skill && <p>Skills · <ReviewedWording before="" after={skillWording} /></p>}
      {addExperience && detail && <p>Experience · <ReviewedWording before="" after={wording} /></p>}
      {awaiting && <p className="text-xs" role="status">{bank.isFetching ? 'Preparing suggestion…' : <button type="button" onClick={()=>{void bank.refetch();}}>Couldn’t prepare this suggestion. Retry</button>}</p>}
      <button type="button" disabled={!valid} className="w-fit rounded bg-black px-3 py-1 text-white disabled:opacity-40" onClick={save}>Confirm and add</button>
    </fieldset>
  </details>;
}
