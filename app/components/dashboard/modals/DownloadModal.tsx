"use client";

import { FC, useState } from "react";
import { Check, ChevronDown, Download, FileCode, FileText, FileType2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { safeFileName } from "@/app/lib/export/save";

/**
 * Shared "download this document" overlay, used by the Resume, Cover-letter
 * and ATS report screens and the apply wizard. The screen does the export
 * (`onDownload`) — DOCX and Markdown are built in the browser and saved; PDF
 * opens the browser's print dialog on the document alone (see
 * app/lib/export/save.ts on why) — and this stays open, busy, until it
 * finishes, so a failure is shown here rather than lost behind a closed dialog.
 *
 * The name it downloads as is the user's to change (owner, 2026-10-04): the
 * screen's suggestion fills the field, and what is in it when they press
 * Download is the name the screen saves under. No help text under the format,
 * no note repeating the name: the field says it.
 */

export type DownloadFormat = "pdf" | "docx" | "md";

interface FormatOption {
  id: DownloadFormat;
  label: string;
  ext: string;
  icon: typeof FileText;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { id: "pdf", label: "PDF", ext: ".pdf", icon: FileText },
  { id: "docx", label: "Word", ext: ".docx", icon: FileType2 },
  { id: "md", label: "Markdown", ext: ".md", icon: FileCode },
];

export interface DownloadModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Called with the next open state — pass `setState` or `(v) => ...` directly. */
  onOpenChange: (open: boolean) => void;
  /** What's being downloaded, used in the title copy, e.g. "resume" or "cover letter". */
  docLabel?: string;
  /** The suggested name, without its extension, e.g. "Amara-Okafor-Resume". The field starts on it. */
  fileName?: string;
  /** The format selected on open. Key the modal on it to change it between openings. */
  defaultFormat?: DownloadFormat;
  /**
   * Does the export, under the name in the field (made safe for a file system, the suggestion when
   * left empty). The modal stays open and busy until it settles; a rejection is shown here.
   */
  onDownload?: (format: DownloadFormat, fileName: string) => void | Promise<void>;
}

const DownloadModal: FC<DownloadModalProps> = ({ open, onOpenChange, docLabel = "document", fileName = "Document", defaultFormat = "pdf", onDownload }) => {
  const [format, setFormat] = useState<DownloadFormat>(defaultFormat);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(fileName);
  // A new suggestion (another document) replaces what was typed for the last one.
  const [suggested, setSuggested] = useState(fileName);
  if (fileName !== suggested) {
    setSuggested(fileName);
    setName(fileName);
  }

  const selected = FORMAT_OPTIONS.find((f) => f.id === format) ?? FORMAT_OPTIONS[0];

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDownload?.(format, safeFileName(name.trim() || fileName));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "That download didn't work. Please try again.");
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
          <p className="text-xs text-black/45 mb-5 pl-[52px]">Choose a format. You can download this again anytime.</p>

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

          {/* The name it downloads as: the screen's suggestion, theirs to change. */}
          <label htmlFor="download-file-name" className="mb-1.5 block text-xs font-semibold text-black/55">
            File name
          </label>
          <div className="flex items-center rounded-xl border border-black/12 bg-white transition-colors focus-within:border-[#222325]">
            <input
              id="download-file-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleDownload();
              }}
              disabled={busy}
              spellCheck={false}
              className="min-w-0 flex-1 rounded-l-xl bg-transparent px-4 py-3 text-sm font-semibold text-primary outline-none placeholder:text-black/35"
              placeholder={fileName}
            />
            <span className="flex-none pr-4 text-sm font-medium text-black/40">{selected.ext}</span>
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
