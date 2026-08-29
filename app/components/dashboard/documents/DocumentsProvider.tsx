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
  if (source === "google-drive") return "Google Drive";
  return null;
}

export const KIND_LABELS: Record<DocKind, string> = {
  resume: "Resume",
  "cover-letter": "Cover letter",
  portfolio: "Portfolio",
  certificate: "Certificate",
  id: "ID document",
  other: "File",
};

/**
 * A file as the Google Drive picker hands it back — deliberately the small
 * subset the vault actually stores. The real Drive API returns far more, and
 * nothing here should start depending on fields we do not need.
 */
export interface DriveFile {
  /** Drive's own file id. Stable, so it doubles as the dedupe key. */
  id: string;
  name: string;
  ext?: string;
  size?: number;
  /** Set when the picker already knows the kind; otherwise inferred from the name. */
  kind?: DocKind;
}

/** One place decides how a Drive file id becomes a document id. */
export const driveDocId = (fileId: string) => `doc-drive-${fileId}`;

interface DocumentsContextValue {
  docs: VaultDoc[];
  /** Registers real files (name/size/type off the File object) with a live
   *  object URL each, so Download works. Returns the new entries. */
  addUploads: (files: FileList | File[], opts?: { kind?: DocKind }) => VaultDoc[];
  /** Imports the picked Google Drive files. Anything already imported is skipped. */
  importFromDrive: (files: DriveFile[]) => VaultDoc[];
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

  function importFromDrive(files: DriveFile[]): VaultDoc[] {
    // Drive ids are stable, so re-importing the same file is a no-op rather
    // than a duplicate row — the picker shows those as already imported.
    const taken = new Set(docs.map((d) => d.id));
    const fresh = files.filter((f) => !taken.has(driveDocId(f.id)));

    if (fresh.length === 0) {
      toast("Nothing new to import", { description: "Those files are already in your documents." });
      return [];
    }

    const added = fresh.map<VaultDoc>((f) => ({
      id: driveDocId(f.id),
      name: f.name,
      kind: f.kind ?? inferDocKind(f.name),
      source: "google-drive",
      size: f.size,
      ext: f.ext,
      addedAt: Date.now(),
      updatedLabel: "Imported just now",
    }));

    setDocs((prev) => [...added, ...prev]);
    toast.success(added.length === 1 ? "Imported from Drive" : `${added.length} files imported from Drive`, {
      description: added.map((d) => d.name).join(" · "),
    });
    return added;
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
    <DocumentsContext.Provider value={{ docs, addUploads, importFromDrive, rename, remove, toggleArchive }}>
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

// ---------------------------------------------------------------------------
// Download — every document downloads. Uploads hand back their original
// bytes via the stored object URL; everything else (seeds, in-app resumes)
// gets a small valid PDF generated at click time, so the button never lies.
// ---------------------------------------------------------------------------

/** PDF () strings take Latin text; offsets below assume 1 byte per char. */
const toAscii = (s: string) =>
  s
    .replace(/[—–]/g, "-")
    .replace(/·/g, ".")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, "-");

/**
 * A minimal single-page PDF, built by hand with a correct xref table —
 * ~40 lines beats a PDF library dependency for a title and a few lines.
 */
function buildPlaceholderPdf(title: string, lines: string[]): Blob {
  const esc = (s: string) => toAscii(s).replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = [
    "BT",
    "/F1 20 Tf 72 716 Td",
    `(${esc(title)}) Tj`,
    "/F1 12 Tf 18 TL 0 -36 Td",
    ...lines.map((l) => `(${esc(l)}) Tj T*`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

/** Triggers a real download for any document. Plain function — no state. */
/**
 * The in-app destination for a document, if it has one. Resumes and cover
 * letters are things you edit here; everything else is just a file.
 */
export function editorHrefFor(doc: VaultDoc): string | null {
  if (doc.kind === "resume") return "/dashboard/resume";
  if (doc.kind === "cover-letter") return "/dashboard/cover";
  return null;
}

/**
 * Views a file rather than saving it — same source of bytes as `downloadDoc`
 * (the upload's own blob, or a generated summary PDF), opened in a new tab.
 * Only for documents with no editor of their own; `editorHrefFor` covers those.
 */
export function openDocFile(doc: VaultDoc): void {
  if (doc.blobUrl) {
    window.open(doc.blobUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const lines = [
    `Type: ${KIND_LABELS[doc.kind]}`,
    doc.size != null ? `Original size: ${formatSize(doc.size)}` : `Created in Remote Worldwide`,
    doc.updatedLabel,
    "",
    "Sample export - this build doesn't store the original file.",
  ];
  const url = URL.createObjectURL(buildPlaceholderPdf(doc.name, lines));
  window.open(url, "_blank", "noopener,noreferrer");
  // Long enough for the new tab to have loaded it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadDoc(doc: VaultDoc): void {
  let url: string;
  let filename: string;

  if (doc.blobUrl) {
    // The upload's actual bytes.
    url = doc.blobUrl;
    filename = doc.ext ? `${doc.name}.${doc.ext}` : doc.name;
  } else {
    const lines = [
      `Type: ${KIND_LABELS[doc.kind]}`,
      doc.size != null ? `Original size: ${formatSize(doc.size)}` : `Created in Remote Worldwide`,
      doc.updatedLabel,
      "",
      "Sample export - this build doesn't store the original file.",
    ];
    url = URL.createObjectURL(buildPlaceholderPdf(doc.name, lines));
    filename = `${doc.name}.pdf`;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  if (!doc.blobUrl) setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
