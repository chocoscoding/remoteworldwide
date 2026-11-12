"use client";
import { useState } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { replaceLinkedFigure } from "@/app/lib/resume/linked-figures";
import ReviewedWording from "./ReviewedWording";

export default function LinkedNumbers({content,onSave,disabled}:{content:ResumeContent;onSave:(doc:ResumeContent)=>void;disabled?:boolean}) {
  const [values,setValues]=useState<Record<string,string>>({});
  const facts=(content.aiFigures ?? []).filter(f=>f.own && f.skill && content.skills.includes(f.skill) &&
    content.experience.some(r=>r.id===f.entryId && r.bullets.includes(f.line)));
  if (!facts.length) return null;
  return <details className="rounded-md border p-2 text-sm"><summary>Edit a confirmed figure in Skills and Experience</summary>
    {facts.map((f,i)=>{
      const key=[f.entryId,f.line,f.figure,i].join("/");
      const value=values[key] ?? "";
      const next=replaceLinkedFigure(content,f,value);
      const changed=next?.aiFigures?.[content.aiFigures!.indexOf(f)];
      return <div className="my-2" key={key}><label>{f.skill}
        <input className="mx-2 w-24 border p-1" disabled={disabled} value={value} placeholder={f.figure} onChange={e=>setValues({...values,[key]:e.target.value})} /></label>
        <p><ReviewedWording before={f.line} after={changed?.line ?? f.line} /></p>
        <button type="button" className="underline" disabled={!next || disabled} onClick={()=>next && onSave(next)}>Update both places</button></div>;
    })}</details>;
}
