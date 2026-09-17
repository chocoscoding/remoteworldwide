"use client";

// My documents — backed by the API.
//
// The context surface is unchanged from the mock it replaces, so the vault, the
// ATS screen and DocRow read it exactly as before. One signature had to move:
// `addUploads` is async now, because a real upload is a round trip.
//
// Files live in Bunny Storage and are fetched through a short-lived signed URL
// minted per click, never a stored link — a signed URL is a bearer credential
// with an expiry, so it has no business sitting in a cached list.

import { createContext, useContext, useMemo, type FC, type ReactNode } from "react";
import { toast } from "sonner";
import { useDocumentsQuery } from "@/hooks/queries/useDocumentsQuery";
import { useArchiveDocument, useDeleteDocument, useRenameDocument, useUploadDocument } from "@/hooks/mutations/useDocumentMutations";
import type { DocKind, DocSource, VaultDoc } from "@/app/lib/dashboard/types";

// Re-exported so the vault, DocRow and the ATS screens keep importing their
// types from the provider they already import the helpers from.
export type { DocKind, DocSource, VaultDoc };

/** Guesses a kind from a filename. The server does the same, and wins. */
export function inferDocKind(filename: string): DocKind {
  const name = filename.toLowerCase();
  if (/resume|\bcv\b/.test(name)) return "resume";
  if (/cover/.test(name)) return "cover-letter";
  if (/portfolio|case.?stud/.test(name)) return "portfolio";
  if (/cert|diploma/.test(name)) return "certificate";
  if (/passport|\bid\b|identity|visa|permit|licen[cs]e/.test(name)) return "id";
  return "other";
}

export function sourceBadgeLabel(source: DocSource): string | null {
  if (source === "uploaded") return "Uploaded";
  if (source === "google-drive") return "Google Drive";
  return null;
}

export const KIND_LABELS: Record<DocKind, string> = {
  resume: "resume",
  "cover-letter": "Cover letter",
  portfolio: "Portfolio",
  certificate: "Certificate",
  id: "ID document",
  other: "File",
};

export interface DriveFile {
  id: string;
  name: string;
  ext?: string;
  size?: number;
  kind?: DocKind;
}

export const driveDocId = (fileId: string) => `doc-drive-${fileId}`;

/** 1 884 160 -> "1.8 MB", 245 760 -> "240 KB". */
export function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * The in-app destination for a document, if it has one. Resumes and cover
 * letters are things you edit here; everything else is just a file.
 */
export function editorHrefFor(doc: VaultDoc): string | null {
  if (doc.kind === "resume") return "/dashboard/resume";
  if (doc.kind === "cover-letter") return "/dashboard/cover";
  return null;
}

/** Asks the backend for a signed CDN URL. Ownership is checked there. */
async function signedUrl(id: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/documents/${id}/link`, { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { data?: { url?: string } };
    return body.data?.url ?? null;
  } catch {
    toast.error("That file could not be opened. Try again.");
    return null;
  }
}

/**
 * Opens a document in a new tab. The tab is opened *before* the await: a
 * popup blocker only trusts a window opened straight out of the click.
 */
export function openDocFile(doc: VaultDoc): void {
  const tab = window.open("", "_blank", "noopener,noreferrer");
  void signedUrl(doc.id).then((url) => {
    if (!url) {
      tab?.close();
      return;
    }
    if (tab) tab.location.href = url;
    else window.open(url, "_blank", "noopener,noreferrer");
  });
}

/** Saves the real bytes. No placeholder — every document now has a file behind it. */
export function downloadDoc(doc: VaultDoc): void {
  void signedUrl(doc.id).then((url) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.ext ? `${doc.name}.${doc.ext}` : doc.name;
    a.click();
  });
}

interface DocumentsContextValue {
  docs: VaultDoc[];
  loading: boolean;
  /** Async now: an upload is a round trip. Returns the rows the server created. */
  addUploads: (files: FileList | File[], opts?: { kind?: DocKind }) => Promise<VaultDoc[]>;
  importFromDrive: (files: DriveFile[]) => VaultDoc[];
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  toggleArchive: (id: string) => void;
}

const DocumentsCtx = createContext<DocumentsContextValue | null>(null);

export const DocumentsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { data, isLoading } = useDocumentsQuery();
  const upload = useUploadDocument();
  const renameDoc = useRenameDocument();
  const archiveDoc = useArchiveDocument();
  const deleteDoc = useDeleteDocument();

  const docs = useMemo(() => data ?? [], [data]);

  async function addUploads(files: FileList | File[], opts?: { kind?: DocKind }): Promise<VaultDoc[]> {
    const list = Array.from(files);
    // Sequential rather than parallel: a dropped folder of ten files should not
    // open ten concurrent uploads on someone's home connection.
    const created: VaultDoc[] = [];
    for (const file of list) {
      try {
        created.push(await upload.mutateAsync({ file, kind: opts?.kind }));
      } catch {
        // useDocumentAction already surfaced the reason; keep going so one bad
        // file in a batch does not abandon the rest.
      }
    }
    return created;
  }

  function importFromDrive(_files: DriveFile[]): VaultDoc[] {
    toast("Google Drive isn't connected yet", { description: "Import from your computer in the meantime." });
    return [];
  }

  return (
    <DocumentsCtx.Provider
      value={{
        docs,
        loading: isLoading,
        addUploads,
        importFromDrive,
        rename: (id, name) => {
          const next = name.trim();
          if (next) renameDoc.mutate({ id, name: next });
        },
        remove: (id) => deleteDoc.mutate(id),
        toggleArchive: (id) => {
          const doc = docs.find((d) => d.id === id);
          if (doc) archiveDoc.mutate({ id, archived: !doc.archived });
        },
      }}>
      {children}
    </DocumentsCtx.Provider>
  );
};

export default DocumentsProvider;

export function useDocuments(): DocumentsContextValue {
  const ctx = useContext(DocumentsCtx);
  if (!ctx) throw new Error("useDocuments must be used within DocumentsProvider");
  return ctx;
}
