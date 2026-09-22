"use client";

import { useRef, useState, type FC, type ReactNode } from "react";
import { FilePlus2, FileText, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import TimeAgo from "timeago-react";
import { Lottie } from "lottie-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { BUILD_CREDITS, RESUME_ACCEPT } from "@/app/lib/resume/api";
import { isStaleCheck, type ResumeDocument } from "./resume-document";

export interface ResumeLandingProps {
  /**
   * Whether the user's saved resumes are in. Until they are, the two ways to
   * start are held back as well as the list: a resume made before the list
   * arrives would be seeded over when it did.
   */
  library: "loading" | "error" | "ready";
  /** Ask for the list again — offered when `library` is "error". */
  onRetry?: () => void;
  documents: ResumeDocument[];
  /** Open an existing document in the editor. */
  onOpen?: (id: string) => void;
  /**
   * Create a blank document with this name in the library and open it.
   * Resolves either way; a refusal is one the caller has already reported.
   */
  onCreateBlank?: (label: string) => Promise<void>;
  /**
   * Read the file, parse it, and open the draft. Takes the File itself: the
   * import is of what the resume SAYS, so the bytes have to leave this
   * component. Resolves when the draft is open, or on a refusal the caller
   * has already reported.
   */
  onImport?: (file: File) => Promise<void>;
  /** Delete a document from the library, for good. Same contract as the two above. */
  onDelete?: (id: string) => Promise<void>;
  /** Open "Build with AI". The caller owns the dialog and opens what it builds. */
  onBuild?: () => void;
  banner?: ReactNode;
}

const ResumeLanding: FC<ResumeLandingProps> = ({ library, onRetry, documents, onOpen, onCreateBlank, onImport, onDelete, onBuild, banner }) => {
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  // Deleting is two clicks on purpose — there is no undo behind it.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const ready = library === "ready";

  async function create() {
    if (!onCreateBlank || creating) return;
    setCreating(true);
    try {
      // The name stays in the box until the document exists: a failed create
      // should not also cost them what they typed.
      await onCreateBlank(label.trim() || "New resume");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!onDelete || deleting) return;
    setDeleting(id);
    try {
      await onDelete(id);
    } finally {
      setDeleting(null);
      setConfirmingDelete(null);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file || importing || !onImport) return;
    // Cleared before the await, not after: picking the same file again must
    // fire a fresh change event even when the first attempt failed.
    if (fileRef.current) fileRef.current.value = "";
    setImporting(true);
    try {
      await onImport(file);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <div className="mx-auto flex min-h-screen max-w-[680px] flex-col items-center justify-center px-6 py-12 text-center">
        {banner && <div className="mb-2 w-full">{banner}</div>}
        <span aria-hidden className="flex items-center justify-center">
          <Lottie src={`/Lottie/neobrutalism/Edit_Contract_lottie.json`} autoplay loop speed={0.63} style={{ width: 300, height: 300 }} />
        </span>

        <h1 className="text-[22px] font-bold text-primary leading-tight">Let&apos;s build the resume that gets you hired</h1>
        {/* <p className="mt-2 max-w-[440px] text-sm leading-relaxed text-black/50">
          Start one from scratch, bring in a resume you already have, or keep polishing one you made here.
        </p> */}

        {/* The ways to start fresh */}
        <div className="mt-5 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setNaming((v) => !v)}
            aria-expanded={naming}
            disabled={!ready}
            className="group rounded-2xl border-[1.5px] border-[#222325] bg-[#222325] p-5 text-left text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[3px_3px_0_0_#e1f073] hover:shadow-[4px_4px_0_0_#e1f073] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:pointer-events-none disabled:opacity-50">
            <span className="grid h-9 w-9 place-content-center rounded-lg bg-white/10">
              <FilePlus2 className="h-4 w-4 text-[#e1f073]" />
            </span>
            <span className="mt-3 block text-sm font-bold">Start from scratch</span>
            <span className="mt-1 block text-xs leading-relaxed text-white/55">A blank page with the default look — name it and go.</span>
          </button>

          <label
            aria-busy={importing}
            className={cn(
              "group rounded-2xl border-[1.5px] border-black/15 bg-white p-5 text-left transition-[transform,box-shadow,border-color] duration-100 ease-out",
              !ready
                ? "pointer-events-none opacity-50"
                : importing
                  ? "cursor-wait opacity-70"
                  : "cursor-pointer hover:border-[#222325] hover:shadow-[4px_4px_0_0_#222325] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
            )}>
            <span className="grid h-9 w-9 place-content-center rounded-lg bg-[#f0f0ea]">
              {importing ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Upload className="h-4 w-4 text-primary" />}
            </span>
            <span className="mt-3 block text-sm font-bold text-primary">
              {importing ? "Reading your resume…" : "Start from a resume you have"}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-black/50">
              {importing ? "Pulling out your experience, education and skills." : "Upload a PDF, DOCX, TXT or MD — we turn it into an editable draft."}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept={RESUME_ACCEPT}
              disabled={importing || !ready}
              className="sr-only"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </label>

          {onBuild && (
            <button
              type="button"
              onClick={onBuild}
              disabled={!ready}
              className="group flex items-center gap-4 rounded-2xl border-[1.5px] border-[#222325] bg-[#e1f073] p-5 text-left text-primary cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[3px_3px_0_0_#222325] hover:shadow-[4px_4px_0_0_#222325] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:pointer-events-none disabled:opacity-50 sm:col-span-2">
              <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#222325]">
                <Sparkles className="h-4 w-4 text-[#e1f073]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Build with AI</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-black/60">
                  Tell it the role — it writes a tailored resume from your profile or the resume you imported.
                </span>
              </span>
              <span className="flex-none rounded-full bg-[#222325] px-2.5 py-1 text-[11px] font-bold text-white">{BUILD_CREDITS} credits</span>
            </button>
          )}
        </div>

        {/* Step 2 of "start from scratch" — reveal, don't modal */}
        {naming && (
          <div className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border-[1.5px] border-[#222325] bg-white p-3 shadow-[3px_3px_0_0_#222325]">
            <input
              type="text"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
              }}
              maxLength={80}
              placeholder="Name it — e.g. Stripe — Senior Designer"
              className="min-w-0 flex-1 rounded-xl border border-black/12 bg-[#fbfbf7] px-4 py-2.5 text-sm text-primary placeholder:text-black/35 outline-none focus:border-black/30 transition-colors"
            />
            <StickerButton type="button" variant="primary" size="md" disabled={creating} onClick={() => void create()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              {creating ? "Creating…" : "Create"}
            </StickerButton>
          </div>
        )}

        {/* The library, while it is on its way or when it did not arrive */}
        {library === "loading" && (
          <p className="mt-8 flex items-center gap-2 text-xs text-black/45">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading your resumes…
          </p>
        )}
        {library === "error" && (
          <p className="mt-8 text-xs text-black/55">
            We couldn&apos;t load your resumes.{" "}
            <button type="button" onClick={onRetry} className="cursor-pointer font-bold text-primary underline decoration-2 underline-offset-2">
              Try again
            </button>
          </p>
        )}

        {/* The old ones */}
        {documents.length > 0 && (
          <div className="mt-8 w-full">
            <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.09em] text-black/40">Or pick up where you left off</p>
            <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
              {documents.map((d) => {
                const confirming = confirmingDelete === d.id;
                return (
                  // A row, not one big button: it holds two actions, and a
                  // button cannot contain another.
                  <div
                    key={d.id}
                    className={cn(
                      "group flex items-center rounded-xl border bg-white transition-colors",
                      confirming ? "border-[#b23c26]" : "border-black/10 hover:border-[#222325] focus-within:border-[#222325]",
                      deleting === d.id && "opacity-50",
                    )}>
                    <button
                      type="button"
                      onClick={() => onOpen?.(d.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left cursor-pointer">
                      <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#f0f0ea] text-primary">
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-primary">{d.label}</span>
                        <span className="block truncate text-xs text-black/45">
                          {d.check ? (
                            <>
                              {d.check.job ? `against ${d.check.job}` : "general"} ·{" "}
                              {isStaleCheck(d) ? "edited since it was scanned" : <>scanned <TimeAgo datetime={d.check.at} opts={{ minInterval: 10 }} /></>}
                            </>
                          ) : (
                            <>
                              edited <TimeAgo datetime={d.updatedAt} opts={{ minInterval: 10 }} />
                            </>
                          )}
                        </span>
                      </span>
                      {/* A score only where a check stands — a column of dashes says nothing.
                          Greyed once the resume has been edited past it: it is still
                          the score that text got, but no longer this resume's. */}
                      {d.check && !confirming && (
                        <span className="flex-none text-right">
                          <span className={cn("block text-base font-bold tabular-nums", isStaleCheck(d) ? "text-black/30" : "text-primary")}>
                            {d.check.report.score}
                          </span>
                          <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-black/35">ATS</span>
                        </span>
                      )}
                    </button>

                    {confirming ? (
                      <span className="flex flex-none items-center gap-2.5 pr-3.5 text-xs font-bold">
                        <button
                          type="button"
                          disabled={deleting !== null}
                          onClick={() => void remove(d.id)}
                          className="cursor-pointer text-[#b23c26] underline decoration-2 underline-offset-2 disabled:opacity-50">
                          {deleting === d.id ? "Deleting…" : "Delete for good"}
                        </button>
                        <button
                          type="button"
                          disabled={deleting !== null}
                          onClick={() => setConfirmingDelete(null)}
                          className="cursor-pointer text-black/50 underline decoration-2 underline-offset-2 disabled:opacity-50">
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Delete ${d.label}`}
                        onClick={() => setConfirmingDelete(d.id)}
                        className="mr-2.5 grid h-7 w-7 flex-none place-content-center rounded-md text-black/35 opacity-0 transition-[opacity,color,background-color] cursor-pointer hover:bg-[#f6e4df] hover:text-[#b23c26] focus-visible:opacity-100 group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeLanding;
