"use client";

import { FC, ReactNode, useRef, useState } from "react";
import { BriefcaseBusiness, Check, FileText, ScanSearch, Search, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VaultDoc } from "@/app/components/dashboard/documents/DocumentsProvider";
import type { UploadProgress } from "@/hooks/mutations/useDocumentMutations";

/**
 * The front door: choose how to scan, pick a resume, press Scan.
 *
 * A job link already decides what to score against. The resume choice comes
 * first, followed by a single scoring action and the selected resume's name.
 *
 * The resumes are one list, not a grid of cards (owner, 2026-10-09): with
 * uploads and every resume built here side by side there can be dozens, so it
 * scrolls past about five rows and a search box filters it by name. Uploading
 * is the list's first row, and stays first while searching.
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
   * job ticket then names it, and `onScoreVsJob` scores against it instead
   * of opening the picker. Null or absent: the ticket asks for one.
   */
  job?: { company: string; role: string } | null;
  /** Registers the upload, reporting progress, and returns the new entry so it can be selected. */
  onUpload: (file: File, progress?: UploadProgress) => Promise<VaultDoc | null>;
  onScoreGeneral: (resumeId: string) => void;
  onScoreVsJob: (resumeId: string) => void;
}

type Mode = "general" | "job";

/** A file on its way up: `fraction` is how much has gone out; at 1 the server is still reading it. */
interface Uploading {
  name: string;
  fraction: number;
}

const AtsLanding: FC<AtsLandingProps> = ({ resumes, scores, job = null, onUpload, onScoreGeneral, onScoreVsJob }) => {
  const [chosenMode, setMode] = useState<Mode>("general");
  const mode: Mode = job ? "job" : chosenMode;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState<Uploading | null>(null);
  // The file just uploaded: shown first and marked, even before the list refetch brings it in.
  const [recent, setRecent] = useState<VaultDoc | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<AbortController | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file || uploading) return;
    // Cleared straight away so picking the same file twice still fires a change.
    if (fileRef.current) fileRef.current.value = "";
    const controller = new AbortController();
    cancelRef.current = controller;
    setUploading({ name: file.name, fraction: 0 });
    try {
      const entry = await onUpload(file, {
        signal: controller.signal,
        onProgress: (fraction) => setUploading((u) => (u ? { ...u, fraction } : u)),
      });
      if (entry) {
        setRecent(entry);
        setSelectedId(entry.id);
        // A search that would hide the new file is cleared, so the pick is visible.
        setQuery("");
      }
    } finally {
      cancelRef.current = null;
      setUploading(null);
    }
  }

  const listed = recent && !resumes.some((r) => r.id === recent.id) ? [recent, ...resumes] : resumes;
  const ordered = recent ? [...listed.filter((r) => r.id === recent.id), ...listed.filter((r) => r.id !== recent.id)] : listed;
  const needle = query.trim().toLowerCase();
  const shown = needle ? ordered.filter((r) => r.name.toLowerCase().includes(needle)) : ordered;
  const selected = ordered.find((r) => r.id === selectedId) ?? null;

  const jobLabel = job ? `${job.role} at ${job.company}` : null;

  function scan() {
    if (!selected) return;
    if (mode === "general") onScoreGeneral(selected.id);
    else onScoreVsJob(selected.id);
  }

  const pct = uploading ? Math.round(uploading.fraction * 100) : 0;
  const reading = uploading != null && uploading.fraction >= 1;

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 py-4 text-left">
      <div>
        <h2 className="text-2xl font-extrabold text-primary">{job ? "Choose a resume to score" : "Check your resume"}</h2>
        <p className="mt-1 text-sm text-black/55">Select a resume, then start your score. Selecting a resume does not start a scan.</p>
      </div>

      {/* How to scan */}
      {job ? (
        <div className="flex items-start gap-3 rounded-xl border border-black/10 bg-white p-4">
          <BriefcaseBusiness className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="text-xs font-semibold text-black/50">Scoring against this job</p><p className="text-sm font-bold text-primary">{jobLabel}</p></div>
        </div>
      ) : <div role="radiogroup" aria-label="How to scan" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Ticket
          checked={mode === "general"}
          onSelect={() => setMode("general")}
          icon={<ScanSearch className="h-5 w-5" />}
          title="General score"
          copy="How it reads on its own: structure, impact and length. No job needed."
        />
        <Ticket
          checked={mode === "job"}
          onSelect={() => setMode("job")}
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          title={job ? "Against this job" : "Against a job"}
          copy={jobLabel ? `${jobLabel}. We score the match.` : "Pick a saved listing or paste any posting, and we score the match."}
        />
      </div>}

      {/* Which resume */}
      <div className="overflow-hidden rounded-[14px] border border-black/10 bg-white">
        {/* Search shows past three resumes (owner, 2026-10-18). */}
        {ordered.length > 3 && (
          <label className="flex items-center gap-2 border-b border-black/8 px-4">
            <Search aria-hidden className="h-4 w-4 flex-none text-black/35" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${ordered.length} resumes`}
              aria-label="Search your resumes"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-black/35"
            />
          </label>
        )}

        {/* Upload: always the first row, searching or not. */}
        {uploading ? (
          <div className="flex flex-col gap-2 border-b border-black/8 bg-[#fbfbf7] px-4 py-3" aria-live="polite">
            <div className="flex items-center gap-3">
              <span className="grid h-[34px] w-[34px] flex-none place-content-center rounded-[9px] border-[1.5px] border-dashed border-black/35">
                <Upload className="h-4 w-4 text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-primary">
                  {reading ? "Reading" : "Uploading"} {uploading.name}
                </span>
                <span className="block text-xs text-black/50">
                  {reading ? "Almost there. It joins your list when it's done." : `${pct}% · it joins your list when it's done`}
                </span>
              </span>
              {!reading && (
                <button
                  type="button"
                  onClick={() => cancelRef.current?.abort()}
                  className="flex-none cursor-pointer text-[13px] font-bold text-primary underline underline-offset-[3px]">
                  Cancel
                </button>
              )}
            </div>
            <div
              role="progressbar"
              aria-label={`Uploading ${uploading.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="h-1.5 overflow-hidden rounded-full bg-[#ebebe4]">
              <div
                className={cn("h-full rounded-full bg-[#222325] transition-[width] duration-200", reading && "animate-pulse")}
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-3 border-b border-black/8 px-4 py-3 transition-colors hover:bg-[#fbfbf7]">
            <span className="grid h-[34px] w-[34px] flex-none place-content-center rounded-[9px] border-[1.5px] border-dashed border-black/35">
              <Upload className="h-4 w-4 text-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-primary">Upload a resume</span>
              <span className="block text-xs text-black/50">PDF, DOC or DOCX</span>
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        )}

        <div role="listbox" aria-label="Your resumes" className="max-h-[320px] overflow-y-auto">
          {shown.map((r) => {
            const isSelected = r.id === selectedId;
            const isRecent = r.id === recent?.id;
            const general = scores.get(r.id);
            return (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 border-b border-black/6 px-4 py-2.5 text-left transition-colors last:border-b-0",
                  isSelected ? "bg-[#f1f8c4] ring-2 ring-inset ring-[#697719]" : "hover:bg-[#fbfbf7]",
                )}>
                <span
                  className={cn(
                    "grid h-[34px] w-[34px] flex-none place-content-center rounded-[9px]",
                    isSelected ? "bg-[#222325] text-[#e1f073]" : "bg-[#f0f0ea] text-primary",
                  )}>
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-primary">{r.name}</span>
                  {isRecent ? (
                    <span className="block text-xs font-semibold text-[#39390ec4]">Uploaded just now</span>
                  ) : (
                    <span className="block truncate text-xs text-black/50">{r.updatedLabel}</span>
                  )}
                </span>
                <span className="flex-none text-right">
                  {isSelected ? (
                    <span aria-label="Selected" className="grid h-6 w-6 place-content-center rounded-full bg-[#222325]">
                      <Check aria-hidden className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </span>
                  ) : general == null ? (
                    <span aria-hidden className="block h-6 w-6 rounded-full border-2 border-black/20" />
                  ) : (
                    <>
                      <span className="block text-[15px] font-extrabold text-primary tabular-nums">{general}</span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-black/35">General</span>
                    </>
                  )}
                </span>
              </button>
            );
          })}
          {shown.length === 0 && needle && <p className="px-4 py-4 text-sm text-black/45">No resume matches “{query.trim()}”.</p>}
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-black/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-black/60" aria-live="polite">
          {selected ? <>Selected: <strong className="text-primary">{selected.name}</strong></> : "Select one resume above to continue."}
        </p>
        <button type="button" onClick={scan} disabled={!selected || !!uploading}
          className="min-h-12 shrink-0 rounded-xl border border-[#222325] bg-[#e1f073] px-6 text-sm font-extrabold text-primary shadow-[3px_3px_0_#222325] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-black/5 disabled:text-black/40 disabled:shadow-none">
          {selected ? mode === "job" ? "Score against this job" : "Score this resume" : "Choose a resume to continue"}
        </button>
      </div>
    </div>
  );
};

/** One way to scan, drawn as a ticket: an icon stub, a dashed tear line, the title and a radio dot. */
const Ticket: FC<{ checked: boolean; onSelect: () => void; icon: ReactNode; title: string; copy: string }> = ({
  checked,
  onSelect,
  icon,
  title,
  copy,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={checked}
    onClick={onSelect}
    className={cn(
      "flex overflow-hidden rounded-[14px] text-left",
      checked ? "bg-[#222325] text-white br-bold br-lime" : "bg-white text-primary br-plain-press",
    )}>
    <span
      className={cn(
        "grid w-16 flex-none place-content-center border-r-2 border-dashed",
        checked ? "border-white/25 text-[#e1f073]" : "border-black/15 text-primary",
      )}>
      {icon}
    </span>
    <span className="flex flex-1 flex-col gap-1 p-[18px]">
      <span className="flex items-center justify-between gap-3">
        <span className="text-base font-extrabold">{title}</span>
        <span
          aria-hidden
          className={cn(
            "grid h-[18px] w-[18px] flex-none place-content-center rounded-full border-2",
            checked ? "border-[#e1f073]" : "border-black/30",
          )}>
          {checked && <span className="h-2 w-2 rounded-full bg-[#e1f073]" />}
        </span>
      </span>
      <span className={cn("text-[13px] leading-[1.45]", checked ? "text-white/65" : "text-black/55")}>{copy}</span>
    </span>
  </button>
);

export default AtsLanding;
