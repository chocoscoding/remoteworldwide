"use client";

import { useRef, type FC, type ReactNode } from "react";
import { format as formatDate } from "date-fns";
import { Check, FileText, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { RESUME_ACCEPT } from "@/app/lib/resume/mime";
import type { ResumeTarget, TrackResume } from "./useTrackResume";
import Chip from "./Chip";
import { BUTTON_OUTLINE, BUTTON_SOLID } from "./prep-styles";

export interface ResumePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: string;
  resume: TrackResume;
}

const SECTION = "text-[11px] font-bold uppercase tracking-[0.07em] text-black/45 px-6 pt-4 pb-1.5";

/** Whether a row is the one selected, or the one being written. */
function sameTarget(a: TrackResume["busy"] | TrackResume["selected"], b: ResumeTarget): boolean {
  if (!a || a === "upload" || a.kind !== b.kind) return false;
  if (a.kind === "document" && b.kind === "document") return a.documentId === b.documentId;
  if (a.kind === "parsed" && b.kind === "parsed") return a.resumeId === b.resumeId;
  return a.kind === "default";
}

/**
 * Which resume this job was sent — picked from what the user already has, or
 * uploaded here. My documents comes first, the master marked; then resumes
 * that were parsed but never filed there (an upload in Apply, a tailored copy,
 * one checked from the editor). A document is parsed when it is picked, once,
 * and the parse stored on the track (`useTrackResume.choose`).
 */
const ResumePickerDialog: FC<ResumePickerDialogProps> = ({ open, onOpenChange, company, resume }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { choices, selected, busy, error, source } = resume;
  const working = busy !== null;
  const nothing = choices.documents.length === 0 && choices.parsed.length === 0;
  const onDefault = source.kind !== "own";

  async function pick(target: ResumeTarget, isSelected: boolean) {
    if (working) return;
    // Already in effect: nothing to parse or store again.
    if (isSelected) {
      onOpenChange(false);
      return;
    }
    if (await resume.choose(target)) onOpenChange(false);
  }

  async function handleFile(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = "";
    if (!file || working) return;
    // Uploaded here, it is the one they mean for this job: stored on the track straight away.
    if (await resume.upload(file, "choose")) onOpenChange(false);
  }

  const row = (target: ResumeTarget, key: string, title: string, detail: ReactNode, badge?: ReactNode) => {
    const isSelected = target.kind === "default" ? onDefault : selected !== null && sameTarget(selected, target);
    const isBusy = sameTarget(busy, target);
    return (
      <li key={key}>
        <button
          type="button"
          onClick={() => void pick(target, isSelected)}
          disabled={working}
          aria-pressed={isSelected}
          className={cn(
            "w-full flex items-center gap-3 px-6 py-3 text-left cursor-pointer transition-colors hover:bg-[#fbfbf7] disabled:cursor-default",
            isSelected && "bg-[#f6faea] hover:bg-[#f6faea]"
          )}>
          <FileText className="h-4 w-4 flex-none text-black/40" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-primary">{title}</span>
              {badge}
            </span>
            <span className="block text-xs text-black/45 mt-0.5">{isBusy ? "Reading your resume…" : detail}</span>
          </span>
          {isBusy ? (
            <Loader2 className="h-4 w-4 flex-none animate-spin text-black/50" />
          ) : isSelected ? (
            <Check className="h-4 w-4 flex-none text-primary" strokeWidth={2.5} />
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !working && onOpenChange(next)}>
      <DialogContent className="bg-white rounded-[20px] border-2 border-[#222325] p-0 gap-0 max-w-[520px] overflow-hidden">
        <div className="p-6 pb-2">
          <DialogTitle className="text-lg font-bold text-primary">The resume you sent {company}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-black/50">
            Likely questions for this job are written from it. Pick the one you applied with.
          </DialogDescription>
        </div>

        <div className="max-h-[56vh] overflow-y-auto pb-2">
          {/* Going back to the default is only a choice once the track has its own. */}
          {source.kind === "own" && resume.defaultLabel && (
            <>
              <p className={SECTION}>Default</p>
              <ul>{row({ kind: "default" }, "default", "Use the default", resume.defaultLabel)}</ul>
            </>
          )}

          {choices.documents.length > 0 && (
            <>
              <p className={SECTION}>My documents</p>
              <ul>
                {choices.documents.map((doc) =>
                  row(
                    { kind: "document", documentId: doc.id },
                    doc.id,
                    doc.name,
                    `${doc.ext ? `${doc.ext.toUpperCase()} · ` : ""}added ${formatDate(new Date(doc.addedAt), "d MMM yyyy")}`,
                    doc.master ? <Chip tone="green">Master</Chip> : undefined
                  )
                )}
              </ul>
            </>
          )}

          {choices.parsed.length > 0 && (
            <>
              <p className={SECTION}>Also on file</p>
              <ul>
                {choices.parsed.map((parsed) =>
                  row({ kind: "parsed", resumeId: parsed.resumeId }, parsed.resumeId, parsed.fileName, "Used in Apply or checked in the editor — not in My documents")
                )}
              </ul>
            </>
          )}

          {nothing && (
            <p className="px-6 py-4 text-sm text-black/55 leading-relaxed">
              You haven&apos;t added a resume yet. Upload the one you sent {company} — it goes into My documents too.
            </p>
          )}

          {source.kind === "none" && !nothing && (
            <p className="px-6 pt-3 text-xs text-black/45">Nothing is picked for this job yet, and there is no master resume to fall back on.</p>
          )}
        </div>

        {error && (
          <p role="alert" className="px-6 pb-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-black/8 px-6 py-4 flex-wrap">
          <input ref={fileRef} type="file" accept={RESUME_ACCEPT} className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={working} className={cn(nothing ? BUTTON_SOLID : BUTTON_OUTLINE, "disabled:opacity-50 disabled:pointer-events-none")}>
            {busy === "upload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {busy === "upload" ? "Uploading…" : "Upload a resume"}
          </button>
          <button type="button" onClick={() => onOpenChange(false)} disabled={working} className={cn(BUTTON_OUTLINE, "disabled:opacity-50")}>
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResumePickerDialog;
