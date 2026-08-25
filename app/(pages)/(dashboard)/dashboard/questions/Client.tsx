"use client";

import { FC, FormEvent, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  PlugZap,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import type { PillProps } from "@/app/components/dashboard/ui/Pill";
import LogoMini from "@/app/components/svg/LogoMini";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { APPS, QA } from "@/app/lib/dashboard/mock-data";
import type { Application, QaItem } from "@/app/lib/dashboard/types";

// ---------------------------------------------------------------------------
// Local screen state/config — not shared with any other screen.
// ---------------------------------------------------------------------------

type VaultTab = "answers" | "by-application";
type QaFilter = "review" | "saved" | "ai" | "demographics" | "all";

const ANSWERS_PAGE_SIZE = 6;
const APPS_PAGE_SIZE = 4;
/** The design's copy quotes a running total across every ATS this account
 *  has touched — much larger than the ~18 representative QA mock rows. */
const TOTAL_ANSWERS_SAVED = 148;

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
    case "all":
    default:
      return true;
  }
}

function kindPill(kind: QaItem["kind"]): { label: string; variant: NonNullable<PillProps["variant"]> } {
  switch (kind) {
    case "review":
      return { label: "Needs review", variant: "urgent" };
    case "ai":
      return { label: "AI answered", variant: "positive" };
    case "saved":
    default:
      return { label: "Saved by you", variant: "neutral" };
  }
}

function clampPage(page: number, total: number): number {
  return Math.min(Math.max(page, 1), Math.max(total, 1));
}

// ---------------------------------------------------------------------------
// One QA row on the Answers tab
// ---------------------------------------------------------------------------

const AnswerRow: FC<{
  item: QaItem;
  open: boolean;
  onToggle: () => void;
  onResolveReview: (id: string, choice: "mine" | "draft") => void;
  editing: boolean;
  editDraft: string;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}> = ({ item, open, onToggle, onResolveReview, editing, editDraft, onStartEdit, onEditChange, onSaveEdit, onCancelEdit }) => {
  const pill = kindPill(item.kind);

  return (
    <DashCard className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer hover:bg-[#fafaf7] transition-colors">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary truncate">{item.q}</p>
          {!open && <p className="text-xs text-black/45 truncate mt-0.5">{item.kind === "review" ? item.draft : item.a}</p>}
        </div>
        <div className="flex-none flex items-center gap-2">
          <Pill variant={pill.variant}>{pill.label}</Pill>
          {item.cat === "demographics" && <Pill variant="outline-dashed">Demographics</Pill>}
          <ChevronDown className={cn("h-4 w-4 text-black/35 transition-transform flex-none", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-black/8 pt-4">
          {item.kind === "review" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-black/10 bg-[#fbfbf7] p-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-2">
                    Your saved answer
                  </p>
                  <p className="text-sm text-black/75 leading-relaxed">{item.a}</p>
                </div>
                <div className="rounded-xl border-[1.5px] border-dashed border-secondary2 bg-secondary/10 p-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 flex-none" />
                    New AI draft
                  </p>
                  <p className="text-sm text-black/75 leading-relaxed">{item.draft}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 mt-4">
                <StickerButton variant="outline" size="sm" onClick={() => onResolveReview(item.id, "mine")}>
                  Use mine from now on
                </StickerButton>
                <StickerButton variant="primary" size="sm" onClick={() => onResolveReview(item.id, "draft")}>
                  Keep ours
                </StickerButton>
                <span className="text-xs text-black/40">Either choice clears this from your review queue.</span>
              </div>
            </>
          ) : editing ? (
            <div>
              <textarea
                value={editDraft}
                onChange={(e) => onEditChange(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-black/15 bg-white p-3.5 text-sm text-black/80 leading-relaxed focus:outline-none focus:border-primary/40 transition-colors resize-none"
              />
              <div className="flex items-center gap-2.5 mt-3">
                <StickerButton variant="primary" size="sm" onClick={onSaveEdit}>
                  Save answer
                </StickerButton>
                <StickerButton variant="outline" size="sm" onClick={onCancelEdit}>
                  Cancel
                </StickerButton>
              </div>
            </div>
          ) : (
            <div>
              <div className="rounded-xl bg-[#fbfbf7] border border-black/8 p-4">
                <p className="text-sm text-black/75 leading-relaxed">{item.a}</p>
              </div>
              <div className="flex items-center gap-2.5 mt-3">
                <StickerButton variant="outline" size="sm" onClick={onStartEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit answer
                </StickerButton>
              </div>
            </div>
          )}
        </div>
      )}
    </DashCard>
  );
};

// ---------------------------------------------------------------------------
// One application row on the By application tab
// ---------------------------------------------------------------------------

const ApplicationRow: FC<{ app: Application; open: boolean; onToggle: () => void }> = ({ app, open, onToggle }) => {
  return (
    <DashCard className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer hover:bg-[#fafaf7] transition-colors">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary truncate">{app.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {app.rww && <LogoMini className="h-3 w-3 flex-none" />}
            <p className="text-xs text-black/45 truncate">{app.meta}</p>
          </div>
        </div>
        <div className="flex-none flex items-center gap-2">
          <Pill variant="neutral">
            {app.qs.length} question{app.qs.length === 1 ? "" : "s"}
          </Pill>
          <ChevronDown className={cn("h-4 w-4 text-black/35 transition-transform flex-none", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-black/8 pt-4 flex flex-col gap-3.5">
          {app.qs.map((pair, i) => (
            <div key={i} className="rounded-xl bg-[#fbfbf7] border border-black/8 p-4">
              <p className="text-xs font-bold text-primary mb-1.5">{pair.q}</p>
              <p className="text-sm text-black/70 leading-relaxed">{pair.a}</p>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );
};

// ---------------------------------------------------------------------------
// Pagination footer
// ---------------------------------------------------------------------------

const PaginationFooter: FC<{ page: number; totalPages: number; onPrev: () => void; onNext: () => void }> = ({
  page,
  totalPages,
  onPrev,
  onNext,
}) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-5">
      <StickerButton variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
        Previous
      </StickerButton>
      <span className="text-xs font-medium text-black/45">
        Page {page} of {totalPages}
      </span>
      <StickerButton variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>
        Next
      </StickerButton>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

const QuestionsClient: FC = () => {
  const [qa, setQa] = useState<QaItem[]>(QA);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QaFilter>("all");
  const [vaultTab, setVaultTab] = useState<VaultTab>("answers");
  const [howOpen, setHowOpen] = useState(false);

  const [openAnswerIds, setOpenAnswerIds] = useState<Set<string>>(new Set());
  const [openAppIds, setOpenAppIds] = useState<Set<string>>(new Set());
  const [answersPage, setAnswersPage] = useState(1);
  const [appsPage, setAppsPage] = useState(1);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [newCat, setNewCat] = useState<"screening" | "demographics">("screening");

  const reviewCount = qa.filter((item) => item.kind === "review").length;
  const trimmedQuery = query.trim().toLowerCase();

  // --- Answers tab derivations ---------------------------------------------
  const filteredQA = qa.filter(
    (item) => (trimmedQuery === "" || item.q.toLowerCase().includes(trimmedQuery)) && matchesFilter(item, filter)
  );
  const totalAnswerPages = Math.ceil(filteredQA.length / ANSWERS_PAGE_SIZE) || 1;
  const answersPageClamped = clampPage(answersPage, totalAnswerPages);
  const pagedQA = filteredQA.slice(
    (answersPageClamped - 1) * ANSWERS_PAGE_SIZE,
    answersPageClamped * ANSWERS_PAGE_SIZE
  );

  // --- By application tab derivations --------------------------------------
  const filteredApps = APPS.filter(
    (app) =>
      trimmedQuery === "" ||
      app.title.toLowerCase().includes(trimmedQuery) ||
      app.qs.some((pair) => pair.q.toLowerCase().includes(trimmedQuery))
  );
  const totalAppPages = Math.ceil(filteredApps.length / APPS_PAGE_SIZE) || 1;
  const appsPageClamped = clampPage(appsPage, totalAppPages);
  const pagedApps = filteredApps.slice((appsPageClamped - 1) * APPS_PAGE_SIZE, appsPageClamped * APPS_PAGE_SIZE);

  const filterOptions: { id: QaFilter; label: string }[] = [
    { id: "review", label: `Needs review · ${reviewCount}` },
    { id: "saved", label: "Your saved answers" },
    { id: "ai", label: "AI answered" },
    { id: "demographics", label: "Demographics" },
    { id: "all", label: "All" },
  ];

  // --- Handlers --------------------------------------------------------------

  const handleQueryChange = (v: string) => {
    setQuery(v);
    setAnswersPage(1);
    setAppsPage(1);
  };

  const handleFilterChange = (id: QaFilter) => {
    setFilter(id);
    setAnswersPage(1);
  };

  const handleTabChange = (tab: VaultTab) => {
    setVaultTab(tab);
  };

  const jumpToReview = () => {
    setFilter("review");
    setVaultTab("answers");
    setAnswersPage(1);
  };

  const toggleAnswer = (id: string) => {
    setOpenAnswerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleApp = (id: string) => {
    setOpenAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resolveReview = (id: string, choice: "mine" | "draft") => {
    setQa((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, kind: "saved", a: choice === "draft" ? item.draft ?? item.a : item.a, draft: undefined }
          : item
      )
    );
  };

  const startEdit = (item: QaItem) => {
    setEditingId(item.id);
    setEditDraft(item.a);
  };

  const saveEdit = () => {
    if (!editingId) return;
    setQa((prev) => prev.map((item) => (item.id === editingId ? { ...item, a: editDraft } : item)));
    setEditingId(null);
    setEditDraft("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const submitNewAnswer = (e: FormEvent) => {
    e.preventDefault();
    if (!newQ.trim() || !newA.trim()) return;
    const item: QaItem = {
      id: `qa-custom-${Date.now()}`,
      q: newQ.trim(),
      a: newA.trim(),
      kind: "saved",
      cat: newCat,
    };
    setQa((prev) => [item, ...prev]);
    setNewQ("");
    setNewA("");
    setNewCat("screening");
    setAddOpen(false);
    setFilter("all");
    setAnswersPage(1);
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Application answers</h1>
        </div>
        <div className="flex items-center gap-3 flex-none">
          <Pill variant="neutral" className="gap-1.5">
            <PlugZap className="h-3 w-3 text-[#6c7a1e]" />
            Extension connected
          </Pill>
          <StickerButton variant="primary" size="md" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add an answer yourself
          </StickerButton>
        </div>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1100px] mx-auto">
        {/* Summary line + How this works toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-sm text-black/60">
            <span className="font-bold text-primary">{TOTAL_ANSWERS_SAVED} answers</span> saved ·{" "}
            <span className={cn("font-bold", reviewCount > 0 ? "text-primary" : "text-black/45")}>
              {reviewCount} need{reviewCount === 1 ? "s" : ""} your review
            </span>{" "}
            before they go out again
          </p>
          <button
            type="button"
            onClick={() => setHowOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer">
            How this works
            {howOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* How this works explainer panel */}
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
            howOpen ? "max-h-[400px] opacity-100 mb-5" : "max-h-0 opacity-0"
          )}>
          <DashCard className="p-5 bg-[#fbfbf7]">
            <p className="text-sm font-bold text-primary mb-2">How the extension uses this library</p>
            <p className="text-sm text-black/60 leading-relaxed mb-3">
              The Remote Worldwide browser extension reads from everything you&apos;ve saved here and fills matching
              questions automatically when you apply on a company&apos;s own site. When it can&apos;t find a
              confident match, it drafts its best guess and flags it below for your review — nothing goes out under
              your name until you resolve it.
            </p>
            <ul className="flex flex-col gap-1.5 text-xs text-black/55">
              <li>• Recognises matching questions across 200+ applicant-tracking platforms</li>
              <li>• Auto-fills instantly on forms it already knows — no copy-paste</li>
              <li>• Flags anything it&apos;s unsure about instead of guessing silently</li>
            </ul>
          </DashCard>
        </div>

        {/* Search bar */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-black/35 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search your saved answers…"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-black/10 bg-white text-sm text-primary placeholder:text-black/35 focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>

        {/* Conditional needs-review banner */}
        {reviewCount > 0 && filter !== "review" && (
          <button
            type="button"
            onClick={jumpToReview}
            className="w-full flex items-center justify-between gap-4 rounded-xl bg-secondary text-primary px-5 py-3.5 mb-5 text-left hover:brightness-95 transition cursor-pointer">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 flex-none" />
              {reviewCount} answer{reviewCount === 1 ? "" : "s"} {reviewCount === 1 ? "needs" : "need"} your review
              before they go out again
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-bold flex-none">
              Review them
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        )}

        {/* Tab switcher */}
        <div className="inline-flex items-center gap-0.5 rounded-full bg-[#f0f0ea] p-1 mb-5">
          <button
            type="button"
            onClick={() => handleTabChange("answers")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
              vaultTab === "answers" ? "bg-[#222325] text-white" : "text-black/55 hover:text-primary"
            )}>
            Answers
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("by-application")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
              vaultTab === "by-application" ? "bg-[#222325] text-white" : "text-black/55 hover:text-primary"
            )}>
            By application
          </button>
        </div>

        {vaultTab === "answers" ? (
          <div>
            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {filterOptions.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleFilterChange(f.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
                    filter === f.id ? "bg-[#222325] text-white" : "bg-[#f0f0ea] text-black/60 hover:bg-[#e7e7df]"
                  )}>
                  {f.label}
                </button>
              ))}
            </div>

            {pagedQA.length > 0 ? (
              <div className="flex flex-col gap-3">
                {pagedQA.map((item) => (
                  <AnswerRow
                    key={item.id}
                    item={item}
                    open={openAnswerIds.has(item.id)}
                    onToggle={() => toggleAnswer(item.id)}
                    onResolveReview={resolveReview}
                    editing={editingId === item.id}
                    editDraft={editDraft}
                    onStartEdit={() => startEdit(item)}
                    onEditChange={setEditDraft}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                  />
                ))}
              </div>
            ) : (
              <DashCard className="p-8 text-center">
                <p className="text-sm font-semibold text-primary mb-1">No answers match your search</p>
                <p className="text-xs text-black/45">
                  Try a different keyword, or clear the filter to see everything you&apos;ve saved.
                </p>
              </DashCard>
            )}

            <PaginationFooter
              page={answersPageClamped}
              totalPages={totalAnswerPages}
              onPrev={() => setAnswersPage(Math.max(1, answersPageClamped - 1))}
              onNext={() => setAnswersPage(Math.min(totalAnswerPages, answersPageClamped + 1))}
            />
          </div>
        ) : (
          <div>
            {pagedApps.length > 0 ? (
              <div className="flex flex-col gap-3">
                {pagedApps.map((app) => (
                  <ApplicationRow key={app.id} app={app} open={openAppIds.has(app.id)} onToggle={() => toggleApp(app.id)} />
                ))}
              </div>
            ) : (
              <DashCard className="p-8 text-center">
                <p className="text-sm font-semibold text-primary mb-1">No applications match your search</p>
                <p className="text-xs text-black/45">Try a different keyword.</p>
              </DashCard>
            )}

            <PaginationFooter
              page={appsPageClamped}
              totalPages={totalAppPages}
              onPrev={() => setAppsPage(Math.max(1, appsPageClamped - 1))}
              onNext={() => setAppsPage(Math.min(totalAppPages, appsPageClamped + 1))}
            />
          </div>
        )}
      </main>

      {/* Add an answer yourself — modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-white rounded-[20px] border-0 p-0 max-w-md">
          <form onSubmit={submitNewAnswer} className="p-6">
            <DialogTitle className="text-[17px] font-bold text-primary">Add an answer yourself</DialogTitle>
            <DialogDescription className="text-xs text-black/45 mt-1 mb-5">
              Saved here, it&apos;s available to the extension on every future application.
            </DialogDescription>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-1.5 block">
                  Question
                </label>
                <input
                  type="text"
                  value={newQ}
                  onChange={(e) => setNewQ(e.target.value)}
                  placeholder="e.g. What's your preferred start date?"
                  required
                  className="w-full h-10 px-3.5 rounded-lg border border-black/15 bg-white text-sm text-primary placeholder:text-black/35 focus:outline-none focus:border-primary/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-1.5 block">
                  Answer
                </label>
                <textarea
                  value={newA}
                  onChange={(e) => setNewA(e.target.value)}
                  rows={4}
                  required
                  placeholder="Write the answer you want saved for this question…"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-black/15 bg-white text-sm text-primary placeholder:text-black/35 focus:outline-none focus:border-primary/40 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-1.5 block">
                  Category
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCat("screening")}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                      newCat === "screening" ? "bg-[#222325] text-white" : "bg-[#f0f0ea] text-black/60 hover:bg-[#e7e7df]"
                    )}>
                    Screening
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCat("demographics")}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                      newCat === "demographics" ? "bg-[#222325] text-white" : "bg-[#f0f0ea] text-black/60 hover:bg-[#e7e7df]"
                    )}>
                    Demographics
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 mt-6">
              <StickerButton type="submit" variant="primary" size="md" className="flex-1">
                Save answer
              </StickerButton>
              <StickerButton type="button" variant="outline" size="md" onClick={() => setAddOpen(false)} className="flex-1">
                Cancel
              </StickerButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuestionsClient;
