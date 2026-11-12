"use client";

import { CircleHelp } from "lucide-react";
import styles from "./AddEmployer.module.css";
import { useState } from "react";
import type { ResumeExperienceEntry } from "@/app/lib/dashboard/types";

export default function AddEmployer({ onAdd, disabled, scope, additionalDestination }: {
  onAdd: (entry: ResumeExperienceEntry, alsoSave:boolean) => Promise<boolean> | boolean;
  disabled?: boolean;
  scope: string;
  additionalDestination?:string;
}) {
  const [alsoSave,setAlsoSave]=useState(false);
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [current, setCurrent] = useState(false);
  const [saving, setSaving] = useState(false);
  const valid = company.trim() && role.trim() && start && (current || (end && end >= start));
  async function save() {
    if (!valid || saving || disabled) return;
    setSaving(true);
    try {
      const saved = await onAdd({id: crypto.randomUUID(), company:company.trim(), role:role.trim(),
        dates: start + " – " + (current ? "Present" : end), bullets: []},alsoSave);
      if (saved) {
        setAlsoSave(false); setOpen(false); setCompany(""); setRole(""); setStart(""); setEnd(""); setCurrent(false);
      }
    } finally { setSaving(false); }
  }
  const field = "block min-w-0 w-full rounded border bg-white px-2 py-1 text-sm";
  return <div className="rounded-md border border-black/10 p-2.5 text-xs">
    <button type="button" aria-expanded={open} disabled={disabled || saving} className="inline-flex items-center gap-1.5 font-semibold underline" onClick={() => setOpen(!open)}><CircleHelp aria-hidden size={16} className={!open && additionalDestination ? styles.nudge : undefined} />Add another employer</button>
    {open && <fieldset disabled={saving || disabled} className="mt-2 grid grid-cols-2 gap-2">
      <p className="col-span-2">Did this work somewhere else? Add the role to {scope} so your experience appears under the right employer.</p>
      <label>Company<input className={field} value={company} maxLength={150} onChange={e=>setCompany(e.target.value)} /></label>
      <label>Job title<input className={field} value={role} maxLength={150} onChange={e=>setRole(e.target.value)} /></label>
      <label>Start date<input className={field} type="month" value={start} onChange={e=>setStart(e.target.value)} /></label>
      <label>End date<input className={field} type="month" min={start} disabled={current} value={end} onChange={e=>setEnd(e.target.value)} /></label>
      <label className="col-span-2"><input type="checkbox" checked={current} onChange={e=>setCurrent(e.target.checked)} /> I currently work here</label>
      {additionalDestination && <label className="col-span-2"><input type="checkbox" checked={alsoSave} onChange={e=>setAlsoSave(e.target.checked)} /> {additionalDestination}</label>}
      <button type="button" disabled={!valid} className="rounded bg-black p-2 text-white disabled:opacity-40" onClick={save}>Save employer</button>
    </fieldset>}
  </div>;
}
