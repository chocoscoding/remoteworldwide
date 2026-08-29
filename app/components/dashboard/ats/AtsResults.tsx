"use client";

import { FC, useState } from "react";
import { Check, ChevronDown, Download, FileText, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { scoreApplication, scoreTier } from "@/app/lib/dashboard/ats-stub";
import { ATS_FIX_ITEMS, ATS_KEYWORDS } from "@/app/lib/dashboard/mock-data";
import type { JobOption } from "@/app/lib/dashboard/job-options";
import type { VaultDoc } from "@/app/components/dashboard/documents/DocumentsProvider";

/**
 * The scan report. The number is computed live from the picked resume and
 * (optionally) job, and every fix on the page moves it — acting on feedback
 * and watching the score respond is the loop this screen exists for.
 */
export interface AtsResultsProps {
  resume: VaultDoc;
  resumes: VaultDoc[];
  job: JobOption | null;
  fixedIds: Set<string>;
  queuedKeywordIds: Set<string>;
  onToggleFix: (id: string) => void;
  onToggleKeyword: (id: string) => void;
  onChangeResume: (id: string) => void;
  onChangeJob: () => void;
  onRemoveJob: () => void;
  onExit: () => void;
}

/** Client-side lifts for applied fixes — the seam a real rescoring pass fills. */
const FIX_LIFT = 3;
const KEYWORD_LIFT = 2;
const KEYWORD_METRIC_LIFT = 6;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const AtsResults: FC<AtsResultsProps> = ({
  resume,
  resumes,
  job,
  fixedIds,
  queuedKeywordIds,
  onToggleFix,
  onToggleKeyword,
  onChangeResume,
  onChangeJob,
  onRemoveJob,
  onExit,
}) => {
  const [keywordsOpen, setKeywordsOpen] = useState(true);
  const [reportDownloaded, setReportDownloaded] = useState(false);

  const base = scoreApplication(resume.id, job?.jdText);
  const lift = fixedIds.size * FIX_LIFT + queuedKeywordIds.size * KEYWORD_LIFT;
  const displayed = clamp(base.score + lift, 0, 100);
  const tier = scoreTier(displayed);

  const metrics = base.metrics.map((m) =>
    m.id === "keyword-match" ? { ...m, value: clamp(m.value + queuedKeywordIds.size * KEYWORD_METRIC_LIFT, 0, 100) } : m
  );

  // In job mode the stub returns only the top missing keywords; everything
  // else renders as present. Close enough for a mock, and marked as such.
  const missing = job ? base.gaps : ATS_KEYWORDS.filter((k) => !k.present);
  const present = ATS_KEYWORDS.filter((k) => !missing.some((g) => g.id === k.id));

  function handleDownload() {
    setReportDownloaded(true);
    window.setTimeout(() => setReportDownloaded(false), 2000);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Context bar — what's being scored, and every way to change it. */}
      <DashCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 flex-none place-content-center rounded-full bg-[#f0f0ea]">
            <FileText className="h-4 w-4 text-primary" />
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-black/50">
              Scoring
              <select
                aria-label="Resume being scored"
                value={resume.id}
                onChange={(e) => onChangeResume(e.target.value)}
                className="cursor-pointer rounded-lg border border-black/15 bg-white px-2 py-1.5 text-sm font-bold text-primary outline-none focus:border-[#222325]">
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            {job ? (
              <>
                <span className="text-sm text-black/50">against</span>
                <Pill variant="active">
                  {job.company} · {job.role}
                </Pill>
              </>
            ) : (
              <Pill variant="neutral">General · your niche</Pill>
            )}
          </div>
          <div className="flex flex-none items-center gap-2">
            <StickerButton variant="outline" size="sm" onClick={onChangeJob}>
              <Link2 className="h-3.5 w-3.5" />
              {job ? "Change job" : "Score against a job"}
            </StickerButton>
            {job && (
              <StickerButton variant="outline" size="sm" onClick={onRemoveJob}>
                General instead
              </StickerButton>
            )}
            <button
              type="button"
              onClick={onExit}
              aria-label="Back to resume choice"
              title="Score a different resume"
              className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg border-[1.5px] border-[#222325] bg-white text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#222325] hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </DashCard>

      {/* Score card */}
      <DashCard className="p-7">
        <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.1em] text-black/35">
          {job ? `Scored against ${job.company} · ${job.role}` : "General score · what your niche screens for"}
        </p>
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
          <div className="relative flex-none">
            <ScoreRing value={displayed} size={164} />
            {lift > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full border-[1.5px] border-[#222325] bg-[#e1f073] px-2 py-0.5 text-xs font-bold text-[#222325] tabular-nums">
                +{lift}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-4 text-center sm:items-start sm:text-left">
            <div>
              <Pill variant={tier.tone} className="mb-2.5">
                {tier.label}
              </Pill>
              <p className="max-w-md text-[15px] leading-relaxed text-black/70">
                {job
                  ? `How ${resume.name} matches this posting. Work the fixes below and the number moves with you.`
                  : `How ${resume.name} reads for Senior Product Design roles in general — the keywords and structure those screens usually check for.`}
              </p>
            </div>
            <StickerButton variant="outline" size="md" onClick={handleDownload}>
              {reportDownloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {reportDownloaded ? "Report saved" : "Download report"}
            </StickerButton>
          </div>
        </div>
      </DashCard>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {metrics.map((m) => (
          <DashCard key={m.id} className="p-4">
            <p className="mb-2 text-xs font-semibold text-black/45">{m.label}</p>
            <p className="mb-2.5 text-2xl font-bold text-primary tabular-nums">{m.value}%</p>
            <ProgressBar value={m.value} fillColor={m.value >= 80 ? "#e1f073" : "#cddd54"} height="h-1.5" />
          </DashCard>
        ))}
      </div>

      {/* Fixes — each one moves the score, and moves it back if undone. */}
      <DashCard className="p-0 overflow-hidden">
        <div className="border-b border-black/8 px-6 py-4">
          <p className="text-[15px] font-bold text-primary">Fix these three</p>
          <p className="mt-0.5 text-xs text-black/45">Each fix adds +{FIX_LIFT} to your score. Undo takes it back.</p>
        </div>
        {ATS_FIX_ITEMS.map((item) => {
          const fixed = fixedIds.has(item.id);
          return (
            <div key={item.id} className="flex items-center gap-4 border-b border-black/6 px-6 py-4 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-bold", fixed ? "text-black/40 line-through" : "text-primary")}>{item.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-black/50">{item.detail}</p>
              </div>
              <StickerButton variant={fixed ? "outline" : "primary"} size="sm" className="flex-none" onClick={() => onToggleFix(item.id)}>
                {fixed ? "Undo" : item.action}
              </StickerButton>
            </div>
          );
        })}
      </DashCard>

      {/* Keywords — honest about where they come from. */}
      <DashCard className="p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setKeywordsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left cursor-pointer">
          <div>
            <p className="text-[15px] font-bold text-primary">
              {job ? "Keywords from the job description" : "Common keywords in your niche"}
            </p>
            <p className="mt-0.5 text-xs text-black/45">
              {present.length} in your resume · {missing.length} missing
            </p>
          </div>
          <ChevronDown className={cn("h-4 w-4 flex-none text-black/40 transition-transform", keywordsOpen && "rotate-180")} />
        </button>
        {keywordsOpen && (
          <div className="border-t border-black/8 px-6 py-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {present.map((k) => (
                <span key={k.id} className="rounded-lg bg-[#e1f073] px-3 py-1.5 text-xs font-semibold text-primary">
                  {k.label}
                </span>
              ))}
              {missing.map((k) => {
                const queued = queuedKeywordIds.has(k.id);
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => onToggleKeyword(k.id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                      queued
                        ? "bg-[#e1f073] text-primary"
                        : "border border-dashed border-black/30 text-black/50 hover:border-[#222325] hover:text-primary"
                    )}>
                    {queued ? `✓ ${k.label}` : `+ ${k.label}`}
                  </button>
                );
              })}
            </div>
            <p className="border-t border-black/8 pt-3.5 text-xs leading-relaxed text-black/50">
              Solid means it&apos;s in your resume. Dashed means it isn&apos;t — tap one to queue it, and only add what&apos;s
              honestly true of your work.
            </p>
          </div>
        )}
      </DashCard>
    </div>
  );
};

export default AtsResults;
