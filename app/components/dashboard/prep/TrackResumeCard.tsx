"use client";

import { useState, type FC } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_LABELS } from "@/app/lib/prep/trackResume";
import type { PrepTrackItem } from "@/app/lib/prep/types";
import Chip from "./Chip";
import ResumePickerDialog from "./ResumePickerDialog";
import { useTrackResume } from "./useTrackResume";
import { BUTTON_SOLID, PANEL } from "./prep-styles";

export interface TrackResumeCardProps {
  /** The saved track. A stand-in track has none, and no card. */
  track: PrepTrackItem;
}

/**
 * "Resume you submitted": the resume this job's prep stands on — the one the
 * track was given, else the one its application was sent with, else the
 * master — said plainly with where it came from, and changed from here. It
 * is what likely questions are written from, so a track prepped on the wrong
 * CV asks about the wrong history.
 */
const TrackResumeCard: FC<TrackResumeCardProps> = ({ track }) => {
  const resume = useTrackResume(track);
  const [open, setOpen] = useState(false);
  const { source, name, naming, missing, gate, isMaster } = resume;
  const label = source.kind === "none" ? null : SOURCE_LABELS[source.kind];
  const inEffect = label !== null && !missing;

  function openPicker() {
    resume.clearError();
    setOpen(true);
  }

  return (
    <div className={cn(PANEL, "p-5")}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="text-sm font-bold text-primary">Resume you submitted</p>
        {inEffect && (
          <button type="button" onClick={openPicker} className="text-xs font-bold text-black/50 hover:text-primary cursor-pointer">
            Change
          </button>
        )}
      </div>

      {inEffect ? (
        <div className="flex items-start gap-2.5">
          <FileText className="h-4 w-4 flex-none text-black/40 mt-0.5" />
          <div className="min-w-0 flex-1">
            {name ? (
              <p className="flex items-center gap-2 text-sm font-bold text-primary">
                <span className="truncate">{name}</span>
                {/* The label already says so when the master is the default itself. */}
                {isMaster && source.kind !== "master" && <Chip tone="green">Master</Chip>}
              </p>
            ) : naming ? (
              <span className="block h-4 w-40 max-w-full rounded bg-[#f0f0ea] animate-pulse" aria-label="Loading the resume's name" />
            ) : (
              // The parsed list could not be read just now; the choice itself still stands.
              <p className="text-sm font-bold text-primary">A resume on file</p>
            )}
            <p className="text-xs text-black/45 mt-0.5">{label}</p>
          </div>
        </div>
      ) : gate === "checking" ? (
        <span className="block h-4 w-48 max-w-full rounded bg-[#f0f0ea] animate-pulse" aria-label="Checking your resumes" />
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-black/50 leading-relaxed">
            {missing
              ? "The resume picked for this job is no longer on file. Pick the one you sent them."
              : gate === "upload"
                ? "Add the resume you sent them. Likely questions are written from it, and a practice session needs one."
                : "Pick the resume you sent them. Likely questions are written from it, and a practice session needs one."}
          </p>
          <button type="button" onClick={openPicker} className={BUTTON_SOLID}>
            {gate === "upload" ? "Add your resume" : missing ? "Pick another" : "Pick a resume"}
          </button>
        </div>
      )}

      <ResumePickerDialog open={open} onOpenChange={setOpen} company={track.company} resume={resume} />
    </div>
  );
};

export default TrackResumeCard;
