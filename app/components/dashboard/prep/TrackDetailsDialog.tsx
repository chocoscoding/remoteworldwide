"use client";

import { useState, type FC, type FormEvent } from "react";
import { Link2, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { apiMessage } from "@/app/lib/api/core";
import { PREP_TRACK_LIMITS, type PrepTrackDetail, type PrepTrackItem, type UpdatePrepTrackInput } from "@/app/lib/prep/types";
import { usePrepTrackDetail } from "@/hooks/queries/usePrepTrackQueries";
import { useSavedJobQuery } from "@/hooks/queries/useJobQueries";
import { BUTTON_OUTLINE, BUTTON_SOLID, FIELD_SHELL } from "./prep-styles";

export interface TrackDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: PrepTrackItem;
  /** Rejects with the server's refusal, which the dialog shows in place. */
  onSave: (input: UpdatePrepTrackInput) => Promise<void>;
  onDelete: () => Promise<void>;
}

const LABEL = "block text-[11px] font-bold uppercase tracking-[0.07em] text-black/45 mb-1.5";
const CONTROL = "w-full min-w-0 bg-transparent outline-none text-sm font-semibold text-primary placeholder:text-black/35 placeholder:font-medium";

/**
 * The track's own details: company, role, location, and what its likely
 * questions are written from — the saved job it is linked to, or a pasted
 * posting. The pasted text is read from the track's detail when the dialog
 * opens (the list never carries it), so the form waits for it rather than
 * offering an empty box that would erase it on save.
 */
const TrackDetailsDialog: FC<TrackDetailsDialogProps> = ({ open, onOpenChange, track, onSave, onDelete }) => {
  const detail = usePrepTrackDetail(open ? track.id : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-[20px] border-2 border-[#222325] p-0 gap-0 max-w-[560px] overflow-hidden">
        <DialogTitle className="sr-only">Track details</DialogTitle>
        {detail.data ? (
          // Keyed on the read, so a refetch that lands while the form is open does not overwrite typing.
          <DetailsForm key={detail.data.id} detail={detail.data} onClose={() => onOpenChange(false)} onSave={onSave} onDelete={onDelete} />
        ) : (
          <div className="p-6">
            <p className="text-lg font-bold text-primary">Track details</p>
            {detail.isError ? (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-sm text-black/55">{apiMessage(detail.error)}</p>
                <button type="button" onClick={() => void detail.refetch()} className={cn(BUTTON_OUTLINE, "w-fit")}>
                  Try again
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3" aria-busy="true">
                <div className="h-10 rounded-lg bg-[#f0f0ea] animate-pulse" />
                <div className="h-10 rounded-lg bg-[#f0f0ea] animate-pulse" />
                <div className="h-28 rounded-lg bg-[#f0f0ea] animate-pulse" />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface DetailsFormProps {
  detail: PrepTrackDetail;
  onClose: () => void;
  onSave: (input: UpdatePrepTrackInput) => Promise<void>;
  onDelete: () => Promise<void>;
}

const DetailsForm: FC<DetailsFormProps> = ({ detail, onClose, onSave, onDelete }) => {
  const [company, setCompany] = useState(detail.company);
  const [role, setRole] = useState(detail.role);
  const [location, setLocation] = useState(detail.location ?? "");
  const [posting, setPosting] = useState(detail.jobDescription ?? "");
  const [linkedJob, setLinkedJob] = useState(detail.savedJobId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savedJob = useSavedJobQuery(linkedJob);

  async function run(kind: "save" | "delete", work: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await work();
      onClose();
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!company.trim() || !role.trim()) {
      setError("A track needs a company and a role.");
      return;
    }
    // Only what changed goes up: an untouched posting is not sent back as sixty thousand characters.
    const input: UpdatePrepTrackInput = {};
    if (company.trim() !== detail.company) input.company = company.trim();
    if (role.trim() !== detail.role) input.role = role.trim();
    if ((location.trim() || null) !== detail.location) input.location = location.trim() || null;
    if ((posting.trim() || null) !== (detail.jobDescription ?? null)) input.jobDescription = posting.trim() || null;
    if (linkedJob !== detail.savedJobId) input.savedJobId = linkedJob;
    if (Object.keys(input).length === 0) {
      onClose();
      return;
    }
    void run("save", () => onSave(input));
  }

  const jobLabel = savedJob.data ? [savedJob.data.role, savedJob.data.company].filter(Boolean).join(" at ") : "your saved job";

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-6 pb-5 flex flex-col gap-4 max-h-[72vh] overflow-y-auto">
        <div>
          <p className="text-lg font-bold text-primary">Track details</p>
          <DialogDescription className="mt-1 text-sm text-black/50">Likely questions are written from the posting and your resume, so keep the posting here current.</DialogDescription>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className={LABEL}>Company</span>
            <span className={FIELD_SHELL}>
              <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={PREP_TRACK_LIMITS.companyMax} className={CONTROL} />
            </span>
          </label>
          <label className="block">
            <span className={LABEL}>Role</span>
            <span className={FIELD_SHELL}>
              <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={PREP_TRACK_LIMITS.roleMax} className={CONTROL} />
            </span>
          </label>
        </div>

        <label className="block">
          <span className={LABEL}>Location</span>
          <span className={FIELD_SHELL}>
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={PREP_TRACK_LIMITS.locationMax} placeholder="Remote, EU overlap" className={CONTROL} />
          </span>
        </label>

        {linkedJob && (
          <div className="flex items-start gap-2.5 rounded-lg border border-black/10 bg-[#f6faea] px-3.5 py-3">
            <Link2 className="h-4 w-4 flex-none text-black/45 mt-0.5" />
            <p className="flex-1 text-xs text-black/60 leading-relaxed">
              Written from the posting of <b className="text-primary">{jobLabel}</b>, one of your saved jobs. Edit that posting in your jobs to change it.
            </p>
            <button type="button" onClick={() => setLinkedJob(null)} className="flex-none text-xs font-bold text-black/50 hover:text-primary cursor-pointer">
              Unlink
            </button>
          </div>
        )}

        <label className="block">
          <span className={LABEL}>{linkedJob ? "Pasted posting (used only without a saved job)" : "Job description"}</span>
          <textarea
            value={posting}
            onChange={(e) => setPosting(e.target.value)}
            maxLength={PREP_TRACK_LIMITS.jobDescriptionMax}
            rows={7}
            placeholder="Paste the job posting: what they ask for, what the role does."
            className="w-full resize-y rounded-lg border border-black/15 bg-[#fbfbf7] px-3 py-2 text-sm text-primary outline-none transition-colors focus:border-[#222325] placeholder:text-black/35"
          />
        </label>

        {detail.applicationId && <p className="text-xs text-black/45">Linked to your tracker: a round&apos;s outcome moves that application too.</p>}

        {error && (
          <p role="alert" className="text-xs font-semibold text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-black/8 px-6 py-4 flex-wrap">
        {confirmDelete ? (
          <span className="inline-flex items-center gap-2 text-xs">
            <span className="font-semibold text-primary">Delete this track? Its actions stay on your plan.</span>
            <button
              type="button"
              onClick={() => void run("delete", onDelete)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 font-bold text-red-700 underline underline-offset-2 cursor-pointer disabled:opacity-50">
              {busy === "delete" && <Loader2 className="h-3 w-3 animate-spin" />}
              Delete
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy !== null} className="font-bold text-black/50 cursor-pointer">
              Keep it
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-red-700 cursor-pointer">
            <Trash2 className="h-3.5 w-3.5" />
            Delete track
          </button>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy !== null} className={BUTTON_OUTLINE}>
            Cancel
          </button>
          <button type="submit" disabled={busy !== null} className={cn(BUTTON_SOLID, "disabled:opacity-50 disabled:pointer-events-none")}>
            {busy === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </form>
  );
};

export default TrackDetailsDialog;
