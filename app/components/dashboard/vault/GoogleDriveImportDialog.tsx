"use client";

import { FC, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { LucideIcon } from "lucide-react";
import { Award, Check, Download, File as FileIcon, FileText, Image as ImageIcon, Paperclip, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { driveDocId, formatSize, useDocuments, type DriveFile } from "@/app/components/dashboard/documents/DocumentsProvider";
import type { DocKind } from "@/app/lib/dashboard/types";

/**
 * Replaces the LinkedIn import. A real Drive connection hands back a *picker*,
 * not a single blob, so this is a picker: choose the files you actually want,
 * see which are already in, import the rest. Files already imported are shown
 * and disabled rather than hidden — otherwise re-opening the dialog looks like
 * Drive lost them.
 *
 * Radix primitives directly, same recipe as ExtensionDialog: blurred ink
 * overlay, hard border + offset shadow.
 */
export interface GoogleDriveImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Drive's mark, so the row reads as an integration rather than a generic cloud. */
const DriveGlyph: FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 87.3 78" className={className} aria-hidden="true">
    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
    <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5A9.06 9.06 0 000 53h27.5z" fill="#00ac47" />
    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.798l5.852 11.5z" fill="#ea4335" />
    <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
    <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
    <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
  </svg>
);

const KIND_ICONS: Record<DocKind, LucideIcon> = {
  resume: FileText,
  "cover-letter": FileIcon,
  portfolio: ImageIcon,
  certificate: Award,
  id: ShieldCheck,
  other: Paperclip,
};

interface DriveListing extends DriveFile {
  modifiedLabel: string;
}

/**
 * What the picker returns. Local to this dialog: it is the shape of a Drive
 * response, not app data, and no other screen should read it.
 */
const DRIVE_FILES: DriveListing[] = [
  { id: "1a7f", name: "Chocos coding — Resume 2026", kind: "resume", ext: "pdf", size: 421_888, modifiedLabel: "Modified 3 days ago" },
  { id: "2b3c", name: "Cover letter — Linear", kind: "cover-letter", ext: "docx", size: 69_632, modifiedLabel: "Modified last week" },
  { id: "4d9e", name: "Portfolio — Case studies", kind: "portfolio", ext: "pdf", size: 8_808_038, modifiedLabel: "Modified 2 weeks ago" },
  { id: "5f2a", name: "Design systems audit", kind: "portfolio", ext: "pdf", size: 1_258_291, modifiedLabel: "Modified last month" },
  { id: "6c8b", name: "Google UX Certificate", kind: "certificate", ext: "pdf", size: 245_760, modifiedLabel: "Modified in March" },
  { id: "7e1d", name: "Passport scan", kind: "id", ext: "jpg", size: 1_887_436, modifiedLabel: "Modified last year" },
];

const GoogleDriveImportDialog: FC<GoogleDriveImportDialogProps> = ({ open, onOpenChange }) => {
  const { docs, importFromDrive } = useDocuments();
  const [picked, setPicked] = useState<string[]>([]);

  // Recomputed on every open rather than held in state — importing mutates
  // `docs`, and a snapshot would leave the list claiming a file is importable
  // right after you imported it.
  const alreadyIn = new Set(docs.map((d) => d.id));
  const available = DRIVE_FILES.filter((f) => !alreadyIn.has(driveDocId(f.id)));
  const allPicked = available.length > 0 && picked.length === available.length;

  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  function handleOpenChange(next: boolean) {
    if (!next) setPicked([]);
    onOpenChange(next);
  }

  function handleImport() {
    importFromDrive(DRIVE_FILES.filter((f) => picked.includes(f.id)));
    setPicked([]);
    onOpenChange(false);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex flex-none items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">Import from Google Drive</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-black/60">
                Pick the files you want — they land straight in your documents.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="mx-6 mb-4 flex flex-none items-center gap-3 rounded-xl border border-black/10 bg-[#fbfbf7] px-4 py-3">
            <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-white ring-1 ring-black/10">
              <DriveGlyph className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-primary">My Drive</p>
              <p className="text-xs text-black/60">Read-only — nothing is written back to Drive.</p>
            </div>
            {available.length > 0 && (
              <button
                type="button"
                onClick={() => setPicked(allPicked ? [] : available.map((f) => f.id))}
                className="flex-none cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-black/60 transition-colors hover:bg-black/[0.05] hover:text-primary">
                {allPicked ? "Clear" : "Select all"}
              </button>
            )}
          </div>

          <div className="mx-6 min-h-0 flex-1 overflow-y-auto scrollbar-neo">
            <ul className="flex flex-col gap-1.5 pb-1">
              {DRIVE_FILES.map((file) => {
                const imported = alreadyIn.has(driveDocId(file.id));
                const isPicked = picked.includes(file.id);
                const Icon = KIND_ICONS[file.kind ?? "other"];

                return (
                  <li key={file.id}>
                    <button
                      type="button"
                      disabled={imported}
                      aria-pressed={isPicked}
                      onClick={() => toggle(file.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                        imported
                          ? "cursor-default border-dashed border-black/15 bg-transparent"
                          : isPicked
                            ? "cursor-pointer border-[#222325] bg-[#f7fbe4]"
                            : "cursor-pointer border-black/12 bg-white hover:border-black/30",
                      )}>
                      <span
                        className={cn(
                          "grid h-5 w-5 flex-none place-content-center rounded-md border",
                          imported
                            ? "border-black/15 bg-[#f0f0ea]"
                            : isPicked
                              ? "border-[#222325] bg-[#222325]"
                              : "border-black/25 bg-white",
                        )}>
                        {(isPicked || imported) && (
                          <Check className={cn("h-3 w-3", imported ? "text-black/40" : "text-[#e1f073]")} strokeWidth={3.5} />
                        )}
                      </span>

                      <span className="grid h-8 w-8 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
                        <Icon className="h-4 w-4 text-[#222325]" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-primary">{file.name}</span>
                        <span className="block truncate text-[11px] text-black/60">
                          {file.ext?.toUpperCase()}
                          {file.size != null && ` · ${formatSize(file.size)}`} · {file.modifiedLabel}
                        </span>
                      </span>

                      {imported && <span className="flex-none text-[11px] font-semibold text-black/50">In your documents</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mx-6 mb-5 mt-4 flex-none rounded-lg bg-[#f0f0ea] px-3.5 py-2.5 text-xs leading-relaxed text-black/65">
            Drive isn&apos;t connected in this build — importing adds them as real documents so you can see exactly how they land, but
            nothing is fetched from Google.
          </p>

          <div className="flex flex-none items-center gap-2.5 border-t border-black/10 px-6 py-4">
            <StickerButton variant="primary" size="md" disabled={picked.length === 0} onClick={handleImport}>
              <Download className="h-4 w-4" />
              {picked.length === 0 ? "Import" : picked.length === 1 ? "Import 1 file" : `Import ${picked.length} files`}
            </StickerButton>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-black/60 transition-colors hover:bg-[#fdeae6] hover:text-[#b23c26]">
              Cancel
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default GoogleDriveImportDialog;
