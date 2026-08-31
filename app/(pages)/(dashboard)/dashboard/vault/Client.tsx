"use client";

// My documents — every file the platform knows about, in one list.
//
// The documents themselves live in DocumentsProvider (app-wide) so the ATS
// scorer reads the same list; this screen owns only how they're browsed:
// tab, search, sort, pagination.

import { FC, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { HardDrive, Monitor, Plus, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import DashPagination, { PAGE_SIZE_OPTIONS, type PageSize } from "@/app/components/dashboard/ui/DashPagination";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import SplitButton from "@/app/components/dashboard/ui/SplitButton";
import { useDocuments, type DocKind, type VaultDoc } from "@/app/components/dashboard/documents/DocumentsProvider";
import DocRow, { KIND_LABELS } from "@/app/components/dashboard/vault/DocRow";
import DropZone from "@/app/components/dashboard/vault/DropZone";
import GoogleDriveImportDialog from "@/app/components/dashboard/vault/GoogleDriveImportDialog";

type VaultTab = "all" | "resumes" | "other" | "archived";
type SortKey = "recent" | "name" | "size";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "name", label: "Name" },
  { id: "size", label: "Size" },
];

// The kit an application can ask for — the readiness strip is coverage of
// these, derived from what's actually saved, not a hardcoded percentage.
const KIT: { kind: DocKind; label: string; href?: string }[] = [
  { kind: "resume", label: "Resume", href: "/dashboard/resume" },
  { kind: "cover-letter", label: "Cover letter", href: "/dashboard/cover" },
  { kind: "portfolio", label: "Portfolio" },
  { kind: "certificate", label: "Certificate" },
  { kind: "id", label: "ID document" },
];

const clampPage = (page: number, total: number) => Math.min(Math.max(page, 1), Math.max(total, 1));

function inTab(doc: VaultDoc, tab: VaultTab): boolean {
  if (tab === "archived") return !!doc.archived;
  if (doc.archived) return false;
  if (tab === "resumes") return doc.kind === "resume";
  if (tab === "other") return doc.kind !== "resume";
  return true;
}

const VaultClient: FC = () => {
  const { docs, addUploads } = useDocuments();

  const [tab, setTab] = useState<VaultTab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[0]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [driveOpen, setDriveOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const matches = docs.filter((d) => {
      if (!inTab(d, tab)) return false;
      if (!q) return true;
      return `${d.name} ${KIND_LABELS[d.kind]} ${d.ext ?? ""}`.toLowerCase().includes(q);
    });
    const sorted = [...matches];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "size") sorted.sort((a, b) => (b.size ?? -1) - (a.size ?? -1));
    else sorted.sort((a, b) => b.addedAt - a.addedAt);
    return sorted;
  }, [docs, tab, q, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = clampPage(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const active = docs.filter((d) => !d.archived);
  const counts: Record<VaultTab, number> = {
    all: active.length,
    resumes: active.filter((d) => d.kind === "resume").length,
    other: active.filter((d) => d.kind !== "resume").length,
    archived: docs.length - active.length,
  };

  // Application kit coverage — derived, so it moves when documents do.
  const presentKinds = new Set(active.map((d) => d.kind));
  const covered = KIT.filter((k) => presentKinds.has(k.kind));
  const missing = KIT.filter((k) => !presentKinds.has(k.kind));
  const kitPct = Math.round((covered.length / KIT.length) * 100);
  const totalBytes = active.reduce((sum, d) => sum + (d.size ?? 0), 0);

  /** A tab change abandons browsing state — page and any in-flight rename. */
  function changeTab(next: VaultTab) {
    setTab(next);
    setPage(1);
    setRenamingId(null);
  }

  function handlePicked(list: FileList | null) {
    if (list && list.length > 0) addUploads(list);
    if (fileRef.current) fileRef.current.value = "";
  }

  const emptyTitle =
    tab === "archived" ? "Nothing archived" : tab === "resumes" ? "No resumes yet" : tab === "other" ? "No other files yet" : "No documents yet";

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">My documents</h1>
          <span className="hidden truncate text-sm text-black/45 sm:inline">Everything you apply with, in one place</span>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <SplitButton
            label="Import"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => fileRef.current?.click()}
            items={[
              { id: "computer", label: "From your computer", icon: <Monitor className="h-3.5 w-3.5" />, onSelect: () => fileRef.current?.click() },
              { id: "drive", label: "From Google Drive", icon: <HardDrive className="h-3.5 w-3.5" />, onSelect: () => setDriveOpen(true) },
            ]}
          />
        </div>
      </header>

      {/* One input serves the split button, its menu item and nothing else —
          drag-and-drop hands files to the same addUploads. */}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        aria-label="Upload documents"
        onChange={(e) => handlePicked(e.target.files)}
      />

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        <DropZone onFiles={(files) => addUploads(files)}>
          {/* Application kit — derived coverage, not a hardcoded percentage. */}
          <DashCard className="mb-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <p className="text-[15px] font-bold text-primary">
                    Application kit: {covered.length} of {KIT.length} covered
                  </p>
                  <span className="text-xs text-black/55">
                    {counts.resumes} resume{counts.resumes === 1 ? "" : "s"} · {counts.other} other file{counts.other === 1 ? "" : "s"}
                    {totalBytes > 0 && ` · ${totalBytes >= 1_048_576 ? `${(totalBytes / 1_048_576).toFixed(1)} MB` : `${Math.round(totalBytes / 1024)} KB`}`}
                  </span>
                </div>
                <ProgressBar value={kitPct} className="max-w-md" />
                {missing.length > 0 ? (
                  <p className="mt-2.5 text-xs text-black/55">
                    Missing:{" "}
                    {missing.map((m, i) => (
                      <span key={m.kind}>
                        {i > 0 && ", "}
                        {m.href ? (
                          <Link href={m.href} className="font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
                            {m.label}
                          </Link>
                        ) : (
                          <span className="font-semibold text-black/70">{m.label}</span>
                        )}
                      </span>
                    ))}
                    {" — "}anything here can also just be dropped onto this page.
                  </p>
                ) : (
                  <p className="mt-2.5 text-xs text-black/55">Everything an application might ask for is on hand.</p>
                )}
              </div>
            </div>
          </DashCard>

          <div className="relative mb-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or type…"
              className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]"
            />
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <SlidingTabs
              value={tab}
              onChange={changeTab}
              options={[
                { id: "all", label: "All", count: counts.all },
                { id: "resumes", label: "Resumes", count: counts.resumes },
                { id: "other", label: "Other", count: counts.other },
                { id: "archived", label: "Archived", count: counts.archived },
              ]}
            />

            {/* Lime accent, not the tabs' ink — a refinement, not a peer nav. */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-black/55">Sort</span>
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={sort === s.id}
                  onClick={() => {
                    setSort(s.id);
                    setPage(1);
                  }}
                  className={cn(
                    "cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    sort === s.id ? "bg-[#e1f073] text-primary" : "text-black/55 hover:bg-[#f0f0ea] hover:text-primary"
                  )}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            q ? (
              <DashEmptyState
                icon={SearchX}
                title={`Nothing matches “${query.trim()}”`}
                body="Try a shorter search, or clear it to see everything saved here."
                ctaLabel="Clear search"
                onCta={() => setQuery("")}
              />
            ) : (
              <DashEmptyState
                lottieSrc="/Lottie/neobrutalism/Image_Folder_lottie.json"
                title={emptyTitle}
                body={
                  tab === "archived"
                    ? "Archive a document and it moves here — out of your pickers, never deleted."
                    : "Import from your computer or Google Drive, or drop files anywhere on this page."
                }
                ctaLabel={tab === "archived" ? "Show all documents" : "Import files"}
                onCta={tab === "archived" ? () => changeTab("all") : () => fileRef.current?.click()}
              />
            )
          ) : (
            <DashCard className="overflow-hidden p-0">
              <div className="flex flex-col divide-y divide-black/8">
                {paged.map((doc) => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    renaming={renamingId === doc.id}
                    onStartRename={() => setRenamingId(doc.id)}
                    onDoneRename={() => setRenamingId(null)}
                  />
                ))}
              </div>
            </DashCard>
          )}

          <DashPagination
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filtered.length}
            itemNoun="documents"
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              const firstVisible = (currentPage - 1) * pageSize;
              setPageSize(next);
              setPage(Math.floor(firstVisible / next) + 1);
            }}
          />
        </DropZone>
      </main>

      <GoogleDriveImportDialog open={driveOpen} onOpenChange={setDriveOpen} />
    </div>
  );
};

export default VaultClient;
