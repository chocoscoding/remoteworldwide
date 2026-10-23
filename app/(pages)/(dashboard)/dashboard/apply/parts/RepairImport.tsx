"use client";

import { useState } from "react";
import { apiPost } from "@/app/lib/api/client";
import { apiMessage } from "@/app/lib/api/core";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { repairWorkHeaders } from "@/app/lib/apply/import-repair";

export default function RepairImport({ sourceId, current, onUse }: { sourceId: string; current: ResumeContent; onUse: (content: ResumeContent) => Promise<unknown> }) {
  const [preview, setPreview] = useState<{ sourceId: string; before: ResumeContent; after: ResumeContent } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = preview?.sourceId === sourceId && preview.before === current ? preview : null;
  const headersOnly = shown ? repairWorkHeaders(current, shown.after) : null;
  async function read() {
    setBusy(true); setError(null);
    try {
      const result = await apiPost<{ after: ResumeContent }>(`/api/ai/resume/${sourceId}/repair-preview`);
      setPreview({ sourceId, before: current, after: result.after });
    } catch (e) { setError(apiMessage(e)); } finally { setBusy(false); }
  }
  return <section className="rounded-xl border p-3 text-sm">
    <button type="button" disabled={busy} onClick={() => void read()} className="font-bold underline">{busy ? "Reading original…" : "Preview a fresh import from the original"}</button>
    {error && <p role="alert">{error}</p>}
    {shown && <div className="mt-3 space-y-3">
      <p>Review both versions. You can correct matched job titles and employers while keeping your edits, or replace the full draft with the fresh import. Both actions can be undone.</p>
      <div className="grid gap-3 md:grid-cols-2">{([{ label: "Current draft", content: shown.before }, { label: "Proposed import", content: shown.after }]).map(side => <div key={side.label}>
        <strong>{side.label}</strong><p>{side.content.title}</p><p>{side.content.summary}</p>
        {side.content.experience.map((job, i) => <div className="my-3" key={job.id || i}><strong>{job.role} · {job.company || "Employer not identified"}</strong><p>{job.dates}</p><ul className="list-disc pl-5">{job.bullets.map((bullet, n) => <li key={n}>{bullet}</li>)}</ul></div>)}
        <details><summary>All imported fields</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(side.content, null, 2)}</pre></details>
      </div>)}</div>
      {headersOnly && <button type="button" disabled={busy} className="mr-3 rounded bg-primary px-3 py-2 text-white" onClick={() => { setBusy(true); void onUse(headersOnly).then(result => { if (result) setPreview(null); }).catch(e => setError(apiMessage(e))).finally(() => setBusy(false)); }}>Correct titles and employers only</button>}
      <button type="button" disabled={busy} className="rounded border px-3 py-2" onClick={() => { setBusy(true); void onUse(shown.after).then(result => { if (result) setPreview(null); }).catch(e => setError(apiMessage(e))).finally(() => setBusy(false)); }}>Use full reviewed import</button>
      <button type="button" className="ml-3 underline" onClick={() => setPreview(null)}>Keep current draft</button>
    </div>}
  </section>;
}
