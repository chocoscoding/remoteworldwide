"use client";

import { FC, useRef, useState } from "react";
import { FileText, Link2, ScanSearch, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreApplication } from "@/app/lib/dashboard/ats-stub";
import { sourceBadgeLabel } from "@/app/components/dashboard/documents/DocumentsProvider";
import type { VaultDoc } from "@/app/components/dashboard/documents/DocumentsProvider";
import { Lottie } from "lottie-react";

/**
 * The front door: pick which resume to scan, then choose how to scan it.
 * No toolbar, no half-filled results behind it — the choice IS the screen.
 */
export interface AtsLandingProps {
  resumes: VaultDoc[];
  /** Registers the upload and returns the new entry so it can be selected. */
  onUpload: (file: File) => VaultDoc;
  onScoreGeneral: (resumeId: string) => void;
  onScoreVsJob: (resumeId: string) => void;
}

const AtsLanding: FC<AtsLandingProps> = ({ resumes, onUpload, onScoreGeneral, onScoreVsJob }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    const entry = onUpload(file);
    setSelectedId(entry.id);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="mx-auto flex min-h-[440px] max-w-[680px] flex-col items-center justify-center text-center">
      <span className="flex  items-center justify-center rounded-full">
        <Lottie
          src={`/Lottie/neobrutalism/View_Square_lottie.json`}
          autoplay
          loop
          className=""
          speed={0.63}
          style={{ width: 340, height: 340 }}
        />
      </span>

      <p className="mt-2 max-w-[500px] text-sm leading-relaxed text-black/50">
        {/* This is how applicant tracking systems read your resume. <br /> */}
        Pick one of your resume, then scan it on its own or against a specific job.
      </p>

      {/* Step 1 — which resume */}
      <div className="mt-2 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {resumes.map((r) => {
          const selected = r.id === selectedId;
          const badge = sourceBadgeLabel(r.source);
          const general = scoreApplication(r.id, undefined).score;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              aria-pressed={selected}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer",
                selected ? "border-[#222325] bg-[#f6faea]" : "border-black/10 bg-white hover:border-black/30",
              )}>
              <span
                className={cn(
                  "grid h-9 w-9 flex-none place-content-center rounded-lg",
                  selected ? "bg-[#222325] text-[#e1f073]" : "bg-[#f0f0ea] text-primary",
                )}>
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-primary">{r.name}</span>
                  {badge && (
                    <span className="flex-none rounded-full bg-[#f0f0ea] px-2 py-0.5 text-[10px] font-bold text-black/55">{badge}</span>
                  )}
                </span>
                <span className="block truncate text-xs text-black/45">{r.updatedLabel}</span>
              </span>
              <span className="flex-none text-right">
                <span className="block text-base font-bold text-primary tabular-nums">{general}</span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-black/35">General</span>
              </span>
            </button>
          );
        })}

        {/* Upload — any resume, whether or not it lives here. */}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-dashed border-black/20 bg-white p-3.5 text-left transition-colors hover:border-[#222325]">
          <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
            <Upload className="h-4 w-4 text-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-primary">Upload a resume</span>
            <span className="block text-xs text-black/45">PDF, DOCX or TXT</span>
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {/* Step 2 — how to scan it */}
      {selectedId && (
        <div className="mt-6 w-full">
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.09em] text-black/40">Scan it</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onScoreGeneral(selectedId)}
              className="group rounded-2xl border-[1.5px] border-[#222325] bg-[#222325] p-5 text-left text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[3px_3px_0_0_#e1f073] hover:shadow-[4px_4px_0_0_#e1f073] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
              <span className="grid h-9 w-9 place-content-center rounded-lg bg-white/10">
                <ScanSearch className="h-4 w-4 text-[#e1f073]" />
              </span>
              <span className="mt-3 block text-sm font-bold">General score</span>
              <span className="mt-1 block text-xs leading-relaxed text-white/55">How it reads for your niche — no job needed.</span>
            </button>
            <button
              type="button"
              onClick={() => onScoreVsJob(selectedId)}
              className="group rounded-2xl border-[1.5px] border-black/15 bg-white p-5 text-left cursor-pointer transition-[transform,box-shadow,border-color] duration-100 ease-out hover:border-[#222325] hover:shadow-[4px_4px_0_0_#222325] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
              <span className="grid h-9 w-9 place-content-center rounded-lg bg-[#f0f0ea]">
                <Link2 className="h-4 w-4 text-primary" />
              </span>
              <span className="mt-3 block text-sm font-bold text-primary">Against a job</span>
              <span className="mt-1 block text-xs leading-relaxed text-black/50">
                Pick a listing or paste any posting — we score the match.
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtsLanding;
