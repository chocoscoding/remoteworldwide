"use client";

// My documents — every document the platform knows about, in one list: the
// files someone uploaded, and the resumes and cover letters they made here,
// listed by reference (app/lib/documents/library.ts — editing one in its
// editor changes it here; nothing is copied or re-uploaded).
//
// The uploaded files live in DocumentsProvider (app-wide) so the ATS scorer
// reads the same list; the made-here ones come from the AI service's library
// (useCreatedDocuments). This screen owns only how they're browsed: tab (in
// the address, so the editors' "See all" links open Resumes or Cover letters),
// search, sort, pagination.

import { FC, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import DashPagination, { PAGE_SIZE_OPTIONS, type PageSize } from "@/app/components/dashboard/ui/DashPagination";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { useDocuments, type DocKind } from "@/app/components/dashboard/documents/DocumentsProvider";
import DocRow, { KIND_LABELS } from "@/app/components/dashboard/vault/DocRow";
import DropZone from "@/app/components/dashboard/vault/DropZone";
import { inTab, libraryItems, tabCounts, tabFromParam, type LibraryTab } from "@/app/lib/documents/library";
import { useCreatedDocuments } from "@/hooks/queries/useCreatedDocuments";

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

const EMPTY_TITLES: Record<LibraryTab, string> = {
  all: "No documents yet",
  resumes: "No resumes yet",
  "cover-letters": "No cover letters yet",
  other: "No other files yet",
  archived: "Nothing archived",
};

const VaultClient: FC = () => {
  const { docs, addUploads } = useDocuments();
  const { resumes, letters } = useCreatedDocuments();

  // The tab is the address's, so "See all" from an editor lands on its own.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = tabFromParam(params.get("tab"));

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[0]);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const q = query.trim().toLowerCase();

  const items = useMemo(() => libraryItems(docs, resumes.data ?? [], letters.data ?? []), [docs, resumes.data, letters.data]);

  const filtered = useMemo(() => {
    const matches = items.filter((item) => {
      if (!inTab(item, tab)) return false;
      if (!q) return true;
      const ext = item.origin === "uploaded" ? (item.doc.ext ?? "") : "";
      return `${item.name} ${KIND_LABELS[item.kind]} ${ext}`.toLowerCase().includes(q);
    });
    const sorted = [...matches];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "size") sorted.sort((a, b) => (b.size ?? -1) - (a.size ?? -1));
    else sorted.sort((a, b) => b.at - a.at);
    return sorted;
  }, [items, tab, q, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = clampPage(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const counts = tabCounts(items);
  const activeFiles = docs.filter((d) => !d.archived);
  const createdLoading = resumes.isPending || letters.isPending;
  const createdFailed = resumes.isError || letters.isError;

  // Application kit coverage — derived, so it moves when documents do. A resume or letter made here counts.
  const presentKinds = new Set(items.filter((item) => !item.archived).map((item) => item.kind));
  const covered = KIT.filter((k) => presentKinds.has(k.kind));
  const missing = KIT.filter((k) => !presentKinds.has(k.kind));
  const kitPct = Math.round((covered.length / KIT.length) * 100);
  const totalBytes = activeFiles.reduce((sum, d) => sum + (d.size ?? 0), 0);
  // The resume reviewers read — always an uploaded file. Recommendations need one, so its absence is said out loud.
  const masterResume = activeFiles.find((d) => d.master && d.kind === "resume");
  const uploadedResumes = activeFiles.filter((d) => d.kind === "resume").length;

  /** A tab change abandons browsing state — page and any in-flight rename. */
  function changeTab(next: LibraryTab) {
    router.replace(next === "all" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
    setPage(1);
    setRenamingId(null);
  }

  function handlePicked(list: FileList | null) {
    if (list && list.length > 0) addUploads(list);
    if (fileRef.current) fileRef.current.value = "";
  }

  const emptyTitle = EMPTY_TITLES[tab];

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">My documents</h1>
          <span className="hidden truncate text-sm text-black/45 sm:inline">Everything you apply with, in one place</span>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <StickerButton variant="primary" size="sm" onClick={() => fileRef.current?.click()}>
            <Plus className="h-3.5 w-3.5" />
            Import
          </StickerButton>
          <NotificationBell />
        </div>
      </header>

      {/* One input serves the Import button and nothing else — drag-and-drop
          hands files to the same addUploads. */}
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
          <div className="mb-6 rounded-2xl bg-[#222325] p-6 text-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <p className="text-[15px] font-bold text-white">
                    Application kit: {covered.length} of {KIT.length} covered
                  </p>
                  <span className="text-xs text-white/55">
                    {counts.resumes} resume{counts.resumes === 1 ? "" : "s"} · {counts["cover-letters"]} cover letter
                    {counts["cover-letters"] === 1 ? "" : "s"} · {counts.other} other file{counts.other === 1 ? "" : "s"}
                    {totalBytes > 0 &&
                      ` · ${totalBytes >= 1_048_576 ? `${(totalBytes / 1_048_576).toFixed(1)} MB` : `${Math.round(totalBytes / 1024)} KB`}`}
                  </span>
                </div>
                <ProgressBar value={kitPct} dark className="max-w-md" />
                {missing.length > 0 ? (
                  <p className="mt-2.5 text-xs text-white/55">
                    Missing:{" "}
                    {missing.map((m, i) => (
                      <span key={m.kind}>
                        {i > 0 && ", "}
                        {m.href ? (
                          <Link
                            href={m.href}
                            className="font-semibold text-secondary underline decoration-dotted underline-offset-2 hover:decoration-solid">
                            {m.label}
                          </Link>
                        ) : (
                          <span className="font-semibold text-white/80">{m.label}</span>
                        )}
                      </span>
                    ))}
                    {". "}Anything here can also just be dropped onto this page.
                  </p>
                ) : (
                  <p className="mt-2.5 text-xs text-white/55">Everything an application might ask for is on hand.</p>
                )}
                {masterResume ? (
                  <p className="mt-1.5 text-xs text-white/55">
                    Master resume: <span className="font-semibold text-white/80">{masterResume.name}</span>, what reviewers read when they
                    consider you.
                  </p>
                ) : uploadedResumes > 0 ? (
                  <p className="mt-1.5 text-xs text-white/55">
                    <span className="font-semibold text-secondary">No master resume yet</span>. Pick one below with “Make master” so
                    reviewers can consider you for recommendations.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

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

          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <SlidingTabs
              value={tab}
              onChange={changeTab}
              options={[
                { id: "all", label: "All", count: counts.all },
                { id: "resumes", label: "Resumes", count: counts.resumes },
                { id: "cover-letters", label: "Cover letters", count: counts["cover-letters"] },
                { id: "other", label: "Others", count: counts.other },
                { id: "archived", label: "Archived", count: counts.archived, className: "text-red-800", activeClassName: "text-red-500" },
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
                    sort === s.id ? "bg-[#e1f073] text-primary" : "text-black/55 hover:bg-[#f0f0ea] hover:text-primary",
                  )}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {createdFailed && (
            <p className="mb-4 rounded-xl border border-black/10 bg-white px-4 py-3 text-xs text-black/60">
              The resumes and cover letters you made here couldn&apos;t be loaded.{" "}
              <button
                type="button"
                onClick={() => {
                  if (resumes.isError) void resumes.refetch();
                  if (letters.isError) void letters.refetch();
                }}
                className="cursor-pointer font-bold text-primary underline decoration-2 underline-offset-2">
                Try again
              </button>
            </p>
          )}

          {filtered.length === 0 && createdLoading && tab !== "other" ? (
            <p className="flex items-center justify-center gap-2 py-10 text-xs text-black/45" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading your documents…
            </p>
          ) : filtered.length === 0 ? (
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
                    ? "Archive a document and it moves here: out of your pickers, never deleted."
                    : "Import from your computer, or drop files anywhere on this page."
                }
                ctaLabel={tab === "archived" ? "Show all documents" : "Import files"}
                onCta={tab === "archived" ? () => changeTab("all") : () => fileRef.current?.click()}
              />
            )
          ) : (
            <DashCard className="overflow-hidden p-0">
              <div className="flex flex-col divide-y divide-black/8">
                {paged.map((item) => (
                  <DocRow
                    key={item.key}
                    item={item}
                    renaming={renamingId === item.key}
                    onStartRename={() => setRenamingId(item.key)}
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
    </div>
  );
};

export default VaultClient;
