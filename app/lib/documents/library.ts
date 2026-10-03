// My documents as one list (owner, 2026-10-03): the files someone uploaded
// (the backend's vault) and the resumes and cover letters they made here (the
// AI service's library), side by side under All / Resumes / Cover letters /
// Other / Archived.
//
// A made-here document is listed by REFERENCE, never copied into the vault: it
// is the editor's own document, so editing it changes nothing here and nothing
// is uploaded or deleted behind anyone's back. Only uploaded files are files.
// What each kind of row can do follows from that — a made-here row opens in
// its editor and downloads through `/open/…` (the same file the extension
// gets); an uploaded row opens and downloads its original bytes.
//
// Pure and type-only in its imports, like the other modules under test.

import type { DocKind, LetterSummary, ResumeDocumentSummary, VaultDoc } from "@/app/lib/dashboard/types";

export const LIBRARY_TABS = ["all", "resumes", "cover-letters", "other", "archived"] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number];

/** `/dashboard/vault?tab=resumes` — the editors' "See all" links land on their own tab. Anything else is All. */
export const tabFromParam = (value: string | null | undefined): LibraryTab =>
  (LIBRARY_TABS as readonly string[]).includes(value ?? "") ? (value as LibraryTab) : "all";

interface ItemBase {
  /** Unique across both sources: a vault id and a library id could in principle collide. */
  key: string;
  name: string;
  kind: DocKind;
  archived: boolean;
  /** Epoch ms: when a file was added, when a made-here document was last worked on. */
  at: number;
  size: number | null;
}

export type LibraryItem =
  | (ItemBase & { origin: "uploaded"; doc: VaultDoc })
  | (ItemBase & { origin: "created"; id: string; kind: "resume" | "cover-letter" });

export const uploadedItem = (doc: VaultDoc): LibraryItem => ({
  origin: "uploaded",
  key: `file:${doc.id}`,
  doc,
  name: doc.name,
  kind: doc.kind,
  archived: Boolean(doc.archived),
  at: doc.addedAt,
  size: doc.size ?? null,
});

/** A service from before archiving sends no `archived`: not archived. */
const createdItem = (kind: "resume" | "cover-letter", row: Pick<ResumeDocumentSummary | LetterSummary, "id" | "label" | "archived" | "updatedAt">): LibraryItem => ({
  origin: "created",
  key: `${kind}:${row.id}`,
  id: row.id,
  name: row.label,
  kind,
  archived: row.archived === true,
  at: new Date(row.updatedAt).getTime(),
  size: null,
});

export const createdResumeItem = (row: ResumeDocumentSummary): LibraryItem => createdItem("resume", row);
export const createdLetterItem = (row: LetterSummary): LibraryItem => createdItem("cover-letter", row);

/** Everything, from both sources. Order is the screen's to choose. */
export function libraryItems(files: readonly VaultDoc[], resumes: readonly ResumeDocumentSummary[], letters: readonly LetterSummary[]): LibraryItem[] {
  return [...files.map(uploadedItem), ...resumes.map(createdResumeItem), ...letters.map(createdLetterItem)];
}

/** Archived items live under Archived and nowhere else; Other is whatever is neither a resume nor a cover letter. */
export function inTab(item: LibraryItem, tab: LibraryTab): boolean {
  if (tab === "archived") return item.archived;
  if (item.archived) return false;
  if (tab === "resumes") return item.kind === "resume";
  if (tab === "cover-letters") return item.kind === "cover-letter";
  if (tab === "other") return item.kind !== "resume" && item.kind !== "cover-letter";
  return true;
}

export function tabCounts(items: readonly LibraryItem[]): Record<LibraryTab, number> {
  const counts = Object.fromEntries(LIBRARY_TABS.map((tab) => [tab, 0])) as Record<LibraryTab, number>;
  for (const item of items) for (const tab of LIBRARY_TABS) if (inTab(item, tab)) counts[tab] += 1;
  return counts;
}

/** Where a made-here document is edited. Null for an uploaded file: only what was made here is edited here. */
export function editHref(item: LibraryItem): string | null {
  if (item.origin !== "created") return null;
  return item.kind === "resume" ? `/dashboard/resume?doc=${encodeURIComponent(item.id)}` : `/dashboard/cover?letter=${encodeURIComponent(item.id)}`;
}

/** A made-here document as a file, through `/open/…` — the file the extension attaches. Null for an uploaded file. */
export function createdFileHref(item: LibraryItem, format: "pdf" | "docx"): string | null {
  if (item.origin !== "created") return null;
  return `/open/${item.kind === "resume" ? "resume" : "letter"}/${encodeURIComponent(item.id)}?to=${format}`;
}
