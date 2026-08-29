"use client";

// The screen's actual body — header, 3-column layout, and every tab. Lives
// INSIDE the per-document `ResumeDesignProvider` (see Client.tsx), so it's
// the component that calls `useResumeDesign()` and therefore the one that
// can read the LIVE design/sections at the moment a document switch happens.
//
// `content` (the active document's `ResumeContent`) is local state here too,
// for the same reason: it needs to be captured and stashed onto the outgoing
// document before switching, exactly like design/sections. Because this
// entire component remounts whenever `Client.tsx`'s `ResumeDesignProvider`
// remounts (keyed by `activeDocId`), every other piece of local UI state
// below (which tab is open, AI-assist state, dropdown state…) naturally
// resets to its default on every document switch or creation — no manual
// "reset a dozen states" cleanup is needed the way the old screen's
// `createNewResume` required.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FC,
  type SetStateAction,
} from "react";
import { Download, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import DownloadModal from "@/app/components/dashboard/modals/DownloadModal";
import {
  ResumePaper,
  PageGuides,
} from "@/app/components/dashboard/resume/paper";
import { useResumeDesign } from "@/app/components/dashboard/resume/useResumeDesign";
import {
  DEFAULT_DESIGN,
  DEFAULT_SECTIONS,
} from "@/app/lib/dashboard/resume/design-defaults";
import { ALL_FONT_VARS } from "@/app/lib/dashboard/resume/fonts";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { useSidebarCollapse } from "@/app/components/dashboard/SidebarCollapseContext";
import {
  cloneContent,
  createBlankContent,
  type ResumeDocument,
} from "./resume-document";
import DocumentSwitcher from "./DocumentSwitcher";
import NewResumeDialog, { type NewResumeMode } from "./NewResumeDialog";
import ContentForm from "./content/ContentForm";
import CustomizeNav from "./CustomizeNav";
import CustomizePanelsRail from "./CustomizePanelsRail";
import AiAssistRail from "./AiAssistRail";
import AiToolsList from "./AiToolsList";

type DocTab = "overview" | "content" | "customize" | "ai";
type SummarySuggestionState = "pending" | "accepted" | "dismissed";

const DOC_TABS: { id: DocTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "content", label: "Content" },
  { id: "customize", label: "Customize" },
  { id: "ai", label: "AI Tools" },
];

// The Content tab's editing form needs real width for labeled inputs — a
// nav-only column (fine for the other 3 tabs) can't fit it. Both flanking
// columns widen further when the MAIN dashboard sidebar is collapsed (252 ->
// 76px frees 176px), rather than leaving that space unused — the flanking
// columns grow, not just the center preview, per direct feedback. Two full
// literal sets (not one computed from a collapsed offset) per the house
// convention of static arbitrary-value classes Tailwind's scanner can see.
const GRID_COLS_CLASS = (collapsed: boolean): Record<DocTab, string> =>
  collapsed
    ? {
        // Overview has no left rail at all (see the caption note below) — 2
        // columns, not 3, so the freed width goes to the center, not to a
        // reserved-but-empty column.
        overview: "grid-cols-[1fr_360px]",
        content: "grid-cols-[310px_1fr_350px]",
        customize: "grid-cols-[180px_1fr_360px]",
        ai: "grid-cols-[180px_1fr_360px]",
      }
    : {
        overview: "grid-cols-[1fr_324px]",
        content: "grid-cols-[280px_1fr_324px]",
        customize: "grid-cols-[148px_1fr_324px]",
        ai: "grid-cols-[148px_1fr_324px]",
      };

const TAILORED_SUMMARY =
  "Product designer with 6 years shipping design systems and developer-experience-focused workflow tools for distributed teams across four time zones.";

export interface ResumeScreenBodyProps {
  documents: ResumeDocument[];
  activeDocId: string;
  activeDoc: ResumeDocument;
  setDocuments: Dispatch<SetStateAction<ResumeDocument[]>>;
  setActiveDocId: Dispatch<SetStateAction<string>>;
}

const ResumeScreenBody: FC<ResumeScreenBodyProps> = ({
  documents,
  activeDocId,
  activeDoc,
  setDocuments,
  setActiveDocId,
}) => {
  const { design, sections, dispatch } = useResumeDesign();
  const { collapsed: sidebarCollapsed } = useSidebarCollapse();

  const [docTab, setDocTab] = useState<DocTab>("content");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [newResumeOpen, setNewResumeOpen] = useState(false);

  // The active document's live content — captured here for the same reason
  // design/sections live in the provider: it must be readable at the moment
  // of an explicit save-before-switch (see `switchTo`/`createNewResume`).
  const [content, setContent] = useState<ResumeContent>(
    () => activeDoc.content,
  );

  const [summarySuggestion, setSummarySuggestion] =
    useState<SummarySuggestionState>(() =>
      activeDoc.isBlank ? "dismissed" : "pending",
    );

  const [aiRunning, setAiRunning] = useState<string | null>(null);
  const [aiDone, setAiDone] = useState<Set<string>>(new Set());

  const [keywordsAdded, setKeywordsAdded] = useState<Set<string>>(new Set());
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(
    new Set(),
  );
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(
    new Set(),
  );
  const [askInput, setAskInput] = useState("");
  const [askStatus, setAskStatus] = useState<string | null>(null);

  const [activeCustomizeItem, setActiveCustomizeItem] = useState("document");
  const [flashCustomizeItem, setFlashCustomizeItem] = useState<string | null>(
    null,
  );
  const customizeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const paperWrapRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);

  // Fit-to-width — the physical page (US Letter ≈ 816px at 96dpi) is wider
  // than the center column at narrower viewports, and no reasonable amount of
  // side-column/padding trimming changes that arithmetic. Rather than always
  // relying on the mat's `overflow-x-auto` scrollbar, scale the whole paper
  // down to fit when it doesn't. `mat`/`wrap` sizes are read via
  // `clientWidth`/`scrollWidth`/`scrollHeight` — all transform-invariant — so
  // this is safe to recompute from a plain ResizeObserver without a feedback
  // loop, and `PageGuides`' own page-count ruler was updated to use
  // `offsetHeight` (also transform-invariant) so scaling this doesn't skew it.
  // Never scales below 50% — past that the document stops being legible, so
  // it falls back to the mat's horizontal scrollbar instead.
  const matRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, width: 816, height: 1000 });

  useEffect(() => {
    const mat = matRef.current;
    const wrap = paperWrapRef.current;
    if (!mat || !wrap) return;

    const MIN_SCALE = 0.5;
    const measure = () => {
      const matStyle = getComputedStyle(mat);
      const available =
        mat.clientWidth -
        parseFloat(matStyle.paddingLeft) -
        parseFloat(matStyle.paddingRight);
      const naturalW = wrap.scrollWidth;
      const naturalH = wrap.scrollHeight;
      if (naturalW <= 0) return;
      const nextScale = Math.max(MIN_SCALE, Math.min(1, available / naturalW));
      setFit((prev) =>
        prev.scale === nextScale &&
        prev.width === naturalW &&
        prev.height === naturalH
          ? prev
          : { scale: nextScale, width: naturalW, height: naturalH },
      );
    };

    const observer = new ResizeObserver(measure);
    observer.observe(mat);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  const displayScore = Math.min(97, activeDoc.score + keywordsAdded.size * 4);
  const downloadFileName = content.name.trim()
    ? `${content.name.trim().replace(/\s+/g, "-")}-Resume`
    : "Resume";

  // -------------------------------------------------------------------------
  // Document switch / create — explicit save-then-swap, not a reactive
  // effect. `design`/`sections` come from the hook (live provider state);
  // `content` is this component's own local state. Both get written back
  // onto the OUTGOING document before the id changes.
  // -------------------------------------------------------------------------

  const switchTo = useCallback(
    (nextId: string) => {
      if (nextId === activeDocId) return;
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDocId ? { ...d, design, sections, content } : d,
        ),
      );
      setActiveDocId(nextId);
    },
    [activeDocId, design, sections, content, setDocuments, setActiveDocId],
  );

  const createNewResume = useCallback(
    (label: string, mode: NewResumeMode) => {
      const id = `res-new-${Date.now()}`;
      const newDoc: ResumeDocument = {
        id,
        label: label.trim() || "New resume",
        // A fresh document always starts at the base design/sections — even
        // "duplicate" only copies CONTENT, never the outgoing document's
        // customization, so every new document genuinely starts at the real
        // default look.
        content:
          mode === "duplicate" ? cloneContent(content) : createBlankContent(),
        design: DEFAULT_DESIGN,
        sections: DEFAULT_SECTIONS,
        score: 0,
        before: null,
        isBlank: mode === "blank",
      };
      setDocuments((prev) => [
        ...prev.map((d) =>
          d.id === activeDocId ? { ...d, design, sections, content } : d,
        ),
        newDoc,
      ]);
      setActiveDocId(id);
      setNewResumeOpen(false);
    },
    [activeDocId, design, sections, content, setDocuments, setActiveDocId],
  );

  // -------------------------------------------------------------------------
  // Customize tab — scroll-sync/flash-highlight, driven by the same ordered
  // `CUSTOMIZE_PANELS` list `CustomizeNav`/`CustomizePanelsRail` map over.
  // -------------------------------------------------------------------------

  const registerCustomizeRef = useCallback(
    (id: string, el: HTMLDivElement | null) => {
      customizeRefs.current[id] = el;
    },
    [],
  );

  const scrollToSetting = (id: string) => {
    setActiveCustomizeItem(id);
    customizeRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setFlashCustomizeItem(id);
    window.setTimeout(
      () => setFlashCustomizeItem((v) => (v === id ? null : v)),
      1400,
    );
  };

  // -------------------------------------------------------------------------
  // AI assist rail / AI tools tab — mocked, local state only.
  // -------------------------------------------------------------------------

  const runAiTool = (id: string) => {
    setAiRunning(id);
    window.setTimeout(() => {
      setAiRunning(null);
      setAiDone((prev) => new Set(prev).add(id));
    }, 900);
  };

  const toggleKeyword = (id: string) => {
    setKeywordsAdded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const acceptSummarySuggestion = () => {
    setContent((prev) => ({ ...prev, summary: TAILORED_SUMMARY }));
    setSummarySuggestion("accepted");
  };
  const dismissSummarySuggestion = () => setSummarySuggestion("dismissed");

  const applySuggestion = (id: string) => {
    setAppliedSuggestions((prev) => new Set(prev).add(id));
    if (id === "fix-keyword") acceptSummarySuggestion();
    if (id === "fix-skills") {
      // Real effect now that section order is real: move Skills ahead of
      // Experience, same intent as the old (cosmetic-only) "Move it" action.
      const skillsIdx = sections.findIndex((s) => s.kind === "skills");
      const experienceIdx = sections.findIndex((s) => s.kind === "experience");
      if (
        skillsIdx !== -1 &&
        experienceIdx !== -1 &&
        skillsIdx > experienceIdx
      ) {
        dispatch({
          type: "sections/reorder",
          from: skillsIdx,
          to: experienceIdx,
        });
      }
    }
  };

  const toggleExpandedSuggestion = (id: string) => {
    setExpandedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAskSubmit = () => {
    if (!askInput.trim()) return;
    setAskStatus(
      `Rewrite requested: "${askInput.trim()}" — 1 credit used. We'll apply it to your ${activeDoc.label} draft.`,
    );
    setAskInput("");
    window.setTimeout(() => setAskStatus(null), 4000);
  };

  return (
    <div className={cn("min-h-screen bg-[#f6f6f6]", ALL_FONT_VARS)}>
      {/* Header */}
      <header className="sticky top-0 z-20 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center h-full">
          {DOC_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDocTab(tab.id)}
              className={cn(
                "h-full flex items-center px-3.5 text-sm border-b-2 transition-colors cursor-pointer",
                docTab === tab.id
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-black/45 font-medium hover:text-black/70",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 flex-none">
          <DocumentSwitcher
            documents={documents}
            activeDocId={activeDocId}
            onSwitch={switchTo}
          />
          <StickerButton
            type="button"
            variant="outline"
            size="md"
            onClick={() => setNewResumeOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New resume
          </StickerButton>
          <StickerButton
            type="button"
            variant="primary"
            size="md"
            onClick={() => setDownloadOpen(true)}
          >
            <Download className="h-4 w-4" />
            Download
          </StickerButton>
        </div>
      </header>

      <main className="px-6 py-7 pb-14 max-w-[1440px] mx-auto">
        <div
          className={cn(
            "grid gap-4 items-start",
            GRID_COLS_CLASS(sidebarCollapsed)[docTab],
          )}
        >
          {/* LEFT SIDEBAR — Overview has none; its old "N pages · N roles ·
              last edited" line moved to a small caption above the preview
              (below), shown on every tab instead of parked in a rail only
              Overview ever showed. */}
          {docTab !== "overview" && (
            <aside className="sticky top-[88px] max-h-[calc(100vh-112px)] overflow-y-auto overflow-x-hidden scrollbar-neo">
              <div className="rounded-xl border-2 border-[#222325] bg-white p-3">
                {docTab === "content" && (
                  <ContentForm
                    content={content}
                    setContent={setContent}
                    isBlank={activeDoc.isBlank ?? false}
                    docLabel={activeDoc.label}
                    summarySuggestion={summarySuggestion}
                    onAcceptSummarySuggestion={acceptSummarySuggestion}
                    onDismissSummarySuggestion={dismissSummarySuggestion}
                  />
                )}

                {docTab === "customize" && (
                  <CustomizeNav
                    activeItem={activeCustomizeItem}
                    onSelect={scrollToSetting}
                  />
                )}

                {docTab === "ai" && (
                  <AiToolsList
                    aiRunning={aiRunning}
                    aiDone={aiDone}
                    onRun={runAiTool}
                  />
                )}
              </div>
            </aside>
          )}

          {/* CENTER — resume document preview, identical across every tab */}
          <section className="min-w-0">
            <p className="mb-2 px-1 text-xs text-black/45">
              {pageCount} page{pageCount === 1 ? "" : "s"} ·{" "}
              {content.experience.length} roles · last edited 2 minutes ago.
            </p>
            <div
              ref={matRef}
              className="rounded-2xl bg-[#f0f0ea] p-3 sm:p-4 overflow-x-auto"
            >
              {/*
                Fit-to-width sizer/scaler pair — the one other place in this
                feature that needs inline `style={}` beyond `ResumePaper`,
                for the same reason that one does: a continuous, runtime-only
                value (here, a measured scale factor) has no static-Tailwind
                equivalent. The OUTER div reserves the actual shrunk layout
                footprint (so the mat doesn't leave dead space or still need
                to scroll); the INNER div holds the paper at its natural size
                and visually scales it down via `transform`, which doesn't
                affect either div's own box metrics — see the `fit` state
                comment above for why that matters for `PageGuides`.
              */}
              <div
                className="mx-auto"
                style={{
                  width: fit.width * fit.scale,
                  height: fit.height * fit.scale,
                }}
              >
                <div
                  style={{
                    width: fit.width,
                    height: fit.height,
                    transform:
                      fit.scale < 1 ? `scale(${fit.scale})` : undefined,
                    transformOrigin: "top left",
                  }}
                >
                  <div
                    ref={paperWrapRef}
                    className="relative w-fit overflow-hidden rounded-sm bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.15)]"
                  >
                    <ResumePaper
                      design={design}
                      sections={sections}
                      content={content}
                      chrome={design.chrome}
                    />
                    <PageGuides
                      containerRef={paperWrapRef}
                      onPageCountChange={setPageCount}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT RAIL */}
          <aside className="sticky top-[88px]">
            {docTab === "customize" ? (
              <CustomizePanelsRail
                flashItem={flashCustomizeItem}
                registerRef={registerCustomizeRef}
              />
            ) : (
              <AiAssistRail
                docLabel={activeDoc.label}
                isBlank={activeDoc.isBlank ?? false}
                displayScore={displayScore}
                before={activeDoc.before}
                keywordsAdded={keywordsAdded}
                onToggleKeyword={toggleKeyword}
                appliedSuggestions={appliedSuggestions}
                expandedSuggestions={expandedSuggestions}
                onApplySuggestion={applySuggestion}
                onToggleExpandedSuggestion={toggleExpandedSuggestion}
                askInput={askInput}
                onAskInputChange={setAskInput}
                onAskSubmit={handleAskSubmit}
                askStatus={askStatus}
                onDismissAskStatus={() => setAskStatus(null)}
              />
            )}
          </aside>
        </div>
      </main>

      <DownloadModal
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        docLabel="resume"
        fileName={downloadFileName}
      />
      <NewResumeDialog
        open={newResumeOpen}
        onOpenChange={setNewResumeOpen}
        currentDocLabel={activeDoc.label}
        onCreate={createNewResume}
      />
    </div>
  );
};

export default ResumeScreenBody;
