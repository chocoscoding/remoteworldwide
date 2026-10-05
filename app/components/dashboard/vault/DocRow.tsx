"use client";

// One row of My documents: an uploaded file, or a resume or cover letter made
// here (app/lib/documents/library.ts). Every action sits behind one ⋯ menu —
// Download, Rename, Archive, Remove — rather than a row of equal buttons
// (owner, 2026-10-03). A made-here document also gets Edit beside the menu,
// and only it does: it is the editor's own document, and an uploaded file is
// just a file.
//
// Remove asks once more in the row itself: there is no undo behind it, for a
// file or for a made-here document.

import { FC, useState } from "react";
import Link from "next/link";
import TimeAgo from "timeago-react";
import {
  Archive,
  ArchiveRestore,
  Award,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Pencil,
  ShieldCheck,
  Star,
  Trash2,
  File as FileIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import {
  downloadDoc,
  formatSize,
  KIND_LABELS,
  openDocFile,
  sourceBadgeLabel,
  useDocuments,
  type DocKind,
} from "@/app/components/dashboard/documents/DocumentsProvider";
import { createdFileHref, editHref, type LibraryItem } from "@/app/lib/documents/library";
import { useCreatedDocumentAction } from "@/hooks/queries/useCreatedDocuments";

// Re-exported so the screen's search keeps one import site for row concerns.
export { KIND_LABELS };

/** Quiet inline control — weight is reserved for the page's real actions. */
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/55 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary";

const MENU_ITEM =
  "flex w-full items-center gap-2.5 border-b border-black/8 px-3.5 py-2.5 text-left text-xs font-semibold text-primary last:border-b-0 cursor-pointer transition-colors hover:bg-[#fbfbf7]";

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
const RowRenamer: FC<{ name: string; onCommit: (name: string) => void; onDone: () => void }> = ({ name, onCommit, onDone }) => {
  const [draft, setDraft] = useState(name);

  function commit() {
    const next = draft.trim();
    if (next && next !== name) onCommit(next);
    onDone();
  }

  return (
    <div className="flex flex-1 items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        maxLength={120}
        aria-label={`Rename ${name}`}
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

interface MenuEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  /** A link (a made-here document's file, through `/open/…`), opened in a new tab so a refusal page never replaces this one. */
  href?: string;
  onSelect?: () => void;
  danger?: boolean;
}

const RowMenu: FC<{ name: string; entries: MenuEntry[] }> = ({ name, entries }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`More actions for ${name}`}
          className={cn(
            "grid h-8 w-8 flex-none place-content-center rounded-lg text-black/50 transition-colors cursor-pointer hover:bg-black/[0.05] hover:text-primary",
            open && "bg-black/[0.05] text-primary",
          )}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className="w-52 overflow-hidden rounded-xl border border-2 border-black bg-white p-0 br-bold">
        {entries.map((entry) => {
          const content = (
            <>
              <entry.icon className={cn("h-3.5 w-3.5 flex-none", entry.danger ? "text-[#b23c26]" : "text-black/55")} aria-hidden />
              <span className={cn(entry.danger && "text-[#b23c26]")}>{entry.label}</span>
            </>
          );
          return entry.href ? (
            <a
              key={entry.id}
              href={entry.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={MENU_ITEM}>
              {content}
            </a>
          ) : (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setOpen(false);
                entry.onSelect?.();
              }}
              className={cn(MENU_ITEM, entry.danger && "hover:bg-[#fdf4f2]")}>
              {content}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};

export interface DocRowProps {
  item: LibraryItem;
  renaming: boolean;
  onStartRename: () => void;
  onDoneRename: () => void;
}

const DocRow: FC<DocRowProps> = ({ item, renaming, onStartRename, onDoneRename }) => {
  const files = useDocuments();
  const created = useCreatedDocumentAction();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const doc = item.origin === "uploaded" ? item.doc : null;
  const isResume = item.kind === "resume";
  // Only an uploaded resume can be the master; the server refuses anything else too.
  const canBeMaster = doc !== null && isResume && !doc.archived && !doc.master;
  const Icon = KIND_ICONS[item.kind];
  const badge = doc ? sourceBadgeLabel(doc.source) : "Created here";
  const edit = editHref(item);

  const rename = (name: string) => {
    if (doc) files.rename(doc.id, name);
    else if (item.origin === "created") created.mutate({ kind: item.kind, id: item.id, type: "rename", name });
  };
  const toggleArchive = () => {
    if (doc) files.toggleArchive(doc.id);
    else if (item.origin === "created") created.mutate({ kind: item.kind, id: item.id, type: "archive", archived: !item.archived });
  };
  const remove = () => {
    setConfirmingRemove(false);
    if (doc) files.remove(doc.id);
    else if (item.origin === "created") created.mutate({ kind: item.kind, id: item.id, type: "remove" });
  };

  const entries: MenuEntry[] = [
    ...(canBeMaster && doc ? [{ id: "master", label: "Make master", icon: Star, onSelect: () => files.setMaster(doc.id) }] : []),
    ...(doc
      ? // Uploads hand back their original bytes.
        [{ id: "download", label: "Download", icon: Download, onSelect: () => downloadDoc(doc) }]
      : [
          { id: "pdf", label: "Download PDF", icon: Download, href: createdFileHref(item, "pdf") ?? undefined },
          { id: "docx", label: "Download Word", icon: Download, href: createdFileHref(item, "docx") ?? undefined },
        ]),
    { id: "rename", label: "Rename", icon: Pencil, onSelect: onStartRename },
    {
      id: "archive",
      label: item.archived ? "Unarchive" : "Archive",
      icon: item.archived ? ArchiveRestore : Archive,
      onSelect: toggleArchive,
    },
    { id: "remove", label: "Remove", icon: Trash2, onSelect: () => setConfirmingRemove(true), danger: true },
  ];

  const meta = (
    <>
      {[KIND_LABELS[item.kind], doc?.ext ? doc.ext.toUpperCase() : null, item.size !== null ? formatSize(item.size) : null]
        .filter(Boolean)
        .join(" · ")}
      {" · "}
      {doc ? (
        doc.updatedLabel
      ) : (
        <>
          edited <TimeAgo datetime={item.at} opts={{ minInterval: 60 }} />
        </>
      )}
    </>
  );

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
        {item.name}
      </span>
      {doc?.master && (
        <span
          className="inline-flex flex-none items-center gap-1 rounded-full bg-[#e1f073] px-2 py-0.5 text-[10px] font-bold text-[#222325]"
          title="Your master resume. Reviewers read this one when they consider you for recommendations.">
          <Star className="h-2.5 w-2.5" strokeWidth={3} />
          Master
        </span>
      )}
      {badge && (
        <span
          className="flex-none rounded-full bg-[#f0f0ea] px-2 py-0.5 text-[10px] font-bold text-black/55"
          title={doc ? undefined : "Made in RemoteWorldwide. Edit it any time; changes save to this same document."}>
          {badge}
        </span>
      )}
    </span>
  );

  // The icon and the name are one control: a made-here document opens in its
  // editor, an uploaded file opens itself.
  const OPEN_TARGET = "group/open flex min-w-0 flex-1 items-center gap-4 text-left cursor-pointer";
  const label = (
    <>
      {iconTile}
      <span className="min-w-0 flex-1">
        {title}
        <span className="mt-0.5 block truncate text-xs text-black/55">{meta}</span>
      </span>
    </>
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4", item.archived && !confirmingRemove && "opacity-55")}>
      {renaming ? (
        <>
          {iconTile}
          <RowRenamer name={item.name} onCommit={rename} onDone={onDoneRename} />
        </>
      ) : (
        <>
          {edit ? (
            <Link href={edit} className={OPEN_TARGET} title={`Edit ${item.name}`}>
              {label}
            </Link>
          ) : (
            <button type="button" onClick={() => doc && openDocFile(doc)} className={OPEN_TARGET} title={`Open ${item.name}`}>
              {label}
            </button>
          )}

          {confirmingRemove ? (
            <div className="flex flex-none items-center gap-3 text-xs font-bold">
              <span className="font-semibold text-black/55">
                {item.origin === "created" ? "Delete it for good?" : "Remove this file for good?"}
              </span>
              <button type="button" onClick={remove} className="cursor-pointer text-[#b23c26] underline decoration-2 underline-offset-2">
                {item.origin === "created" ? "Delete" : "Remove"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="cursor-pointer text-black/50 underline decoration-2 underline-offset-2">
                Keep
              </button>
            </div>
          ) : (
            <div className="flex flex-none items-center gap-1">
              {edit && (
                <Link href={edit} className={GHOST_BTN}>
                  <PenLine className="h-3.5 w-3.5" />
                  Edit
                </Link>
              )}
              <RowMenu name={item.name} entries={entries} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DocRow;
