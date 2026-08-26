"use client";

// My documents — app-wide state.
//
// Mounted once in DashboardShell, beside AnswersProvider, for the same
// reason: two unrelated route trees read the same list. The vault edits it
// and the ATS scorer picks resumes from it — with separate state, a resume
// uploaded in one place simply didn't exist in the other.
//
// Mock-only: in-memory, resets on reload. Uploads are real File objects
// (name, size, type, an object URL for Download); their *contents* are never
// parsed — that is the seam a real backend fills.

import { createContext, useContext, useRef, useState, type FC, type ReactNode } from "react";
import { toast } from "sonner";
import { ATS_RESUMES, VAULT_DOCS } from "@/app/lib/dashboard/mock-data";
import type { DocKind, DocSource, VaultDoc } from "@/app/lib/dashboard/types";

export type { DocKind, DocSource, VaultDoc };

// Human strings the ATS table has always shown — moved here with the seeds.
const RESUME_UPDATED_LABELS: Record<string, string> = {
  "res-master": "Updated 2 days ago",
  "res-linear": "Tailored today",
  "res-deel": "Updated 6 days ago",
  "res-2023": "Not maintained",
};

const RESUME_JD_LABELS: Record<string, string> = { "res-linear": "Linear", "res-deel": "Deel" };

// Fixed epochs matching the labels above (Date.UTC is deterministic — no
// Date.now() at module scope).
const RESUME_ADDED_AT: Record<string, number> = {
  "res-master": Date.UTC(2026, 7, 24),
  "res-linear": Date.UTC(2026, 7, 26),
  "res-deel": Date.UTC(2026, 7, 20),
  "res-2023": Date.UTC(2024, 0, 15),
};

const SEED_DOCS: VaultDoc[] = [
  ...ATS_RESUMES.map<VaultDoc>((r) => ({
    id: r.id,
    name: r.name,
    kind: "resume",
    source: "created",
    addedAt: RESUME_ADDED_AT[r.id] ?? Date.UTC(2026, 7, 1),
    updatedLabel: RESUME_UPDATED_LABELS[r.id] ?? "Updated recently",
    archived: r.archived,
    jdScore: r.jdScore,
    jdLabel: RESUME_JD_LABELS[r.id],
  })),
  ...VAULT_DOCS,
];

/** Best-effort kind from the filename alone — nothing reads the contents. */
export function inferDocKind(filename: string): DocKind {
  const n = filename.toLowerCase();
  if (/resume|\bcv\b/.test(n)) return "resume";
  if (/cover/.test(n)) return "cover-letter";
  if (/portfolio|case.?stud/.test(n)) return "portfolio";
  if (/cert|diploma/.test(n)) return "certificate";
  if (/passport|\bid\b|identity|visa|permit|licen[cs]e/.test(n)) return "id";
  return "other";
}

/** Badge text for where a document came from; created-in-app needs none. */
export function sourceBadgeLabel(source: DocSource): string | null {
  if (source === "uploaded") return "Uploaded";
  if (source === "linkedin") return "LinkedIn";
  return null;
}

interface DocumentsContextValue {
  docs: VaultDoc[];
  /** Registers real files (name/size/type off the File object) with a live
   *  object URL each, so Download works. Returns the new entries. */
  addUploads: (files: FileList | File[], opts?: { kind?: DocKind }) => VaultDoc[];
  /** Adds the sample LinkedIn profile import; dedupes on a second run. */
  importLinkedIn: () => VaultDoc;
  rename: (id: string, name: string) => void;
  /** Delete with a real Undo; the blob URL is only revoked once undo lapses. */
  remove: (id: string) => void;
  toggleArchive: (id: string) => void;
}

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

export const DocumentsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [docs, setDocs] = useState<VaultDoc[]>(SEED_DOCS);

  // Ref, not a local — a plain counter would reset on every render.
  const uploadSeq = useRef(0);

  function addUploads(list: FileList | File[], opts?: { kind?: DocKind }): VaultDoc[] {
    const files = Array.from(list);
    if (files.length === 0) return [];

    const added = files.map<VaultDoc>((file) => {
      const dot = file.name.lastIndexOf(".");
      return {
        id: `doc-upload-${++uploadSeq.current}`,
        name: dot > 0 ? file.name.slice(0, dot) : file.name,
        kind: opts?.kind ?? inferDocKind(file.name),
        source: "uploaded",
        size: file.size,
        ext: dot > 0 ? file.name.slice(dot + 1).toLowerCase() : undefined,
        addedAt: Date.now(),
        updatedLabel: "Uploaded just now",
        blobUrl: URL.createObjectURL(file),
      };
    });

    setDocs((prev) => [...added, ...prev]);
    toast.success(added.length === 1 ? "File added" : `${added.length} files added`, {
      description: added.length === 1 ? added[0].name : added.map((d) => d.name).join(" · "),
    });
    return added;
  }

  function importLinkedIn(): VaultDoc {
    const existing = docs.find((d) => d.source === "linkedin");
    if (existing) {
      toast("Already imported", { description: `"${existing.name}" is in your documents.` });
      return existing;
    }

    const doc: VaultDoc = {
      id: "doc-linkedin",
      name: "LinkedIn profile",
      kind: "resume",
      source: "linkedin",
      size: 389_120, // ~380 KB
      ext: "pdf",
      addedAt: Date.now(),
      updatedLabel: "Imported just now",
    };
    setDocs((prev) => [doc, ...prev]);
    toast.success("LinkedIn profile imported", { description: "Saved as a resume — it's scoreable in the ATS too." });
    return doc;
  }

  function rename(id: string, name: string) {
    const next = name.trim();
    if (!next) return;
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, name: next } : d)));
  }

  function remove(id: string) {
    const index = docs.findIndex((d) => d.id === id);
    if (index === -1) return;
    const removed = docs[index];

    setDocs((prev) => prev.filter((d) => d.id !== id));

    // The blob URL must outlive the toast: undo restores a doc whose Download
    // still works. It's revoked only once the undo window has lapsed.
    let undone = false;
    const revoke = () => {
      if (!undone && removed.blobUrl) URL.revokeObjectURL(removed.blobUrl);
    };
    toast("Document removed", {
      description: removed.name,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          setDocs((prev) => {
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, removed);
            return next;
          });
        },
      },
      onDismiss: revoke,
      onAutoClose: revoke,
    });
  }

  function toggleArchive(id: string) {
    const doc = docs.find((d) => d.id === id);
    if (!doc) return;
    const archiving = !doc.archived;
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, archived: archiving } : d)));
    toast(archiving ? "Archived" : "Restored", {
      description: archiving ? `"${doc.name}" is hidden from pickers.` : `"${doc.name}" is back in your documents.`,
    });
  }

  return (
    <DocumentsContext.Provider value={{ docs, addUploads, importLinkedIn, rename, remove, toggleArchive }}>
      {children}
    </DocumentsContext.Provider>
  );
};

export function useDocuments(): DocumentsContextValue {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocuments must be used within DocumentsProvider");
  return ctx;
}

/** 1 884 160 -> "1.8 MB", 245 760 -> "240 KB". */
export function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
