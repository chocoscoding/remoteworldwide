"use client";

// A tailored resume in a popup, whole, with what tailoring changed highlighted:
// for a proposal that hasn't been used yet. The paper and its marks are
// `ChangesPaper`, the same as the resume step's own preview.

import { useMemo, type FC } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import SplitButton from "@/app/components/dashboard/ui/SplitButton";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { changeCount, resumeChanges } from "@/app/lib/apply/changes";
import ChangesPaper, { highlightRegistry } from "./ChangesPaper";
import type { ResumeDownloadFormat } from "./useResumeDownload";

export interface ResumePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: ResumeContent;
  /** The resume it was tailored from; what differs from it is highlighted. */
  before: ResumeContent | null;
  onOpenInCreator?: () => void;
  openingInCreator?: boolean;
  /** Downloads this resume as PDF or Word; absent for a proposal that isn't used yet. */
  onDownload?: (format: ResumeDownloadFormat) => void;
}

const ResumePreviewDialog: FC<ResumePreviewDialogProps> = ({
  open,
  onOpenChange,
  title,
  content,
  before,
  onOpenInCreator,
  openingInCreator = false,
  onDownload,
}) => {
  const count = useMemo(() => changeCount(resumeChanges(before, content)), [before, content]);
  // Read in the browser only: the dialog's content renders when it opens, never on the server.
  const canHighlight = highlightRegistry() !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-[940px] flex-col gap-0 overflow-hidden rounded-[20px] border-0 bg-white p-0">
        <div className="border-b border-black/8 px-6 py-5 pr-14">
          <DialogTitle className="text-[17px] font-bold leading-tight text-primary">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-black/55">
            {count === 0
              ? "Nothing here differs from the resume it was made from."
              : `${count} change${count === 1 ? "" : "s"} for this job, ${canHighlight ? "highlighted below" : "listed below"}.`}
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[#f0f0ea] p-5 sm:p-8">
          <ChangesPaper content={content} before={before} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 px-6 py-4">
          <p className="text-xs text-black/45">{onOpenInCreator ? "Opens a copy in the resume creator, in a new tab. This application keeps its own." : ""}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            {onDownload && <DownloadButton onDownload={onDownload} />}
            {onOpenInCreator && (
              <StickerButton variant="outline" size="md" disabled={openingInCreator} onClick={onOpenInCreator}>
                <ExternalLink className="h-4 w-4" />
                Open in resume creator
              </StickerButton>
            )}
            <StickerButton variant="primary" size="md" onClick={() => onOpenChange(false)}>
              Done
            </StickerButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Download as PDF (the button) or as Word (its menu): the same pair the resume rows' ⋯ menu offers. */
export const DownloadButton: FC<{ onDownload: (format: ResumeDownloadFormat) => void }> = ({ onDownload }) => (
  <SplitButton
    label="Download"
    icon={<Download className="h-3.5 w-3.5" />}
    onClick={() => onDownload("pdf")}
    items={[
      { id: "pdf", label: "Download as PDF", icon: <Download className="h-3.5 w-3.5" />, onSelect: () => onDownload("pdf") },
      { id: "docx", label: "Download as DOCX", icon: <Download className="h-3.5 w-3.5" />, onSelect: () => onDownload("docx") },
    ]}
  />
);

export default ResumePreviewDialog;
