"use client";

import { useRef, useState } from "react";
import type { ResumeExperienceEntry } from "@/app/lib/dashboard/types";

export default function AddExperience({onSave}: {
  onSave: (entry: ResumeExperienceEntry) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const draft = useRef<HTMLDivElement>(null);
  async function save() {
    if (saving) return;
    const value = (field: string) => draft.current?.querySelector<HTMLElement>('[data-field="' + field + '"]')?.innerText?.trim() ?? "";
    const company = value("company"), role = value("role");
    if (!company || !role) {setError("Add the company and role."); return;}
    const entry = {id:crypto.randomUUID(), company, role, dates:value("dates"),
      bullets:value("bullets").split(/\n+/).map(line=>line.replace(/^[•*-]\s*/, "").trim()).filter(Boolean)};
    setSaving(true);
    setError("");
    try {if (await onSave(entry)) setOpen(false); else setError("Your experience could not be saved. Try again.");}
    catch {setError("Your experience could not be saved. Try again.");}
    finally {setSaving(false);}
  }
  return <div data-resume-highlight className="print:hidden">
    {open ? <div ref={draft} className="mt-3 rounded-md border border-[#222325]/20 p-4">
      {(["role","company","dates","bullets"] as const).map(field =>
        <div key={field} role="textbox" aria-label={{role:"Job title",company:"Company",dates:"Dates",bullets:"Your work and achievements"}[field]}
          aria-multiline={field==="bullets"} data-field={field}
          data-placeholder={{role:"Job title",company:"Company",dates:"Dates",bullets:"What did you do here?"}[field]}
          contentEditable={saving ? false : "plaintext-only"} suppressContentEditableWarning
          className={"min-h-[1.5em] whitespace-pre-wrap rounded px-1 outline-none empty:before:text-black/35 empty:before:content-[attr(data-placeholder)] focus:bg-[#fbfde9] " +
            (field==="role" ? "font-bold" : field==="bullets" ? "mt-3" : "text-sm")} />)}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex gap-3 text-sm">
        <button type="button" disabled={saving} onClick={save} className="rounded bg-[#e4f28c] px-3 py-1.5 font-semibold disabled:opacity-50">{saving ? "Saving…" : "Save experience"}</button>
        <button type="button" disabled={saving} onClick={()=>{setOpen(false);setError("");}} className="px-2">Cancel</button>
      </div>
    </div> : <button type="button" onClick={()=>setOpen(true)} className="mt-3 rounded px-2 py-1 text-sm font-semibold text-[#4b6720] hover:bg-[#eef6ad]/60">+ Add experience</button>}
  </div>;
}
