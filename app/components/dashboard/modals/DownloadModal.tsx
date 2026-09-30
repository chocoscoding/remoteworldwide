"use client";

import { FC, useState } from "react";
import { Check, ChevronDown, Download, FileCode, FileText, FileType2, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";

/**
 * Shared "download this document" overlay, used by both the Resume and
 * Cover-letter screens. The screen does the export (`onDownload`) — DOCX and
 * Markdown are built in the browser and saved; PDF opens the browser's print
 * dialog on the document alone (see app/lib/export/save.ts on why) — and this
 * stays open, busy, until it finishes, so a failure is shown here rather than
 * lost behind a closed dialog.
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
    helper: "Exactly as it looks here, with real text ATS systems can read. Opens your browser's print dialog — choose \"Save as PDF\".",
  },
  {
    id: "docx",
    label: "Word",
    ext: ".docx",
    icon: FileType2,
    helper: "Fully editable in Word or Google Docs. Laid out in one clean column, which ATS systems read most reliably.",
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
  /** The format selected on open. Key the modal on it to change it between openings. */
  defaultFormat?: DownloadFormat;
  /** Does the export. The modal stays open and busy until it settles; a rejection is shown here. */
  onDownload?: (format: DownloadFormat) => void | Promise<void>;
  /**
   * Per-format help text, for a document that is not a copy of what is on
   * screen — the ATS report prints a clean layout of the scan, not the page, so
   * "exactly as it looks here" would be untrue of it. Unset formats keep the default.
   */
  helpers?: Partial<Record<DownloadFormat, string>>;
}

const DownloadModal: FC<DownloadModalProps> = ({ open, onOpenChange, docLabel = "document", fileName = "Document", defaultFormat = "pdf", onDownload, helpers }) => {
  const [format, setFormat] = useState<DownloadFormat>(defaultFormat);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = FORMAT_OPTIONS.find((f) => f.id === format) ?? FORMAT_OPTIONS[0];

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDownload?.(format);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "That download didn't work — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
        if (!next) {
          setMenuOpen(false);
          setError(null);
        }
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

          <p className="text-xs text-black/50 leading-relaxed mb-5">{helpers?.[selected.id] ?? selected.helper}</p>

          <div className="flex items-center gap-2 rounded-xl bg-[#f0f0ea] px-4 py-3 mb-1">
            <Info className="h-4 w-4 flex-none text-black/45" />
            <p className="text-xs font-medium text-black/55">
              {format === "pdf" ? "The dialog suggests the name " : "Saves to your downloads as "}
              <span className="font-semibold text-primary">
                {fileName}
                {selected.ext}
              </span>
              .
            </p>
          </div>

          {error && (
            <p className="mt-3 rounded-xl border border-[#b23c26]/20 bg-[#fdf4f2] px-4 py-3 text-xs text-[#b23c26]" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-black/8 px-6 py-4">
          <StickerButton type="button" variant="outline" size="md" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </StickerButton>
          <StickerButton type="button" variant="primary" size="md" disabled={busy || !onDownload} onClick={() => void handleDownload()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {busy ? "Preparing…" : format === "pdf" ? "Save as PDF" : "Download"}
          </StickerButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadModal;
