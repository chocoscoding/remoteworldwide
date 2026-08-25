"use client";

import { FC, useState } from "react";
import { Check, ChevronDown, Download, FileCode, FileText, FileType2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";

/**
 * Shared "download this document" overlay, used by both the Resume and
 * Cover-letter screens. Format selection + Download are purely local —
 * nothing is actually exported, "Download" just closes the modal.
 */

export type DownloadFormat = "pdf" | "docx" | "md";

interface FormatOption {
  id: DownloadFormat;
  label: string;
  ext: string;
  icon: typeof FileText;
  helper: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "pdf",
    label: "PDF",
    ext: ".pdf",
    icon: FileText,
    helper: "The safest bet for recruiters and ATS systems — formatting stays locked wherever it's opened.",
  },
  {
    id: "docx",
    label: "Word",
    ext: ".docx",
    icon: FileType2,
    helper: "Fully editable in Word or Google Docs, in case you want to tweak it further yourself.",
  },
  {
    id: "md",
    label: "Markdown",
    ext: ".md",
    icon: FileCode,
    helper: "Plain-text markup — handy for pasting into your own site or another tool.",
  },
];

export interface DownloadModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Called with the next open state — pass `setState` or `(v) => ...` directly. */
  onOpenChange: (open: boolean) => void;
  /** What's being downloaded, used in the title copy, e.g. "resume" or "cover letter". */
  docLabel?: string;
  /** Base filename shown next to the chosen extension, e.g. "Amara-Okafor-Resume". */
  fileName?: string;
  /** Optional callback fired with the chosen format right before the modal closes. No real export happens either way. */
  onDownload?: (format: DownloadFormat) => void;
}

const DownloadModal: FC<DownloadModalProps> = ({ open, onOpenChange, docLabel = "document", fileName = "Amara-Okafor", onDownload }) => {
  const [format, setFormat] = useState<DownloadFormat>("pdf");
  const [menuOpen, setMenuOpen] = useState(false);

  const selected = FORMAT_OPTIONS.find((f) => f.id === format) ?? FORMAT_OPTIONS[0];

  const handleDownload = () => {
    onDownload?.(format);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setMenuOpen(false);
      }}>
      <DialogContent className="bg-white rounded-[20px] border-0 p-0 max-w-md gap-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 flex-none rounded-full bg-[#f0f0ea] flex items-center justify-center">
              <Download className="h-[18px] w-[18px] text-primary" />
            </div>
            <DialogTitle className="text-[17px] font-bold text-primary leading-none">Download your {docLabel}</DialogTitle>
          </div>
          <p className="text-xs text-black/45 mb-5 pl-[52px]">Choose a format — you can download this again anytime.</p>

          {/* Format dropdown */}
          <div className="relative mb-4">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-black/12 bg-[#fbfbf7] px-4 py-3 text-left hover:border-black/25 transition-colors cursor-pointer">
              <span className="flex items-center gap-3 min-w-0">
                <selected.icon className="h-4 w-4 flex-none text-primary" />
                <span className="text-sm font-semibold text-primary">
                  {selected.label} <span className="text-black/40 font-medium">({selected.ext})</span>
                </span>
              </span>
              <ChevronDown className={cn("h-4 w-4 flex-none text-black/40 transition-transform", menuOpen && "rotate-180")} />
            </button>

            {menuOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden">
                {FORMAT_OPTIONS.map((opt) => {
                  const isSelected = opt.id === format;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setFormat(opt.id);
                        setMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
                        isSelected ? "bg-[#f6f6f6]" : "hover:bg-[#f9f9f6]"
                      )}>
                      <span className="flex items-center gap-3 min-w-0">
                        <opt.icon className="h-4 w-4 flex-none text-primary" />
                        <span className="text-sm font-semibold text-primary">
                          {opt.label} <span className="text-black/40 font-medium">({opt.ext})</span>
                        </span>
                      </span>
                      {isSelected && <Check className="h-4 w-4 flex-none text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-xs text-black/50 leading-relaxed mb-5">{selected.helper}</p>

          <div className="flex items-center gap-2 rounded-xl bg-[#f0f0ea] px-4 py-3 mb-1">
            <FolderOpen className="h-4 w-4 flex-none text-black/45" />
            <p className="text-xs font-medium text-black/55">
              Saves to <span className="font-semibold text-primary">My documents</span> too, as {fileName}
              {selected.ext}.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-black/8 px-6 py-4">
          <StickerButton type="button" variant="outline" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </StickerButton>
          <StickerButton type="button" variant="primary" size="md" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Download
          </StickerButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadModal;
