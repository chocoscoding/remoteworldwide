"use client";

import { FC, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Award,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Pencil,
  ShieldCheck,
  Trash2,
  File as FileIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import {
  downloadDoc,
  editorHrefFor,
  formatSize,
  KIND_LABELS,
  openDocFile,
  sourceBadgeLabel,
  useDocuments,
  type DocKind,
  type VaultDoc,
} from "@/app/components/dashboard/documents/DocumentsProvider";

// Re-exported so the screen's search keeps one import site for row concerns.
export { KIND_LABELS };

/** Quiet inline control — weight is reserved for the page's real actions. */
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/55 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary";

const KIND_ICONS: Record<DocKind, LucideIcon> = {
  resume: FileText,
  "cover-letter": FileIcon,
  portfolio: ImageIcon,
  certificate: Award,
  id: ShieldCheck,
  other: Paperclip,
};

/**
 * Rename lives in a child that only mounts while renaming, so closing it
 * throws the draft away for free (the AnswerEditor pattern — no reset effect
 * for the compiler to object to, no stale draft on reopen).
 */
const RowRenamer: FC<{ doc: VaultDoc; onDone: () => void }> = ({ doc, onDone }) => {
  const { rename } = useDocuments();
  const [draft, setDraft] = useState(doc.name);

  function commit() {
    rename(doc.id, draft);
    onDone();
  }

  return (
    <div className="flex flex-1 items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        aria-label={`Rename ${doc.name}`}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onDone();
        }}
        className="h-9 w-full max-w-sm rounded-lg border border-black/15 bg-white px-3 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]"
      />
      <StickerButton variant="primary" size="sm" disabled={!draft.trim()} onClick={commit}>
        <Check className="h-3.5 w-3.5" />
        Save
      </StickerButton>
      <button type="button" className={cn(GHOST_BTN, "hover:bg-[#fdeae6] hover:text-[#b23c26]")} onClick={onDone}>
        Cancel
      </button>
    </div>
  );
};

export interface DocRowProps {
  doc: VaultDoc;
  renaming: boolean;
  onStartRename: () => void;
  onDoneRename: () => void;
}

const DocRow: FC<DocRowProps> = ({ doc, renaming, onStartRename, onDoneRename }) => {
  const { remove, toggleArchive } = useDocuments();

  const isResume = doc.kind === "resume";
  const Icon = KIND_ICONS[doc.kind];
  const badge = sourceBadgeLabel(doc.source);

  const meta = [KIND_LABELS[doc.kind], doc.ext ? doc.ext.toUpperCase() : null, doc.size != null ? formatSize(doc.size) : null, doc.updatedLabel]
    .filter(Boolean)
    .join(" · ");

  // The icon and the name are one control: hovering either underlines the
  // name, and clicking opens the document. Replaces the old "Open" action,
  // which only ever appeared on resumes anyway.
  const editorHref = editorHrefFor(doc);
  const iconTile = isResume ? (
    <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#222325]">
      <FileText className="h-4 w-4 text-white" />
    </span>
  ) : (
    <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
      <Icon className="h-4 w-4 text-black/55" />
    </span>
  );

  const title = (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate text-sm font-bold text-primary underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover/open:decoration-[#222325]">
        {doc.name}
      </span>
      {badge && <span className="flex-none rounded-full bg-[#f0f0ea] px-2 py-0.5 text-[10px] font-bold text-black/55">{badge}</span>}
    </span>
  );

  const OPEN_TARGET = "group/open flex min-w-0 flex-1 items-center gap-4 text-left cursor-pointer";

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4", doc.archived && "opacity-55")}>
      {renaming ? (
        <>
          {iconTile}
          <RowRenamer doc={doc} onDone={onDoneRename} />
        </>
      ) : (
        <>
          {editorHref ? (
            <Link href={editorHref} className={OPEN_TARGET} title={`Open ${doc.name}`}>
              {iconTile}
              <span className="min-w-0 flex-1">
                {title}
                <span className="mt-0.5 block truncate text-xs text-black/55">{meta}</span>
              </span>
            </Link>
          ) : (
            <button type="button" onClick={() => openDocFile(doc)} className={OPEN_TARGET} title={`Open ${doc.name}`}>
              {iconTile}
              <span className="min-w-0 flex-1">
                {title}
                <span className="mt-0.5 block truncate text-xs text-black/55">{meta}</span>
              </span>
            </button>
          )}

          <div className="flex flex-none items-center gap-0.5">
            {/* Uploads hand back their original bytes; anything else gets a
                generated summary PDF — the button always delivers a file. */}
            <button type="button" className={GHOST_BTN} onClick={() => downloadDoc(doc)}>
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button type="button" className={GHOST_BTN} onClick={onStartRename}>
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </button>
            <button type="button" className={GHOST_BTN} onClick={() => toggleArchive(doc.id)}>
              {doc.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              {doc.archived ? "Unarchive" : "Archive"}
            </button>
            <button
              type="button"
              className={cn(GHOST_BTN, "hover:bg-[#fdeae6] hover:text-[#b23c26]")}
              onClick={() => remove(doc.id)}>
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DocRow;
