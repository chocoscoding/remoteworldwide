"use client";

// Application answers — the saved-answer library every drafted application
// answer starts from, and the record of which answers went out where.
//
// The answers themselves live in AnswersProvider (app-wide, backed by the AI
// service) so the apply wizard reads the same list; this screen owns only how
// they're browsed: tab, search, filter, pagination. The "By application" tab is
// the AI service's use log joined to the tracker's applications here, by id.
//
// The header chip opens the extension's settings, which save to the account,
// and reports what this browser actually answered — the extension says so
// itself (`app/lib/extension/presence`), so "connected" is never decoration.

import { FC, useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronDown, ChevronUp, PlugZap, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import DashPagination, { PAGE_SIZE_OPTIONS, type PageSize } from "@/app/components/dashboard/ui/DashPagination";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { useAnswers } from "@/app/components/dashboard/answers/AnswersProvider";
import { apiMessage } from "@/app/lib/api/core";
import type { AnswerHistoryItem } from "@/app/lib/answers/types";
import type { ApplicationItem } from "@/app/lib/applications/types";
import type { QaItem } from "@/app/lib/dashboard/types";
import { EXTENSION_URL } from "@/app/lib/extension/presence";
import { useAnswerHistory } from "@/hooks/queries/useAnswersQuery";
import { useApplications } from "@/hooks/queries/useApplicationsQuery";
import AnswerRow from "@/app/components/dashboard/questions/AnswerRow";
import ApplicationRow, { type ApplicationAnswers } from "@/app/components/dashboard/questions/ApplicationRow";
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

const ago = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : formatDistanceToNowStrict(date, { addSuffix: true });
};

/**
 * One history group onto the row the tab renders, named from the tracker.
 * Answers filed under an id the tracker does not hold (an application deleted
 * since, or one the extension named in its own terms) stay visible rather than
 * vanish — they are still what went out — under a label that says so. When the
 * tracker itself could not be read, nothing is known either way, and the label
 * claims nothing.
 */
function toApplicationAnswers(group: AnswerHistoryItem, application: ApplicationItem | undefined, trackerRead: boolean): ApplicationAnswers {
  const filled = `Answers filled ${ago(group.lastUsedAt)}`;
  if (!application) {
    const title = trackerRead ? "Not on your tracker" : "An application";
    return { id: group.applicationId, title, company: null, meta: filled, rww: false, uses: group.uses };
  }
  return {
    id: group.applicationId,
    title: application.role,
    company: application.company,
    meta: `${application.company} · ${filled}`,
    rww: application.source === "internal",
    uses: group.uses,
  };
}

/** Placeholder rows while a list loads — an empty list before the first answer is not an empty library. */
const AnswersLoading: FC = () => (
  <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading">
    {[0, 1, 2].map((i) => (
      <DashCard key={i} className="p-0">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-black/[0.07]" />
            <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-black/[0.05]" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded-full bg-black/[0.06]" />
        </div>
      </DashCard>
    ))}
  </div>
);

const QuestionsClient: FC = () => {
  const { items, reviewCount, loading, loadError, retry, extension } = useAnswers();
  const history = useAnswerHistory();
  const applications = useApplications();

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

  const applicationAnswers = useMemo(() => {
    const byId = new Map((applications.data ?? []).map((application) => [application.id, application]));
    return (history.data ?? []).map((group) => toApplicationAnswers(group, byId.get(group.applicationId), applications.isSuccess));
  }, [history.data, applications.data, applications.isSuccess]);

  const filteredApps = useMemo(
    () =>
      applicationAnswers.filter((app) => {
        if (!q) return true;
        const haystack = `${app.title} ${app.meta} ${app.uses.map((use) => `${use.question} ${use.answer}`).join(" ")}`;
        return haystack.toLowerCase().includes(q);
      }),
    [applicationAnswers, q],
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

  // What the chip and the "How this works" bullet are allowed to claim. The
  // extension answers for itself; an unset NEXT_PUBLIC_EXTENSION_URL means it
  // isn't published, and then "not installed" would be the wrong story to tell.
  const extensionLabel = extension.connected
    ? "Extension · connected"
    : extension.status === "checking"
      ? "Extension · checking…"
      : EXTENSION_URL
        ? "Extension · not installed"
        : "Extension · not available yet";

  const extensionBullet = extension.connected
    ? "• The browser extension fills these answers into forms on company sites"
    : EXTENSION_URL
      ? "• A browser extension fills these answers into forms on company sites — add it to Chrome to use it"
      : "• A browser extension that fills forms on company sites isn't available yet";

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Application answers</h1>
          <span className="hidden truncate text-sm text-black/45 sm:inline">Answer once, reused on every application</span>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          {/* Opens the extension's settings, and says what is true of this
              browser. Solid and lime once it has answered; dashed, like every
              "not there yet" mark, while it has not. */}
          <button
            type="button"
            onClick={() => setExtensionOpen(true)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-[#222325] hover:text-primary cursor-pointer",
              extension.connected
                ? "border-[#222325] bg-[#f6fbe3] text-primary"
                : "border-dashed border-black/20 bg-white text-black/55",
            )}>
            <PlugZap className={cn("h-3 w-3", extension.connected ? "text-[#6c7a1e]" : "text-black/40")} />
            {extensionLabel}
          </button>
          <StickerButton variant="primary" size="md" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add an answer
          </StickerButton>
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        {/* Derived from the library, so it moves when the library does. The
            review count is the jump to its own filter — it used to be restated
            verbatim in a banner directly underneath. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-black/60">
            <span className="font-bold text-primary">{loading ? "…" : items.length} answers</span> saved ·{" "}
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
            <p className="mb-2 text-sm font-bold text-primary">How this library is used</p>
            <p className="mb-3 text-sm leading-relaxed text-black/60">
              Whenever we draft answers for an application, everything saved here comes first, word for word. Only a question you
              haven&apos;t answered gets a drafted answer — it&apos;s added here marked &ldquo;AI answered&rdquo; so you can check it, and
              editing it makes it yours.
            </p>
            <ul className="flex flex-col gap-1.5 text-xs text-black/55">
              <li>• Matches the same question however a form words or punctuates it</li>
              <li>
                • Swaps <code className="rounded bg-[#f0f0ea] px-1 font-mono text-[11px]">{"{company}"}</code> for whoever you&apos;re
                applying to
              </li>
              <li>• Never guesses demographic questions — only an answer you&apos;ve saved is used</li>
              <li>{extensionBullet}</li>
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
            { id: "by-application", label: "By application", count: applicationAnswers.length },
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

            {loading ? (
              <AnswersLoading />
            ) : loadError ? (
              <DashEmptyState
                lottieSrc="/Lottie/neobrutalism/Copy_Clipboard_lottie.json"
                title="Your answers didn't load"
                body={loadError}
                ctaLabel="Try again"
                onCta={retry}
              />
            ) : items.length === 0 ? (
              <DashEmptyState
                lottieSrc="/Lottie/neobrutalism/Copy_Clipboard_lottie.json"
                title="No saved answers yet"
                body="Answer a question once — salary, notice period, why you're moving — and it's reused on every application after."
                ctaLabel="Add an answer"
                onCta={() => setAddOpen(true)}
              />
            ) : filteredAnswers.length === 0 ? (
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
            {/* Waits for the tracker too, so a row is never shown unnamed and renamed a beat later. */}
            {history.isPending || applications.isPending ? (
              <AnswersLoading />
            ) : history.error && !history.data ? (
              <DashEmptyState
                lottieSrc="/Lottie/neobrutalism/Copy_Clipboard_lottie.json"
                title="Your application answers didn't load"
                body={apiMessage(history.error)}
                ctaLabel="Try again"
                onCta={() => void history.refetch()}
              />
            ) : applicationAnswers.length === 0 ? (
              <DashEmptyState
                lottieSrc="/Lottie/neobrutalism/Copy_Clipboard_lottie.json"
                title="No application answers yet"
                body="When we fill answers for one of your applications, they're kept here under it — exactly what was sent, and when."
              />
            ) : filteredApps.length === 0 ? (
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
