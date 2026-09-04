"use client";

// Application answers — the library the extension fills forms from.
//
// The answers themselves live in AnswersProvider (app-wide) so the apply
// wizard reads the same list; this screen owns only how they're browsed:
// tab, search, filter, pagination.

import { FC, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, PlugZap, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import DashPagination, { PAGE_SIZE_OPTIONS, type PageSize } from "@/app/components/dashboard/ui/DashPagination";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useAnswers } from "@/app/components/dashboard/answers/AnswersProvider";
import { APPS } from "@/app/lib/dashboard/mock-data";
import type { QaItem } from "@/app/lib/dashboard/types";
import AnswerRow from "@/app/components/dashboard/questions/AnswerRow";
import ApplicationRow from "@/app/components/dashboard/questions/ApplicationRow";
import AddAnswerDialog from "@/app/components/dashboard/questions/AddAnswerDialog";
import ExtensionDialog from "@/app/components/dashboard/questions/ExtensionDialog";

type VaultTab = "answers" | "by-application";
type QaFilter = "all" | "review" | "saved" | "ai" | "demographics";

function matchesFilter(item: QaItem, filter: QaFilter): boolean {
  switch (filter) {
    case "review":
      return item.kind === "review";
    case "saved":
      return item.kind === "saved";
    case "ai":
      return item.kind === "ai";
    case "demographics":
      return item.cat === "demographics";
    default:
      return true;
  }
}

const clampPage = (page: number, total: number) => Math.min(Math.max(page, 1), Math.max(total, 1));

const QuestionsClient: FC = () => {
  const { items, reviewCount } = useAnswers();

  const [vaultTab, setVaultTab] = useState<VaultTab>("answers");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QaFilter>("all");
  const [howOpen, setHowOpen] = useState(false);
  const [openAnswerIds, setOpenAnswerIds] = useState<Set<string>>(new Set());
  const [openAppIds, setOpenAppIds] = useState<Set<string>>(new Set());
  const [answersPage, setAnswersPage] = useState(1);
  const [appsPage, setAppsPage] = useState(1);
  // Shared across both tabs — a per-tab page size would be one preference too
  // many for a browsing control.
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[0]);
  const [addOpen, setAddOpen] = useState(false);
  const [extensionOpen, setExtensionOpen] = useState(false);

  const q = query.trim().toLowerCase();

  // Search covers the answer body too — the old version matched the question
  // only, so searching for a phrase you'd written found nothing.
  const filteredAnswers = useMemo(
    () =>
      items.filter((item) => {
        if (!matchesFilter(item, filter)) return false;
        if (!q) return true;
        return `${item.q} ${item.a} ${item.draft ?? ""}`.toLowerCase().includes(q);
      }),
    [items, filter, q],
  );

  const filteredApps = useMemo(
    () =>
      APPS.filter((app) => {
        if (!q) return true;
        const haystack = `${app.title} ${app.meta} ${app.qs.map((p) => `${p.q} ${p.a}`).join(" ")}`;
        return haystack.toLowerCase().includes(q);
      }),
    [q],
  );

  const answersTotalPages = Math.max(1, Math.ceil(filteredAnswers.length / pageSize));
  const appsTotalPages = Math.max(1, Math.ceil(filteredApps.length / pageSize));
  const currentAnswersPage = clampPage(answersPage, answersTotalPages);
  const currentAppsPage = clampPage(appsPage, appsTotalPages);
  const pagedAnswers = filteredAnswers.slice((currentAnswersPage - 1) * pageSize, currentAnswersPage * pageSize);
  const pagedApps = filteredApps.slice((currentAppsPage - 1) * pageSize, currentAppsPage * pageSize);

  /** Resizing keeps you near what you were reading rather than at page 1. */
  function changePageSize(next: PageSize) {
    const firstVisible = (vaultTab === "answers" ? currentAnswersPage - 1 : currentAppsPage - 1) * pageSize;
    const landing = Math.floor(firstVisible / next) + 1;
    setPageSize(next);
    if (vaultTab === "answers") setAnswersPage(landing);
    else setAppsPage(landing);
  }

  const filterOptions: { id: QaFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: items.length },
    { id: "review", label: "Needs review", count: items.filter((i) => i.kind === "review").length },
    { id: "saved", label: "Saved by you", count: items.filter((i) => i.kind === "saved").length },
    { id: "ai", label: "AI answered", count: items.filter((i) => i.kind === "ai").length },
    { id: "demographics", label: "Demographics", count: items.filter((i) => i.cat === "demographics").length },
  ];

  /** A tab change abandons browsing state — stale pages and half-open rows
   *  from the other tab were the old screen's most confusing carry-over. */
  function changeTab(next: VaultTab) {
    setVaultTab(next);
    setAnswersPage(1);
    setAppsPage(1);
    setOpenAnswerIds(new Set());
    setOpenAppIds(new Set());
  }

  /** Target of the review count in the summary line. */
  function showReviewFilter() {
    setVaultTab("answers");
    setFilter("review");
    setAnswersPage(1);
  }

  function toggleId(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Application answers</h1>
          <span className="hidden truncate text-sm text-black/45 sm:inline">Answer once, reused on every application</span>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <button
            type="button"
            onClick={() => setExtensionOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/12 bg-white px-3 py-1.5 text-xs font-semibold text-black/60 transition-colors hover:border-[#222325] hover:text-primary cursor-pointer">
            <PlugZap className="h-3 w-3 text-[#6c7a1e]" />
            Extension connected
          </button>
          <StickerButton variant="primary" size="md" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add an answer
          </StickerButton>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        {/* Derived from the library, so it moves when the library does. The
            review count is the jump to its own filter — it used to be restated
            verbatim in a banner directly underneath. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-black/60">
            <span className="font-bold text-primary">{items.length} answers</span> saved ·{" "}
            {reviewCount > 0 ? (
              <button
                type="button"
                onClick={showReviewFilter}
                className="cursor-pointer font-bold text-primary underline decoration-2 underline-offset-4 transition-colors hover:text-[#6c7a1e] hover:decoration-[#6c7a1e]">
                {reviewCount} need{reviewCount === 1 ? "s" : ""} your review
              </button>
            ) : (
              <span className="font-bold text-black/45">0 need your review</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setHowOpen((v) => !v)}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline">
            How this works
            {howOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            howOpen ? "mb-5 max-h-[400px] opacity-100" : "max-h-0 opacity-0",
          )}>
          <DashCard className="bg-[#fbfbf7] p-5">
            <p className="mb-2 text-sm font-bold text-primary">How the extension uses this library</p>
            <p className="mb-3 text-sm leading-relaxed text-black/60">
              The Remote Worldwide extension reads everything saved here and fills matching questions when you apply on a company&apos;s own
              site. When it can&apos;t find a confident match it drafts its best guess and flags it below — nothing goes out under your name
              until you resolve it.
            </p>
            <ul className="flex flex-col gap-1.5 text-xs text-black/55">
              <li>• Recognises matching questions across 200+ applicant-tracking platforms</li>
              <li>
                • Swaps <code className="rounded bg-[#f0f0ea] px-1 font-mono text-[11px]">{"{company}"}</code> for whoever you&apos;re
                applying to
              </li>
              <li>• Flags anything it&apos;s unsure about instead of guessing silently</li>
            </ul>
          </DashCard>
        </div>

        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAnswersPage(1);
              setAppsPage(1);
            }}
            placeholder={vaultTab === "answers" ? "Search questions and answers…" : "Search applications and their answers…"}
            className="h-11 w-full rounded-xl border border-black/10 bg-white pl-10 pr-4 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]"
          />
        </div>

        <SlidingTabs
          className="mb-5"
          value={vaultTab}
          onChange={changeTab}
          options={[
            { id: "answers", label: "Answers", count: items.length },
            { id: "by-application", label: "By application", count: APPS.length },
          ]}
        />

        {vaultTab === "answers" ? (
          <div>
            {/* Accent fill, not ink. These filters refine what's inside the
                selected tab, so they must not repeat the tabs' ink-on-dark
                treatment one row below it — two identical fills stacked read as
                two peer navigations rather than a control and its refinement. */}
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {filterOptions.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => {
                    setFilter(f.id);
                    setAnswersPage(1);
                  }}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    filter === f.id ? "bg-[#e1f073] text-primary" : "text-black/55 hover:bg-[#f0f0ea] hover:text-primary",
                  )}>
                  {f.label}
                  {/* The count is subordinate by WEIGHT, not by lightness. On
                      these near-white surfaces nothing below ~black/54 clears
                      4.5:1, so the old black/35 (2.4:1) could not be fixed by
                      nudging the tone — dropping to font-normal against the
                      pill's semibold label is what carries the hierarchy. */}
                  <span className={cn("font-normal tabular-nums", filter === f.id ? "text-black/60" : "text-black/55")}>{f.count}</span>
                </button>
              ))}
            </div>

            {filteredAnswers.length === 0 ? (
              // Blames the right thing: a search that found nothing vs. a
              // filter with nothing in it.
              q ? (
                <DashEmptyState
                  lottieSrc="/Lottie/neobrutalism/Copy_Clipboard_lottie.json"
                  title={`Nothing matches “${query.trim()}”`}
                  body="Try a shorter search, or clear it to see everything you've saved."
                  ctaLabel="Clear search"
                  onCta={() => setQuery("")}
                />
              ) : (
                <DashEmptyState
                  lottieSrc="/Lottie/neobrutalism/Copy_Clipboard_lottie.json"
                  title="Nothing in this filter"
                  body="You haven't got any answers in this category yet."
                  ctaLabel="Show all answers"
                  onCta={() => setFilter("all")}
                />
              )
            ) : (
              <div className="flex flex-col gap-2.5">
                {pagedAnswers.map((item) => (
                  <AnswerRow
                    key={item.id}
                    item={item}
                    open={openAnswerIds.has(item.id)}
                    onToggle={() => toggleId(openAnswerIds, setOpenAnswerIds, item.id)}
                  />
                ))}
              </div>
            )}

            <DashPagination
              page={currentAnswersPage}
              totalPages={answersTotalPages}
              pageSize={pageSize}
              totalItems={filteredAnswers.length}
              itemNoun="answers"
              onPageChange={setAnswersPage}
              onPageSizeChange={changePageSize}
            />
          </div>
        ) : (
          <div>
            {filteredApps.length === 0 ? (
              <DashEmptyState
                lottieSrc="/Lottie/neobrutalism/Copy_Clipboard_lottie.json"
                title={`No applications match “${query.trim()}”`}
                body="Try a shorter search, or clear it to see every application you've sent."
                ctaLabel="Clear search"
                onCta={() => setQuery("")}
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {pagedApps.map((app) => (
                  <ApplicationRow
                    key={app.id}
                    app={app}
                    open={openAppIds.has(app.id)}
                    onToggle={() => toggleId(openAppIds, setOpenAppIds, app.id)}
                  />
                ))}
              </div>
            )}

            <DashPagination
              page={currentAppsPage}
              totalPages={appsTotalPages}
              pageSize={pageSize}
              totalItems={filteredApps.length}
              itemNoun="applications"
              onPageChange={setAppsPage}
              onPageSizeChange={changePageSize}
            />
          </div>
        )}
      </main>

      <AddAnswerDialog open={addOpen} onOpenChange={setAddOpen} />
      <ExtensionDialog open={extensionOpen} onOpenChange={setExtensionOpen} />
    </div>
  );
};

export default QuestionsClient;
