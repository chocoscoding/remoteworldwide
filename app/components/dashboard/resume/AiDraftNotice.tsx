"use client";
import type {ResumeContent} from "@/app/lib/dashboard/types";
import {pendingAiAdditions} from "@/app/lib/dashboard/resume/ai-additions";

/** One optional review list. No blocking fields or per-line tooltip wall. */
export function AiDraftNotice({content}: {content: ResumeContent}) {
  const additions=pendingAiAdditions(content);
  if (!additions.length) return null;
  return <details data-resume-highlight className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs print:hidden">
    <summary className="cursor-pointer font-semibold">Review {additions.length} AI-drafted change{additions.length===1 ? "" : "s"}</summary>
    <p className="my-2 text-black/65">Green text is AI-drafted and may include skills or results your original resume did not establish. Edit it directly on your resume. The score measures the draft as written.</p>
    <ul className="max-h-64 space-y-3 overflow-y-auto">
      {additions.map((item,index)=><li key={index}>
        <span className="font-semibold capitalize">{item.section === "role" ? "Employment title" : item.section}</span>
        {item.before && <p className="text-black/55">Before: {item.before}</p>}
        <p className="font-semibold text-[#34853a]">Draft: {item.after}</p>
      </li>)}
    </ul>
  </details>;
}
