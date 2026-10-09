"use client";

import { FC, useRef, useState } from "react";
import { FileText, Link2, ScanSearch, Search, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { sourceBadgeLabel } from "@/app/components/dashboard/documents/DocumentsProvider";
import type { VaultDoc } from "@/app/components/dashboard/documents/DocumentsProvider";
import { Lottie } from "lottie-react";

/**
 * The front door: pick which resume to scan, then choose how to scan it.
 * No toolbar, no half-filled results behind it — the choice IS the screen.
 *
 * The resumes are one list, not a grid of cards (owner, 2026-10-09): with
 * uploads and every resume built here side by side there can be dozens, so it
 * scrolls past about five rows and a search box filters it by name.
 */
export interface AtsLandingProps {
  resumes: VaultDoc[];
  /**
   * General scores from scans run this session, by document id.
   *
   * Only ever what has actually been scored. A score costs a credit, so this
   * screen cannot put a number beside every resume the way a mock could —
   * rendering twelve cards would have meant twelve charged scans. A resume
   * nobody has scored says so.
   */
  scores: ReadonlyMap<string, number>;
  /**
   * A job already chosen for this visit, by a link from its own screen. The
   * second card then names it, and `onScoreVsJob` scores against it instead
   * of opening the picker. Null or absent: the card asks for one.
   */
  job?: { company: string; role: string } | null;
  /** Registers the upload and returns the new entry so it can be selected. */
  onUpload: (file: File) => Promise<VaultDoc | null>;
  onScoreGeneral: (resumeId: string) => void;
  onScoreVsJob: (resumeId: string) => void;
}

const AtsLanding: FC<AtsLandingProps> = ({ resumes, scores, job = null, onUpload, onScoreGeneral, onScoreVsJob }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    // Cleared straight away so picking the same file twice still fires a change.
    if (fileRef.current) fileRef.current.value = "";
    const entry = await onUpload(file);
    if (entry) setSelectedId(entry.id);
  }

  const needle = query.trim().toLowerCase();
  const shown = needle ? resumes.filter((r) => r.name.toLowerCase().includes(needle)) : resumes;

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
      <div className="mt-3 w-full text-left">
        {/* Upload — any resume, whether or not it lives here. */}
        <label
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-dashed border-black/20 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-[#222325]",
            resumes.length > 0 && "mt-2.5",
          )}>
          <span className="grid h-8 w-8 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
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
        <br />
        {resumes.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
            {/* Search shows once the list is long enough to need it. */}
            {resumes.length > 4 && (
              <label className="flex items-center gap-2 border-b border-black/8 px-3.5">
                <Search aria-hidden className="h-4 w-4 flex-none text-black/35" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${resumes.length} resumes`}
                  aria-label="Search your resumes"
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-black/35"
                />
              </label>
            )}
            <div role="listbox" aria-label="Your resumes" className="max-h-[300px] overflow-y-auto">
              {shown.map((r) => {
                const selected = r.id === selectedId;
                const badge = sourceBadgeLabel(r.source);
                const general = scores.get(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 border-b border-black/6 px-3.5 py-2.5 text-left transition-colors last:border-b-0",
                      selected ? "bg-[#f6faea]" : "hover:bg-[#fbfbf7]",
                    )}>
                    <span
                      className={cn(
                        "grid h-8 w-8 flex-none place-content-center rounded-lg",
                        selected ? "bg-[#222325] text-[#e1f073]" : "bg-[#f0f0ea] text-primary",
                      )}>
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-primary">{r.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-black/45">
                        {badge && <span className="font-semibold text-black/55">{badge}</span>}
                        {badge && <span aria-hidden>·</span>}
                        <span className="truncate">{r.updatedLabel}</span>
                      </span>
                    </span>
                    <span className="flex-none text-right">
                      {general == null ? (
                        <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-black/30">Not scored</span>
                      ) : (
                        <>
                          <span className="block text-base font-bold text-primary tabular-nums">{general}</span>
                          <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-black/35">General</span>
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
              {shown.length === 0 && <p className="px-3.5 py-4 text-sm text-black/45">No resume matches “{query.trim()}”.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Step 2 — how to scan it */}
      {selectedId && (
        <div className="mt-6 w-full">
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.09em] text-black/40">Scan it</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onScoreGeneral(selectedId)}
              className="group rounded-2xl bg-[#222325] p-5 text-left text-white cursor-pointer br-shadow-press br-lime">
              <span className="grid h-9 w-9 place-content-center rounded-lg bg-white/10">
                <ScanSearch className="h-4 w-4 text-[#e1f073]" />
              </span>
              <span className="mt-3 block text-sm font-bold">General score</span>
              <span className="mt-1 block text-xs leading-relaxed text-white/55">How it reads for your niche. No job needed.</span>
            </button>
            <button
              type="button"
              onClick={() => onScoreVsJob(selectedId)}
              className="group rounded-2xl bg-white p-5 text-left cursor-pointer br-plain-press">
              <span className="grid h-9 w-9 place-content-center rounded-lg bg-[#f0f0ea]">
                <Link2 className="h-4 w-4 text-primary" />
              </span>
              <span className="mt-3 block text-sm font-bold text-primary">{job ? "Against this job" : "Against a job"}</span>
              <span className="mt-1 block text-xs leading-relaxed text-black/50">
                {job
                  ? `${job.role} at ${job.company}. We score the match.`
                  : "Pick a listing or paste any posting, and we score the match."}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtsLanding;
