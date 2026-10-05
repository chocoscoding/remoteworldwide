"use client";

// Step 1, OPTIONAL: start from a resume in My documents — picked, uploaded,
// or saved from the editor — and have it read, so step 2 starts filled in.
// Not a checklist item (owner, 2026-09-26): a resume can be built from the
// profile, so someone without one says "Skip — I'll fill it in", the step
// folds to one line and the page takes them to the form.
//
// Three ways in, one way out: whichever it is, it ends as a vault document
// (where the extension attaches from) and as `ResumeContent` handed up to
// prefill the profile's blank fields.
//
// Reading goes through `/api/ats/resume-for-doc` (free, deduped, remembered on
// the document), exactly as "Edit a copy" does. A built resume skips it: its
// content is already structured, and re-reading its own PDF could only lose
// detail. A read that fails costs nothing but the prefill — the file is in the
// vault either way, and the fields below can be typed.

import { useState, type DragEvent, type FC } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowDown, ArrowUpRight, Check, FileText, FileUp, LoaderCircle, PenLine, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiMessage } from "@/app/lib/api/core";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import type { ResumeContent, VaultDoc } from "@/app/lib/dashboard/types";
import { listResumeDocuments, type StoredResumeDocument } from "@/app/lib/resume/api";
import { READ_RESUME_KEY, readVaultResume, saveBuiltResumeToVault } from "@/app/lib/onboarding/api";
import { useDocumentsQuery } from "@/hooks/queries/useDocumentsQuery";
import { MAX_UPLOAD_BYTES, useUploadDocument } from "@/hooks/mutations/useDocumentMutations";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, HINT, OPTION, OPTION_IDLE, OPTION_PICKED, STEP_CARD } from "./ui";
import StepHeading from "./StepHeading";

type Tab = "pick" | "upload" | "built";

/**
 * What the vault takes AND the parser reads: the vault stores PDF/DOC/DOCX,
 * the parser reads PDF/DOCX/TXT/MD. A legacy .doc would be stored and then
 * never read, so it is not offered here (the vault still takes one).
 */
const ACCEPT = ".pdf,.docx";
const READABLE = /\.(pdf|docx)$/i;

export interface ResumeStepProps {
  /** A resume filled the form in on this visit (the step's check). */
  used: boolean;
  /** "Skip — I'll fill it in" was pressed: the step shows one line and a way back. */
  skipped: boolean;
  /** Fold the step and take the person to the form (the page owns the scroll). */
  onSkip: () => void;
  /** Open the step again after a skip. */
  onUnskip: () => void;
  /** A resume was read — prefill the profile's blank fields from it. */
  onContent: (content: ResumeContent, from: string) => void;
}

const isLiveResume = (doc: VaultDoc) => doc.kind === "resume" && !doc.archived;

const ResumeStep: FC<ResumeStepProps> = ({ used, skipped, onSkip, onUnskip, onContent }) => {
  const queryClient = useQueryClient();
  // null = not chosen yet: the tab follows what the vault holds.
  const [tab, setTab] = useState<Tab | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const documents = useDocumentsQuery();
  // Master first (it is what the extension attaches), then newest.
  const resumes = (documents.data ?? []).filter(isLiveResume).sort((a, b) => Number(b.master ?? false) - Number(a.master ?? false) || b.addedAt - a.addedAt);
  const activeTab: Tab = tab ?? (resumes.length > 0 ? "pick" : "upload");
  const pickedDoc = resumes.find((doc) => doc.id === picked) ?? resumes[0] ?? null;

  // Only asked for once the tab is opened: it is an AI-service read most people never need.
  const built = useQuery({
    queryKey: qk.resumes.list(),
    queryFn: ({ signal }) => listResumeDocuments(signal),
    staleTime: STALE_TIME.resumes,
    // As the editor reads it (dashboard/resume Client): dropped once this step is gone, so the
    // editor never seeds itself from a list read here minutes earlier.
    gcTime: 0,
    enabled: activeTab === "built",
  });

  const read = useMutation<ResumeContent | null, unknown, VaultDoc>({
    mutationKey: READ_RESUME_KEY,
    mutationFn: (doc) => readVaultResume(doc.id),
    onSuccess: (content, doc) => {
      if (content) onContent(content, doc.name);
    },
  });

  const upload = useUploadDocument();

  const saveBuilt = useMutation<VaultDoc, unknown, StoredResumeDocument>({
    mutationFn: (resume) => saveBuiltResumeToVault(resume.id),
    onSuccess: (doc, resume) => {
      // The refresh an upload triggers (useDocumentAction). Not the checklist: a resume is not on it.
      void queryClient.invalidateQueries({ queryKey: qk.documents.list() });
      toast.success(`${doc.name} added`, { description: "It's in My documents." });
      setPicked(doc.id);
      setTab("pick");
      // Structured already: no need to read back the file just made from it.
      onContent(resume.content, resume.label);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function uploadFile(file: File | undefined) {
    if (!file) return;
    if (!READABLE.test(file.name)) {
      toast.error("Upload a PDF or a Word (.docx) file");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("That file is larger than 10MB");
      return;
    }
    upload.mutate(
      { file, kind: "resume" },
      {
        onSuccess: (doc) => {
          setPicked(doc.id);
          setTab("pick");
          read.mutate(doc);
        },
      },
    );
  }

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    uploadFile(event.dataTransfer.files?.[0]);
  };

  const busy = upload.isPending || saveBuilt.isPending || read.isPending;
  const tabs: { id: Tab; label: string }[] = [
    { id: "pick", label: resumes.length > 0 ? `My documents (${resumes.length})` : "My documents" },
    { id: "upload", label: "Upload" },
    { id: "built", label: "From the editor" },
  ];

  return (
    <section id="onb-resume" aria-labelledby="onb-resume-title" className={cn(STEP_CARD, "scroll-mt-6 p-5 md:p-7")}>
      <StepHeading
        n={1}
        id="onb-resume-title"
        title="Start from your resume"
        optional
        done={used}
        doneLabel="Used"
        blurb={
          skipped
            ? "Skipped. You're filling your profile in yourself. A resume can be built from it later."
            : "Have one? Pick it, upload it or save one you built, and we'll fill in your profile below wherever it's blank. No resume is needed."
        }
      />

      {skipped ? (
        <div className="mt-4">
          <button type="button" className={cn(BUTTON_SECONDARY, "px-3 py-2 text-xs")} onClick={onUnskip}>
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Start from a resume after all
          </button>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Where your resume comes from" className="mt-5 grid grid-cols-3 gap-1 rounded-xl border border-primary/15 bg-primary2 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  // Three equal cells that wrap their own label on a phone rather than wrapping the row.
                  "rounded-lg px-2 py-2 text-xs font-semibold leading-tight transition-colors cursor-pointer sm:px-3",
                  activeTab === t.id ? "bg-primary text-white" : "text-primary/60 hover:text-primary",
                )}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4" role="tabpanel">
            {activeTab === "pick" &&
              (documents.isPending ? (
                <p className={cn(HINT, "flex items-center gap-2 py-3")}>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> Looking in My documents…
                </p>
              ) : resumes.length === 0 ? (
                <p className={cn(HINT, "py-3")}>No resumes in My documents yet. Upload one, or save one you built in the editor.</p>
              ) : (
                <>
                  <ul className="flex flex-col gap-2" aria-label="Your resumes">
                    {resumes.map((doc) => {
                      const isPicked = pickedDoc?.id === doc.id;
                      return (
                        <li key={doc.id}>
                          <button type="button" aria-pressed={isPicked} onClick={() => setPicked(doc.id)} className={cn(OPTION, isPicked ? OPTION_PICKED : OPTION_IDLE)}>
                            <FileText className="h-4 w-4 flex-none text-primary/60" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-primary">
                                {doc.name}
                                {doc.ext && <span className="font-normal text-primary/45">.{doc.ext}</span>}
                              </span>
                              <span className="block truncate text-xs text-primary/50">{doc.updatedLabel}</span>
                            </span>
                            {doc.master && <span className="flex-none rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-primary">Master</span>}
                            {isPicked && <Check className="h-4 w-4 flex-none text-primary" aria-hidden />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" className={BUTTON_PRIMARY} disabled={!pickedDoc || busy} onClick={() => pickedDoc && read.mutate(pickedDoc)}>
                      <WandSparkles className="h-4 w-4" aria-hidden />
                      Fill my profile from it
                    </button>
                    <span className={HINT}>Free. Only empty fields are filled.</span>
                  </div>
                </>
              ))}

            {activeTab === "upload" && (
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
                  dragging ? "border-primary bg-secondary/40" : "border-primary/35 bg-primary2 hover:border-primary",
                  busy && "pointer-events-none opacity-60",
                )}>
                <input
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    // Cleared first so choosing the same file again still fires.
                    e.target.value = "";
                    uploadFile(file);
                  }}
                />
                {upload.isPending ? (
                  <LoaderCircle className="h-6 w-6 animate-spin text-primary" aria-hidden />
                ) : (
                  <FileUp className="h-6 w-6 text-primary" aria-hidden />
                )}
                <span className="text-sm font-semibold text-primary">{upload.isPending ? "Uploading…" : "Choose a file, or drop it here"}</span>
                <span className={HINT}>PDF or Word (.docx), up to 10MB. Your first resume becomes your master.</span>
              </label>
            )}

            {activeTab === "built" &&
              (built.isPending ? (
                <p className={cn(HINT, "flex items-center gap-2 py-3")}>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> Looking for resumes you built…
                </p>
              ) : built.isError ? (
                <p className={cn(HINT, "py-3")}>{apiMessage(built.error)}</p>
              ) : (built.data ?? []).length === 0 ? (
                <div className="flex flex-wrap items-center gap-3 py-2">
                  <p className={HINT}>You haven&apos;t built a resume in the editor yet.</p>
                  <Link href="/dashboard/resume" className={BUTTON_SECONDARY}>
                    <PenLine className="h-4 w-4" aria-hidden />
                    Open the resume editor
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-2" aria-label="Resumes you built">
                  {(built.data ?? []).map((resume) => (
                    <li key={resume.id} className={cn(OPTION, OPTION_IDLE, "cursor-default flex-wrap sm:flex-nowrap")}>
                      <PenLine className="h-4 w-4 flex-none text-primary/60" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-primary">{resume.label}</span>
                        <span className="block truncate text-xs text-primary/50">Edited {format(resume.updatedAt, "d MMM yyyy")}</span>
                      </span>
                      <button
                        type="button"
                        className={cn(BUTTON_SECONDARY, "px-3 py-2 text-xs")}
                        disabled={busy}
                        onClick={() => saveBuilt.mutate(resume)}>
                        {saveBuilt.isPending && saveBuilt.variables?.id === resume.id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <FileUp className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {saveBuilt.isPending && saveBuilt.variables?.id === resume.id ? "Saving…" : "Save to My documents"}
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </div>

          {/* The way past: as plain as the ways in, so nobody hunts for a resume they don't have. */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-primary/10 pt-4">
            <p className={cn(HINT, "min-w-0 flex-1")}>No resume to hand? Type your profile in, and a resume can be built from it later.</p>
            <button type="button" className={cn(BUTTON_SECONDARY, "px-3 py-2 text-xs")} disabled={upload.isPending || saveBuilt.isPending} onClick={onSkip}>
              Skip, I&apos;ll fill it in
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </>
      )}

      {/* The read's own status, whichever tab started it. */}
      <div aria-live="polite" className="empty:hidden">
        {read.isPending && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary2 px-3.5 py-3 text-sm text-primary">
            <LoaderCircle className="h-4 w-4 flex-none animate-spin" aria-hidden />
            <span className="min-w-0">
              Reading <span className="font-semibold">{read.variables?.name}</span>… this can take up to a minute.
            </span>
          </p>
        )}
        {read.isError && (
          <p className="mt-4 rounded-xl border border-[#c0392b]/30 bg-[#fdeae6] px-3.5 py-3 text-sm text-[#8a2d1c]">
            It&apos;s in My documents, but we couldn&apos;t read it: {apiMessage(read.error)} Fill in the fields below yourself.
          </p>
        )}
        {read.isSuccess && read.data === null && (
          <p className="mt-4 rounded-xl border border-primary/15 bg-primary2 px-3.5 py-3 text-sm text-primary">
            It&apos;s in My documents, but we found no text to read in it. Fill in the fields below yourself.
          </p>
        )}
      </div>
    </section>
  );
};

export default ResumeStep;
