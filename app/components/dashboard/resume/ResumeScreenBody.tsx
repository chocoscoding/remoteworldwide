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
// below (AI-assist state, dropdown state…) naturally resets to its default on
// every document switch or creation — no manual "reset a dozen states"
// cleanup is needed the way the old screen's `createNewResume` required. The
// tab is the exception: it is in the address (`?tab=`), and carries over.

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FC, type ReactNode, type SetStateAction } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Redo2, Sparkle, Undo2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import DownloadModal, { type DownloadFormat } from "@/app/components/dashboard/modals/DownloadModal";
import { printDocument, safeFileName, saveBlob, saveText } from "@/app/lib/export/save";
import { resumePrintSpec } from "@/app/lib/export/print-css";
import { resumeToDocx, resumeToMarkdown } from "@/app/lib/export/resume";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { PagedResume, ResumePaper } from "@/app/components/dashboard/resume/paper";
import { PaperHighlightProvider, type PaperFocus } from "@/app/components/dashboard/resume/paper/highlight";
import { useSlidingPill } from "./controls/useSlidingPill";
import { useResumeDesign } from "@/app/components/dashboard/resume/useResumeDesign";
import { ALL_FONT_VARS } from "@/app/lib/dashboard/resume/fonts";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { useSidebarCollapse } from "@/app/components/dashboard/SidebarCollapseContext";
import { isBlankContent, isStaleCheck, type CheckPosting, type ResumeCheck, type ResumeDocument } from "./resume-document";
import { useResumeAutosave } from "./useResumeAutosave";
import { quantifyKey } from "./editor-state";
import ContentForm from "./content/ContentForm";
import CustomizeNav from "./CustomizeNav";
import CustomizePanelsRail from "./CustomizePanelsRail";
import AiAssistRail from "./AiAssistRail";
import AiToolsList, { type AiToolPointer } from "./AiToolsList";
import { PlanChip, usePlanGate } from "@/app/components/dashboard/billing/UpgradeModal";
import { useJobPicker } from "@/app/components/dashboard/jobs/JobPickerProvider";
import type { PickedJob } from "@/app/lib/jobs/fields";
// `applyQuantify` is the one tool function still executed in the browser, and
// deliberately so: committing a chosen suggestion substitutes one string at one
// index. It is an array update, it has to feel instant, and a round trip could
// only make it slower and occasionally fail. Everything that needs judgment —
// or a credit — now runs in the AI service through `app/lib/resume/ai.ts`.
import { applyQuantify, type QuantifySuggestion, type RewriteVariant } from "@/app/lib/dashboard/resume/ai-tools";
import { reconcileGroups } from "@/app/lib/resume/skills";
import {
  askForRewrite,
  fixToneAndGrammar,
  injectKeywords,
  quantifySuggestions,
  rewriteVariants as buildRewriteVariants,
  shortenToOnePage,
  tailorToJob,
} from "@/app/lib/resume/ai";
import { useResumeSuggestion } from "@/hooks/mutations/useResumeSuggestion";
import { useCheckResume } from "@/hooks/mutations/useCheckResume";
import { applyBulletRewrite, deriveCheckSuggestions, pinnedLines, railCards, type CheckSuggestion } from "./check-suggestions";

type DocTab = "overview" | "content" | "customize" | "ai";

const DOC_TABS: { id: DocTab; label: string; icon?: LucideIcon }[] = [
  { id: "overview", label: "Overview" },
  { id: "content", label: "Content" },
  { id: "customize", label: "Customize" },
  { id: "ai", label: "AI Tools", icon: Sparkle },
];

/** A tab as the address carries it (`?tab=`); anything else in the param is ignored. */
const tabFrom = (value: string | null): DocTab | null => (DOC_TABS.some((tab) => tab.id === value) ? (value as DocTab) : null);

// The Content tab's editing form needs real width for labeled inputs — a
// nav-only column (fine for the other 3 tabs) can't fit it. Both flanking
// columns widen further when the MAIN dashboard sidebar is collapsed (252 ->
// 76px frees 176px), rather than leaving that space unused — the flanking
// columns grow, not just the center preview, per direct feedback. Two full
// literal sets (not one computed from a collapsed offset) per the house
// convention of static arbitrary-value classes Tailwind's scanner can see.
//
// The flanking columns are a minimum and a share, not a fixed width (owner,
// 2026-10-04: "use this space for the left and right side"): on a wide screen
// they grow into what used to be empty margin beside the page, and on a
// laptop they hold their minimum while the preview scales to fit.
const GRID_COLS_CLASS = (collapsed: boolean): Record<DocTab, string> =>
  collapsed
    ? {
        // Overview has no left rail at all (see the caption note below) — 2
        // columns, not 3, so the freed width goes to the center, not to a
        // reserved-but-empty column.
        overview: "grid-cols-[minmax(0,2.4fr)_minmax(360px,1fr)]",
        content: "grid-cols-[minmax(430px,1.1fr)_minmax(0,2fr)_minmax(360px,1fr)]",
        customize: "grid-cols-[180px_minmax(0,2.2fr)_minmax(450px,1fr)]",
        ai: "grid-cols-[minmax(300px,1fr)_minmax(0,2.2fr)_minmax(360px,1fr)]",
      }
    : {
        overview: "grid-cols-[minmax(0,2.4fr)_minmax(340px,1fr)]",
        content: "grid-cols-[minmax(372px,1.1fr)_minmax(0,2fr)_minmax(305px,1fr)]",
        customize: "grid-cols-[188px_minmax(0,2.2fr)_minmax(404px,1fr)]",
        ai: "grid-cols-[minmax(308px,1fr)_minmax(0,2.2fr)_minmax(340px,1fr)]",
      };

// The three zoom controls share one quiet recipe — hairline border, full
// circle, muted ink — so the control sits in the background. Hover is where
// it comes forward: ink border, a hair of hard shadow, and a real press that
// travels onto that shadow and drops it.
const ZOOM_BUTTON_CLASS =
  "grid h-6 w-6 place-content-center rounded-full bg-white text-sm font-semibold leading-none text-black/70 transition-[transform,box-shadow,background-color,border-color,color] duration-100 ease-out hover:bg-[#f7f7f7] hover:text-primary br-plain-press cursor-pointer";

/** Undo and redo wear the zoom buttons, faded and inert while there is nothing to go back or forward to. */
const HISTORY_BUTTON_CLASS = "disabled:pointer-events-none disabled:opacity-35";

/** How long ago, in short units: "just now", "3 min ago", "2 hr ago", "5 days ago". */
function shortAgo(at: Date, now: number): string {
  const seconds = Math.max(0, Math.round((now - at.getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 30) return `${Math.round(days / 7)} wk ago`;
  if (days < 365) return `${Math.round(days / 30)} mo ago`;
  return `${Math.round(days / 365)} yr ago`;
}

/** "edited 3 min ago" above the preview (owner, 2026-10-04), kept current every half minute. */
const EditedAgo: FC<{ at: Date }> = ({ at }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <time dateTime={at.toISOString()} title={at.toLocaleString()}>
      edited {shortAgo(at, Math.max(now, at.getTime()))}
    </time>
  );
};

// What Tailor and the ATS card's "Against a job" read from a picked job. Skills
// and requirements are asked for but never required: a pasted posting may name
// none. One constant feeds both the pick and the type, so they cannot drift.
export const RESUME_JOB_SPEC = "company, role, description, skills?, requirements?";
export type ResumeJob = PickedJob<typeof RESUME_JOB_SPEC>;

/** A job Tailor was handed by a link (?tailor=<savedJobId>): its card shows it, and Run uses it without the picker. */
export type TailorPreset = { status: "loading" | "failed"; label: string } | { status: "ready"; label: string; job: ResumeJob };

export interface ResumeScreenBodyProps {
  activeDocId: string;
  activeDoc: ResumeDocument;
  setDocuments: Dispatch<SetStateAction<ResumeDocument[]>>;
  /** Every save that lands, including the one flushed as this component unmounts — see `useResumeAutosave`. */
  onSaved: (id: string, updatedAt: Date) => void;
  banner?: ReactNode;
  tailorPreset?: TailorPreset | null;
}

const ResumeScreenBody: FC<ResumeScreenBodyProps> = ({ activeDocId, activeDoc, setDocuments, onSaved, banner, tailorPreset = null }) => {
  // The open resume — its look, words, check and what was done about its AI suggestions — lives
  // in the provider's one undo history (`editor-state.ts`), so the pill above the preview undoes
  // anything done on any tab.
  const { design, sections, content, check, marks, dispatch, undo, redo, canUndo, canRedo } = useResumeDesign();
  const { collapsed: sidebarCollapsed } = useSidebarCollapse();

  // The tab is part of the address (`?tab=`), so a refresh or a shared link lands on it, and it
  // carries over to the next resume opened. Replaced, not pushed: a tab isn't a step to go Back through.
  const params = useSearchParams();
  const [docTab, setDocTabState] = useState<DocTab>(() => tabFrom(params.get("tab")) ?? (tailorPreset ? "ai" : "content"));
  const { groupRef: tabGroupRef, itemRef: tabItemRef, style: tabPillStyle } = useSlidingPill(docTab);
  // What a fix card on the right, or an AI tool or proposal on the AI Tools tab, is about while it
  // is under the pointer or focus: the paper frames it and highlights the line or skill (see
  // paper/highlight.tsx). Editing on the Content tab never does (owner, 2026-10-04).
  const [pointFocus, setPointFocus] = useState<PaperFocus | null>(null);
  const setDocTab = (tab: DocTab) => {
    setDocTabState(tab);
    // The control that was pointed at is gone with its tab, and can't say it left.
    setPointFocus(null);
    const next = new URLSearchParams(window.location.search);
    next.set("tab", tab);
    window.history.replaceState(null, "", `${window.location.pathname}?${next.toString()}`);
  };
  const [downloadOpen, setDownloadOpen] = useState(false);
  // Free has the builder without its AI: the tools show a lock and open the upgrade popup instead.
  // The AI service enforces the same, so this only saves a refused request. (A new resume is
  // started from the landing, where Free's one-resume limit is checked.)
  const { allows, openUpgrade } = usePlanGate();
  const aiLocked = !allows("basic");
  const lockedAi = () => openUpgrade({ kind: "plan", requiredPlan: "basic", message: "AI help with your resume is on Basic and up." });

  // The Content form's edits. Typing into one field folds into one undo step until the typing
  // pauses; adding, removing or moving an entry is a step of its own. Everything else that changes
  // the words (every AI tool, card and suggestion) dispatches its own `edit` with its mark.
  const typeContent = useCallback(
    (next: SetStateAction<ResumeContent>) => dispatch({ type: "edit", content: next, typing: true }),
    [dispatch],
  );
  /** A tool that changed the words: the change and its caption are one step, so Undo takes both back. */
  const landEdit = (id: string, caption: string, change: (now: ResumeContent) => ResumeContent) =>
    dispatch({ type: "edit", content: change, marks: (m) => ({ captions: { ...m.captions, [id]: caption } }) });
  /** A tool that changed nothing, or only proposed: its caption is a fact, never a step. */
  const landNote = (id: string, caption: string) => dispatch({ type: "learn", caption: { id, text: caption } });

  // Everything a resume IS — content, design, sections — saved as it changes.
  // The ATS state further down is deliberately not part of it.
  const autosave = useResumeAutosave({ id: activeDocId, content, design, sections, savedAt: activeDoc.updatedAt, onSaved });

  // Which tool is out, and why the last one came back empty-handed. Owned by
  // the hook rather than by this component: a run can now fail, and "one at a
  // time" has to hold across an await rather than across a timeout.
  const { running: aiRunning, run: runSuggestion } = useResumeSuggestion();
  // The two tools with inline pickers keep their proposals here. Which were used is a mark, so
  // undoing a use brings its pick back.
  const [rewriteOptions, setRewriteOptions] = useState<RewriteVariant[] | null>(null);
  const [quantifyList, setQuantifyList] = useState<QuantifySuggestion[] | null>(null);
  const quantifyApplied = useMemo(
    () => new Set((quantifyList ?? []).flatMap((q, i) => (marks.quantified.includes(quantifyKey(q)) ? [i] : []))),
    [quantifyList, marks.quantified],
  );
  const usedTake = rewriteOptions?.find((take) => take.text === marks.rewriteUsed) ?? null;
  // Each tool's caption, and so whether it has run. Two say what was picked from their proposals.
  const aiCaptions: Record<string, string | undefined> = {
    ...marks.captions,
    ...(usedTake ? { rewrite: `Applied the ${usedTake.style} take to your Summary.` } : {}),
    ...(quantifyList && quantifyList.length > 0 && quantifyApplied.size === quantifyList.length
      ? { quantify: `All ${quantifyList.length} bullets now carry a number.` }
      : {}),
  };
  const aiDone = new Set(Object.keys(marks.captions));
  // One job picker, three reasons to open it: Tailor and Add missing keywords
  // rewrite content against the job; the ATS card's "Against a job" only
  // scores against it.
  const { pickJob } = useJobPicker();

  // The ATS card's check — a real scan of the document on screen.
  const checker = useCheckResume();
  // What acting on a suggestion card came to, by card id — the card shows it in place of its
  // button — and what the last ask did. Marks: they leave with the change they describe on Undo.
  const suggestionOutcomes = marks.outcomes;
  const [askInput, setAskInput] = useState("");
  const askStatus = marks.askStatus;
  const setAskStatus = (text: string | null) => dispatch({ type: "learn", askStatus: text });

  const [activeCustomizeItem, setActiveCustomizeItem] = useState("templates");
  const [flashCustomizeItem, setFlashCustomizeItem] = useState<string | null>(null);
  const customizeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const paperWrapRef = useRef<HTMLDivElement>(null);
  // The PDF export prints this continuous copy of the paper, as the server's print page does: the
  // sheets in the preview are for the eye, one window per page.
  const printPaperRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);

  // Fit-to-width — the physical page (US Letter ≈ 816px at 96dpi) is wider
  // than the center column at narrower viewports, and no reasonable amount of
  // side-column/padding trimming changes that arithmetic. Rather than always
  // relying on the mat's `overflow-x-auto` scrollbar, scale the whole paper
  // down to fit when it doesn't. `mat`/`wrap` sizes are read via
  // `clientWidth`/`scrollWidth`/`scrollHeight` — all transform-invariant — so
  // this is safe to recompute from a plain ResizeObserver without a feedback
  // loop, and `PageGuides` counts pages from the paper's `offsetHeight` and
  // computed `min-height` (also transform-invariant) so scaling this doesn't
  // skew it.
  // Never scales below 50% — past that the document stops being legible, so
  // it falls back to the mat's horizontal scrollbar instead.
  const matRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, width: 816, height: 1000 });
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    const mat = matRef.current;
    const wrap = paperWrapRef.current;
    if (!mat || !wrap) return;

    const MIN_SCALE = 0.5;
    const measure = () => {
      const matStyle = getComputedStyle(mat);
      const available = mat.clientWidth - parseFloat(matStyle.paddingLeft) - parseFloat(matStyle.paddingRight);
      const naturalW = wrap.scrollWidth;
      const naturalH = wrap.scrollHeight;
      if (naturalW <= 0) return;
      const nextScale = Math.max(MIN_SCALE, Math.min(1, available / naturalW));
      setFit((prev) =>
        prev.scale === nextScale && prev.width === naturalW && prev.height === naturalH
          ? prev
          : { scale: nextScale, width: naturalW, height: naturalH },
      );
    };

    const observer = new ResizeObserver(measure);
    observer.observe(mat);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  const isBlank = isBlankContent(content);
  // Against the LIVE content, not `activeDoc.content`: that copy is only
  // written back on a document switch, so it would call a check current while
  // the user was typing past it.
  const checkIsStale = useMemo(() => isStaleCheck({ check, content }), [check, content]);
  // A job check's findings stand only while the check does — Remove takes the
  // "to match this posting" rewrite away with the posting it was matched to.
  const suggestions = check?.job ? (activeDoc.suggestions ?? null) : null;
  // The rail's suggestion cards: what the standing check found, against the
  // content as it is now — free, and gone the moment the check is removed.
  const checkSuggestions = useMemo(() => deriveCheckSuggestions(check, content, pageCount), [check, content, pageCount]);
  // The cards as the rail shows them: dismissed ones out, rewrites numbered like their lines on the page.
  const cards = useMemo(() => railCards(checkSuggestions, marks.outcomes, marks.dismissed), [checkSuggestions, marks.outcomes, marks.dismissed]);
  // The name it downloads as is the resume's own, as it stands, company and all (owner, 2026-10-04),
  // without an extension a source file left in it. The download dialog lets it be changed.
  const downloadFileName =
    activeDoc.label.replace(/\.(pdf|docx?|txt|md)\b/gi, "").trim() || (content.name.trim() ? `${content.name.trim()} Resume` : "Resume");
  const previewScale = Math.max(0.45, Math.min(1.8, fit.scale * (zoomPercent / 100)));

  const setZoom = (next: number) => setZoomPercent(Math.min(180, Math.max(45, next)));

  // The keyboard's undo and redo drive the same history as the pill. A field outside the editor's
  // own (the ask box, a hex code, the footer line, a dialog) keeps the browser's undo for its text.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const back = key === "z" && !event.shiftKey;
      const forward = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);
      if (!back && !forward) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[role='dialog']")) return;
      const field = target?.closest("input, textarea, select, [contenteditable='true']");
      if (field && !field.closest("[data-resume-undo]")) return;
      event.preventDefault();
      if (back) undo();
      else redo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  /**
   * Exports what is on screen. Word and Markdown are built from the content and
   * section order; PDF prints the live paper itself — the one rendering of the
   * chosen template and fonts that exists — at its page size, without the zoom
   * or the page-guide overlay around it.
   *
   * One page prints edge to edge, exactly as previewed. More than one takes the
   * design's vertical margin on every page instead, since the paper's own top
   * and bottom padding would otherwise land only on the first and last.
   */
  const handleDownload = async (format: DownloadFormat, fileName: string) => {
    // The name from the download dialog's field: the suggestion below, or what they changed it to.
    const base = fileName;
    if (format === "docx") {
      saveBlob(await resumeToDocx(content, design, sections), `${base}.docx`);
      return;
    }
    if (format === "md") {
      saveText(resumeToMarkdown(content, sections, design.doc.dateFormat), `${base}.md`);
      return;
    }
    const paper = printPaperRef.current?.firstElementChild;
    if (!(paper instanceof HTMLElement)) throw new Error("The resume preview isn't ready yet — try again in a moment.");
    // The editor's "No … added yet." prompts are for the editor: a section
    // that holds only one is left out of the PDF, as are the empty-name hint
    // and the on-screen page-break label (the break itself stays).
    const copy = paper.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("[data-resume-placeholder]").forEach((node) => (node.closest("[data-resume-section]") ?? node).remove());
    // So is what the editor is pointing at (paper/highlight.tsx): the frames and numbered markers
    // go, and a highlighted line or skill prints as plain text.
    copy.querySelectorAll("[data-resume-highlight]").forEach((node) => node.remove());
    copy.querySelectorAll("[data-resume-mark]").forEach((node) => node.removeAttribute("class"));
    // The page rules are shared with the server's print page (print-css.ts).
    const print = resumePrintSpec(design, pageCount > 1);
    await printDocument({
      title: base,
      html: `<div class="${print.className}">${copy.outerHTML}</div>`,
      pageSize: print.pageSize,
      pageMargin: print.pageMargin,
      bodyClass: ALL_FONT_VARS,
      css: print.css,
    });
  };

  // -------------------------------------------------------------------------
  // Leaving a document. `design`/`sections` come from the hook (live provider
  // state); `content` is this component's own local state. Both get written
  // back onto the OUTGOING document — the in-memory copy the landing reads —
  // while the save to the library is `useResumeAutosave` flushing as this
  // component unmounts. Another resume is opened, or a new one started, from
  // the landing (the header's switcher and New resume button were removed on
  // 2026-10-04 at the owner's request).
  // -------------------------------------------------------------------------

  // The stash however the resume is left: the browser's Back or Forward and the sidebar's link
  // move the screen through the address (see Client.tsx). Written as this body unmounts, with the
  // latest words and look, so the copy the workspace keeps (what reopening this resume starts
  // from) is never older than what was typed.
  const latest = useRef({ design, sections, content, check });
  useEffect(() => {
    latest.current = { design, sections, content, check };
  });
  useEffect(() => {
    const leaving = latest;
    return () => {
      const { design: lastDesign, sections: lastSections, content: lastContent, check: lastCheck } = leaving.current;
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDocId ? { ...d, design: lastDesign, sections: lastSections, content: lastContent, check: lastCheck } : d,
        ),
      );
    };
  }, [activeDocId, setDocuments]);

  // -------------------------------------------------------------------------
  // Customize tab — scroll-sync/flash-highlight, driven by the same ordered
  // `CUSTOMIZE_PANELS` list `CustomizeNav`/`CustomizePanelsRail` map over.
  // -------------------------------------------------------------------------

  const registerCustomizeRef = useCallback((id: string, el: HTMLDivElement | null) => {
    customizeRefs.current[id] = el;
  }, []);

  const scrollToSetting = (id: string) => {
    setActiveCustomizeItem(id);
    customizeRefs.current[id]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setFlashCustomizeItem(id);
    window.setTimeout(() => setFlashCustomizeItem((v) => (v === id ? null : v)), 1400);
  };

  // -------------------------------------------------------------------------
  // AI assist rail / AI tools tab.
  //
  // Every tool runs in the AI service, reaches a model and costs a credit —
  // `shorten` and `tone` included, which used to be fixed rules. Those two
  // rewrite text across the whole document, so their result is merged into the
  // content as it is now (`mergeRewrite`) rather than replacing it.
  //
  // What did NOT move is where the caption comes from. The service returns the
  // facts — which terms were added, how many words were cut, what was fixed —
  // and the sentence is still written here, because it is copy rather than
  // data, and a model is never asked to count its own edits.
  // -------------------------------------------------------------------------

  /**
   * Lands a finished run: its caption marks the tool done. With `change`, the
   * edit and the caption are one undo step (`landEdit`); without one the run
   * changed nothing, and its caption is a fact rather than a step (`landNote`).
   *
   * `change` is applied by the reducer to the content as it is NOW rather than
   * as it was when the button was pressed — which matters because a tool's
   * round trip is long enough for the user to have typed.
   */
  const landAiTool = (id: string, caption: string, change?: (now: ResumeContent) => ResumeContent) =>
    change ? landEdit(id, caption, change) : landNote(id, caption);

  const quote = (terms: string[]) => terms.map((term) => `"${term}"`).join(" and ");

  /**
   * A shorten or tone result, applied to the content as it is NOW. The summary
   * and each role's bullets take the rewrite only where they still match what
   * was sent, so anything typed during the round trip is kept, not overwritten.
   */
  const mergeRewrite = (now: ResumeContent, sent: ResumeContent, result: ResumeContent): ResumeContent => {
    const sentById = new Map(sent.experience.map((entry) => [entry.id, entry]));
    const resultById = new Map(result.experience.map((entry) => [entry.id, entry]));
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((line, i) => line === b[i]);
    return {
      ...now,
      summary: now.summary === sent.summary ? result.summary : now.summary,
      experience: now.experience.map((entry) => {
        const before = sentById.get(entry.id);
        const after = resultById.get(entry.id);
        return before && after && same(entry.bullets, before.bullets) ? { ...entry, bullets: after.bullets } : entry;
      }),
    };
  };

  /**
   * A keywords result, applied like `mergeRewrite` (it rewrites the summary and bullets too, since
   * 2026-10-03) plus its Skills: the service's list, with any skill typed during the round trip kept
   * on the end. Never `added` appended by hand: it names lines from the posting as well as skills.
   */
  const mergeKeywords = (now: ResumeContent, sent: ResumeContent, result: ResumeContent): ResumeContent => {
    const typed = now.skills.filter((skill) => !sent.skills.includes(skill));
    const have = new Set(result.skills.map((skill) => skill.toLowerCase()));
    // Sub skill groups follow the new list: a skill added joins the last group (`reconcileGroups`).
    return reconcileGroups({
      ...mergeRewrite(now, sent, result),
      skills: [...result.skills, ...typed.filter((skill) => !have.has(skill.toLowerCase()))],
    });
  };

  /** What a keywords run worked in, for its caption: short terms by name, lines from the posting by count. */
  const workedIn = (added: string[]) => {
    const named = added.filter((term) => term.trim().split(/\s+/).length <= 4);
    const lines = added.length - named.length;
    const parts = [
      named.length > 0 ? quote(named) : null,
      lines > 0 ? `${lines} ${lines === 1 ? "line" : "lines"} from the posting` : null,
    ];
    return `Worked in ${parts.filter(Boolean).join(" and ")}.`;
  };

  const runAiTool = (id: string) => {
    if (id === "tailor" && tailorPreset && tailorPreset.status !== "failed") {
      if (tailorPreset.status === "ready") void handleTailorJob(tailorPreset.job);
      return;
    }

    // The two tools that need a posting open the picker first; the run happens
    // on pick. Neither can be answered from the document alone, and the screen
    // does not keep a job description around — a standing check stores the
    // job's LABEL, not its text — so the posting is fetched fresh each time
    // rather than remembered and quietly going stale.
    if (id === "tailor" || id === "keywords") {
      void pickJobFor(id);
      return;
    }

    if (id === "rewrite") {
      void (async () => {
        const variants = await runSuggestion("rewrite", () => buildRewriteVariants({ content }));
        if (!variants) return;
        setRewriteOptions(variants);
        landAiTool(id, "3 fresh takes on your Summary — pick one below.");
      })();
      return;
    }

    if (id === "quantify") {
      void (async () => {
        const suggestions = await runSuggestion("quantify", () => quantifySuggestions({ content }));
        if (!suggestions) return;
        if (suggestions.length === 0) {
          landAiTool(id, "Every bullet already carries a number. Nothing to do.");
          return;
        }
        // Which are applied is read from the marks by each upgrade's own key, so a fresh list starts unapplied.
        setQuantifyList(suggestions);
        landAiTool(id, `${suggestions.length} bullet${suggestions.length === 1 ? "" : "s"} could carry a number — apply below.`);
      })();
      return;
    }

    if (id === "shorten") {
      const sent = content;
      void (async () => {
        const result = await runSuggestion("shorten", () => shortenToOnePage({ content: sent }));
        if (!result) return;
        if (result.removedWords === 0) {
          landAiTool(id, "Already fits one page — nothing worth cutting.");
          return;
        }
        const dropped =
          result.trimmedBullets > 0
            ? `, ${result.trimmedBullets} lower-impact bullet${result.trimmedBullets === 1 ? "" : "s"} dropped`
            : "";
        landAiTool(id, `Tightened by ${result.removedWords} words${dropped}.`, (now) => mergeRewrite(now, sent, result.content));
      })();
      return;
    }

    if (id === "tone") {
      const sent = content;
      void (async () => {
        const result = await runSuggestion("tone", () => fixToneAndGrammar({ content: sent }));
        if (!result) return;
        if (result.fixes.length === 0) {
          landAiTool(id, "No issues found. Your resume reads clean.");
          return;
        }
        landAiTool(id, `Fixed: ${result.fixes.join(", ")}.`, (now) => mergeRewrite(now, sent, result.content));
      })();
      return;
    }
  };

  /**
   * Add missing keywords, against a posting the user just picked.
   *
   * WHICH terms are missing is decided in the service from the resume itself —
   * the same filter this screen used to run locally — so `added` is a fact
   * about the document rather than a model's claim, and an empty `added` is the
   * honest "nothing missing" rather than a model declining to answer.
   */
  const handleKeywordsJob = async (job: ResumeJob) => {
    const sent = content;
    const result = await runSuggestion("keywords", () =>
      injectKeywords({ content: sent, jdText: job.description, company: job.company, role: job.role }),
    );
    if (!result) return;

    if (result.added.length === 0) {
      landAiTool("keywords", `Nothing missing. Your resume already covers what ${job.company} asked for.`);
      return;
    }
    // Folded onto the content as it is NOW, so typing during the round trip is kept (see `mergeKeywords`).
    landAiTool("keywords", workedIn(result.added), (now) => mergeKeywords(now, sent, result.content));
  };

  /** Tailor lands here from the job picker. */
  const handleTailorJob = async (job: ResumeJob) => {
    const result = await runSuggestion("tailor", () =>
      tailorToJob({ content, jdText: job.description, company: job.company, role: job.role }),
    );
    if (!result) return;

    // `woven` names only what the result carries, so it can be empty.
    const caption =
      result.woven.length > 0
        ? `Tailored to ${job.role} at ${job.company}: wove ${quote(result.woven)} in.`
        : `Tailored your summary to ${job.role} at ${job.company}.`;
    // Only the two fields the service actually rewrote, folded onto the
    // content as it is NOW. `tailorToJob` used to be a pure function this
    // screen could simply re-run against `prev`; it is a round trip now, and
    // writing `result.content` back whole would silently discard anything the
    // user typed while it was out. The service asks the model for a narrow
    // diff — a summary and a skills list — precisely so the rest of the
    // document never has to travel, and this is the other half of that deal.
    //
    // Deliberately NOT a check. This used to stamp a job check with a score
    // 13 points up, which reported a measurement nobody had taken. Tailoring
    // changes the text, so any standing check goes stale by itself and the
    // card offers to run it again — which is the only way to know whether
    // the tailor actually moved the number.
    // Sub skill groups follow the tailored list, as they do for keywords (`reconcileGroups`).
    landAiTool("tailor", caption, (prev) => reconcileGroups({ ...prev, summary: result.content.summary, skills: result.content.skills }));
  };

  // -------------------------------------------------------------------------
  // The ATS card's own checks — score only, never a content rewrite. A real
  // scan of the document as it stands, through the same scorer the ATS screen
  // uses, so the two surfaces report the same number for the same text.
  // -------------------------------------------------------------------------

  /**
   * Runs one check and puts it on the document it was run for.
   *
   * A check is a measurement, not an edit: it lands as a fact of the history
   * (see `editor-state.ts`), so Undo never takes a score away or brings an
   * older one back. Removing it is the edit, and that is a step.
   *
   * The document id is captured before the await, not read after it: a check
   * that lands after a switch belongs to the resume it scored. (In practice a
   * switch remounts this component and aborts the stream first; this is what
   * keeps the write correct if that ever stops being true.)
   */
  const runCheck = async (posting: CheckPosting | null) => {
    const docId = activeDocId;
    const putCheck = (landed: ResumeCheck) => {
      dispatch({ type: "learn", check: landed });
      setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, check: landed } : d)));
    };
    const settled = await checker.run({ content, label: activeDoc.label, job: posting }, putCheck);
    if (settled) putCheck(settled);
  };

  const checkGeneral = () => void runCheck(null);

  const checkAgainstJob = (job: ResumeJob) =>
    void runCheck({ id: job.id, company: job.company, role: job.role, description: job.description });

  /** The same check again — same posting (or none), the text as it is now. */
  const recheck = () => void runCheck(check?.posting ?? null);

  /** Every reason starts from the same pick; cancelling it leaves the document as it was. */
  const pickJobFor = async (use: "tailor" | "keywords" | "scan") => {
    const result = await pickJob(RESUME_JOB_SPEC);
    if (result.status !== "picked") return;
    if (use === "scan") checkAgainstJob(result.job);
    else if (use === "keywords") await handleKeywordsJob(result.job);
    else await handleTailorJob(result.job);
  };

  /**
   * Removes the standing check — the card offers the two ways to run another.
   * Only the check goes: the scan itself is still on file in the AI service,
   * and nothing a tool did to the content is undone. Tailoring is not a check
   * any more, so removing one no longer resets the Tailor tool either. It is
   * one undo step: Undo puts the check back, until another check is run.
   * (The workspace's copy follows as the editor is left — see the stash.)
   */
  /** Sets a fix card aside: a step, so Undo brings it back. */
  const dismissCheckSuggestion = (suggestion: CheckSuggestion) => {
    setPointFocus(null);
    dispatch({ type: "edit", marks: (m) => ({ dismissed: [...m.dismissed, suggestion.id] }) });
  };

  /** What a fix card is about on the page: its line, the Skills it adds to, or the roles it reworks. */
  const focusOfSuggestion = (suggestion: CheckSuggestion | null): PaperFocus | null => {
    if (!suggestion) return null;
    if (suggestion.kind === "rewrite") {
      const at = suggestion.rewrite?.at;
      const entry = at ? content.experience[at.entryIndex] : undefined;
      return at && entry ? { section: "experience", entryId: entry.id, bullets: [at.bulletIndex] } : null;
    }
    // The terms are highlighted wherever they already stand in Skills, which after "Add them" is everywhere.
    if (suggestion.kind === "keywords") return { section: "skills", skills: suggestion.terms };
    if (suggestion.kind === "quantify") return { section: "experience" };
    return null;
  };

  /** What an AI tool, a Rewrite take or a Quantify proposal is about on the page. */
  const focusOfTool = (pointer: AiToolPointer): PaperFocus | null => {
    if (!pointer) return null;
    if ("take" in pointer) return { section: "summary" };
    if ("quantify" in pointer) {
      const proposal = quantifyList?.[pointer.quantify];
      const entry = proposal ? content.experience[proposal.entryIndex] : undefined;
      return proposal && entry ? { section: "experience", entryId: entry.id, bullets: [proposal.bulletIndex] } : null;
    }
    if (pointer.tool === "tailor" || pointer.tool === "rewrite") return { section: "summary" };
    if (pointer.tool === "keywords") return { section: "skills" };
    if (pointer.tool === "quantify") return { section: "experience" };
    return null;
  };

  const removeCheck = () => {
    dispatch({ type: "edit", removeCheck: true });
    checker.clearFailure();
  };

  // A take used is a step with its mark, so Undo puts the old Summary back and the takes with it.
  const useRewriteVariant = (index: number) => {
    const variant = rewriteOptions?.[index];
    if (!variant) return;
    dispatch({ type: "edit", content: (prev) => ({ ...prev, summary: variant.text }), marks: { rewriteUsed: variant.text } });
  };

  const applyQuantifyAt = (index: number) => {
    const suggestion = quantifyList?.[index];
    if (!suggestion || quantifyApplied.has(index)) return;
    dispatch({
      type: "edit",
      content: (prev) => applyQuantify(prev, suggestion),
      marks: (m) => ({ quantified: [...m.quantified, quantifyKey(suggestion)] }),
    });
  };

  const applyAllQuantify = () => {
    const waiting = (quantifyList ?? []).filter((_, i) => !quantifyApplied.has(i));
    if (waiting.length === 0) return;
    dispatch({
      type: "edit",
      content: (prev) => waiting.reduce(applyQuantify, prev),
      marks: (m) => ({ quantified: [...m.quantified, ...waiting.map(quantifyKey)] }),
    });
  };

  const acceptSummarySuggestion = () => {
    if (!suggestions) return;
    const { text } = suggestions.summary;
    dispatch({ type: "edit", content: (prev) => ({ ...prev, summary: text }), marks: { summarySuggestion: "accepted" } });
  };
  const dismissSummarySuggestion = () => dispatch({ type: "edit", marks: { summarySuggestion: "dismissed" } });

  /**
   * Acts on one of the rail's suggestion cards — each is a finding of the
   * standing check, wired to the tool that addresses it (see
   * `check-suggestions.ts`). Cards that spend a credit go through the same
   * `runSuggestion` as the AI Tools tab, so "one tool at a time", the failure
   * toast and the credit-meter refresh are the same everywhere.
   */
  const runCheckSuggestion = async (suggestion: CheckSuggestion) => {
    // A card that changed the words: the change and its outcome are one undo step, so Undo brings
    // the card's button back. One that changed nothing only learned something, and stays settled.
    const settleWith = (caption: string, change: (now: ResumeContent) => ResumeContent) =>
      dispatch({ type: "edit", content: change, marks: (m) => ({ outcomes: { ...m.outcomes, [suggestion.id]: caption } }) });
    const settle = (caption: string) => dispatch({ type: "learn", outcome: { id: suggestion.id, text: caption } });

    if (suggestion.kind === "keywords" && suggestion.terms?.length) {
      // The check's own missing terms as the want-list, so the tool works in
      // exactly what the scan found missing rather than re-deriving a list
      // from the posting. WHICH are still missing is decided by the service.
      const sent = content;
      const result = await runSuggestion("keywords", () => injectKeywords({ content: sent, keywords: suggestion.terms }));
      if (!result) return;
      if (result.added.length === 0) {
        settle("Already covered. Nothing to add.");
        return;
      }
      // Merged onto the content as it is NOW: the summary and bullets only where they are still
      // what was sent, and the service's Skills with anything typed meanwhile (`mergeKeywords`).
      settleWith(workedIn(result.added), (now) => mergeKeywords(now, sent, result.content));
      return;
    }

    if (suggestion.kind === "rewrite" && suggestion.rewrite?.at) {
      // Free: the scan generated this line and was paid for. Re-located against
      // the content as it is now, and applied only if the original still
      // stands — a line edited since is the user's, not the scan's.
      const { before, after } = suggestion.rewrite;
      settleWith("Applied to your bullet.", (now) => applyBulletRewrite(now, before, after));
      return;
    }

    // Quantify proposes lines to review and shorten rewrites across the whole
    // document, so both run as the AI Tools tab's own tools — their results
    // and captions land there, where the proposals can be picked.
    if (suggestion.kind === "quantify" || suggestion.kind === "shorten") {
      setDocTab("ai");
      runAiTool(suggestion.kind);
    }
  };

  /**
   * The rail's "Ask for a rewrite…" box — the cover letter's revise, for a
   * resume. The instruction and the document on screen go to the AI service,
   * which answers with a narrow diff (summary + bullets by marker) and has
   * already thrown out any proposed line that adds a figure the resume never
   * had or balloons past the line it replaces.
   *
   * Applied with `mergeRewrite`, like shorten and tone: the round trip is long
   * enough to type in, and a line typed during it is kept, not overwritten.
   * The caption is written here from the service's counts — which parts
   * changed, and how many proposals were kept back — never from model prose.
   *
   * A failure keeps the instruction in the box, so it can be reworded or
   * retried; `useResumeSuggestion` has already toasted why.
   */
  const handleAskSubmit = async () => {
    const instruction = askInput.trim();
    if (!instruction || aiRunning) return;
    if (isBlank) {
      setAskStatus("Add a summary or some bullet points first, then say how you'd like them changed.");
      return;
    }
    const sent = content;
    setAskStatus(null);
    const result = await runSuggestion("ask", () => askForRewrite({ content: sent, instruction }));
    if (!result) return;

    const parts = [
      result.summaryChanged ? "your Summary" : null,
      result.bulletsChanged > 0 ? `${result.bulletsChanged} bullet${result.bulletsChanged === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    const held =
      result.rejectedLines > 0
        ? ` ${result.rejectedLines} proposed line${result.rejectedLines === 1 ? "" : "s"} would have added details your resume doesn't have, so ${result.rejectedLines === 1 ? "it was" : "they were"} left as you wrote ${result.rejectedLines === 1 ? "it" : "them"}.`
        : "";
    // The rewrite and what it says about itself are one undo step.
    dispatch({
      type: "edit",
      content: (now) => mergeRewrite(now, sent, result.content),
      marks: {
        askStatus: `Rewrote ${parts.join(" and ")} to “${instruction}”.${held} Not quite right? Say what to change next, or edit it directly.`,
      },
    });
    setAskInput("");
  };

  // The paper's highlight: what is pointed at, and — on AI Tools, as in the design — each fix
  // card's number beside the line it rewrites, while it waits.
  const pinned = useMemo(() => pinnedLines(cards, content, marks.outcomes), [cards, content, marks.outcomes]);
  const paperHighlight = useMemo(
    () => ({ focus: pointFocus, marks: docTab === "ai" ? pinned : [] }),
    [pointFocus, docTab, pinned],
  );

  return (
    <div className={cn("min-h-screen bg-[#f6f6f6]", ALL_FONT_VARS)}>
      {/* Header */}
      <header className="sticky top-0 z-20 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        {/* No back button (owner, 2026-10-04): the landing is the sidebar's link, or the browser's Back.
            The tabs are a sand track with the open tab in a dark pill that slides between them
            (owner, 2026-10-04), the same switch the Customize panels use. */}
        <nav aria-label="Resume editor" ref={tabGroupRef} className="relative flex items-center gap-1 rounded-xl bg-[#f0f0ea] p-1">
          {tabPillStyle && (
            <span
              aria-hidden
              style={tabPillStyle}
              className="pointer-events-none absolute rounded-[9px] bg-[#222325] transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
            />
          )}
          {DOC_TABS.map((tab) => {
            const open = docTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={tabItemRef(tab.id)}
                type="button"
                aria-current={open ? "page" : undefined}
                onClick={() => setDocTab(tab.id)}
                className={cn(
                  "relative z-[1] flex h-9 cursor-pointer items-center gap-2 rounded-[9px] px-4 text-sm transition-colors duration-200",
                  open ? "font-bold text-white" : "font-semibold text-[#55564f] hover:text-primary",
                  open && !tabPillStyle && "bg-[#222325]",
                )}>
                {tab.icon && <tab.icon aria-hidden className={cn("h-[15px] w-[15px]", open && "text-[#e1f073]")} />}
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 flex-none">
          <StickerButton type="button" variant="primary" size="md" onClick={() => setDownloadOpen(true)}>
            <Download className="h-4 w-4" />
            Download
          </StickerButton>
          <NotificationBell />
        </div>
      </header>

      <main className="px-6 py-7 pb-14 max-w-[2200px] mx-auto">
        {banner && <div className="mb-4">{banner}</div>}
        <div className={cn("grid gap-4 items-start", GRID_COLS_CLASS(sidebarCollapsed)[docTab])}>
          {/* LEFT SIDEBAR — Overview has none; its old "N pages · N roles ·
              last edited" line moved to a small caption above the preview
              (below), shown on every tab instead of parked in a rail only
              Overview ever showed. */}
          {docTab !== "overview" && (
            <aside data-resume-undo className="sticky top-[88px] max-h-[calc(100vh-112px)] overflow-y-auto overflow-x-hidden scrollbar-neo p-0.5 pb-1">
              {docTab === "content" && (
                <ContentForm
                  content={content}
                  setContent={typeContent}
                  suggestionReason={suggestions?.summary.reason ?? null}
                  summarySuggestion={marks.summarySuggestion}
                  onAcceptSummarySuggestion={acceptSummarySuggestion}
                  onDismissSummarySuggestion={dismissSummarySuggestion}
                />
              )}

              {docTab === "customize" && (
                <div className="rounded-xl border-2 border-[#222325] bg-white p-1.5">
                  <CustomizeNav activeItem={activeCustomizeItem} onSelect={scrollToSetting} />
                </div>
              )}

              {docTab === "ai" && aiLocked && (
                  <button
                    type="button"
                    onClick={lockedAi}
                    className="mb-2.5 flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border-[1.5px] border-[#222325]/15 bg-[#f4f7d4] px-3 py-2.5 text-left text-xs leading-snug text-black/70 transition-colors hover:border-[#222325]">
                    <span>AI help in the builder is on Basic and up. Free keeps the builder itself.</span>
                    <PlanChip plan="basic" className="flex-none bg-white" />
                  </button>
                )}
              {docTab === "ai" && (
                <AiToolsList
                  aiRunning={aiRunning}
                  aiDone={aiDone}
                  captions={aiCaptions}
                  onRun={aiLocked ? lockedAi : runAiTool}
                  tailorFor={tailorPreset}
                  onPickTailorJob={() => void pickJobFor("tailor")}
                  rewriteVariants={rewriteOptions}
                  onUseRewrite={useRewriteVariant}
                  quantify={quantifyList}
                  quantifyApplied={quantifyApplied}
                  onApplyQuantify={applyQuantifyAt}
                  onApplyAllQuantify={applyAllQuantify}
                  keywordsFound={cards.find((card) => card.kind === "keywords")?.terms?.length ?? null}
                  pageCount={pageCount}
                  onPointAt={(pointer) => setPointFocus(focusOfTool(pointer))}
                />
              )}
            </aside>
          )}

          {/* CENTER — resume document preview, identical across every tab. The provider hands the
              paper what the controls point at; the PDF export strips what it draws. */}
          <PaperHighlightProvider value={paperHighlight}>
          <section className="min-w-0">
            {/* Wraps where the column is narrow (Content, on a laptop): the pills drop under the caption, still on the right. */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-1 text-xs text-black/45">
              {/* "[x pages] · [edited x min ago]" (owner, 2026-10-04). A save that didn't land still says so. */}
              <p aria-live="polite">
                {pageCount} page{pageCount === 1 ? "" : "s"} · {autosave.status.kind === "saved" && <EditedAgo at={autosave.savedAt} />}
                {autosave.status.kind === "saving" && "saving…"}
                {/* Two different failures. One that may pass on its own is
                    retried for them, so the copy says that and nothing about
                    why — the upstream's own sentence already says "try again",
                    and it is us doing the trying. A refusal is theirs to fix,
                    so it gets the server's sentence, which names the field. */}
                {autosave.status.kind === "error" && (
                  <span className="font-semibold text-[#b23c26]">
                    {autosave.status.retrying ? (
                      "not saved yet. We'll keep trying, and your changes are safe on this page."
                    ) : (
                      <>
                        not saved: {autosave.status.message}{" "}
                        <button type="button" onClick={autosave.flush} className="cursor-pointer underline decoration-2 underline-offset-2">
                          Try again
                        </button>
                      </>
                    )}
                  </span>
                )}
              </p>

              <div className="ml-auto flex flex-none items-center gap-2">
                {/* The fix cards' numbers, as the design has it, said once above the page. */}
                {docTab === "ai" && pinned.length > 0 && (
                  <span className="mr-1 flex items-center gap-1.5 text-xs font-bold text-primary">
                    <span className="grid h-[18px] w-[18px] place-content-center rounded-full bg-[#222325] text-[10px] text-white">{pinned.length}</span>
                    {pinned.length === 1 ? "line has" : "lines have"} a suggested rewrite
                  </span>
                )}
                {/* Undo / redo — the zoom pill's twin, over the preview on every tab. It covers anything
                  done to this resume from any tab (see `editor-state.ts`); Ctrl/⌘+Z and
                  Ctrl/⌘+Shift+Z (or Ctrl+Y) do the same. */}
                <div className="flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm transition-[border-color,box-shadow] duration-100 ease-out br-plain">
                  <button
                    type="button"
                    aria-label="Undo"
                    title="Undo"
                    onClick={undo}
                    disabled={!canUndo}
                    className={cn(ZOOM_BUTTON_CLASS, HISTORY_BUTTON_CLASS)}>
                    <Undo2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    aria-label="Redo"
                    title="Redo"
                    onClick={redo}
                    disabled={!canRedo}
                    className={cn(ZOOM_BUTTON_CLASS, HISTORY_BUTTON_CLASS)}>
                    <Redo2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                </div>

                {/* Zoom — a quiet pill that only comes forward on hover. */}
                <div className="group/zoom flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm transition-[border-color,box-shadow] duration-100 ease-out br-plain">
                  <button
                    type="button"
                    aria-label="Zoom out"
                    onClick={() => setZoom(Math.max(45, zoomPercent - 10))}
                    className={ZOOM_BUTTON_CLASS}>
                    −
                  </button>
                  <span className="min-w-[48px] text-center text-xs font-semibold tabular-nums text-black/70 transition-colors group-hover/zoom:text-primary">
                    {zoomPercent}%
                  </span>
                  <button
                    type="button"
                    aria-label="Zoom in"
                    onClick={() => setZoom(Math.min(180, zoomPercent + 10))}
                    className={ZOOM_BUTTON_CLASS}>
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(100)}
                    className={cn(ZOOM_BUTTON_CLASS, "ml-1 w-auto bg-[#f4f4f0] px-2.5 text-xs font-medium hover:bg-[#e1f073]")}>
                    Fit
                  </button>
                </div>
              </div>
            </div>

            <div ref={matRef} className="rounded-md bg-[#f0f0ea] p-1 overflow-x-auto overflow-y-hidden">
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
                comment above.
              */}
              <div
                className="mx-auto"
                style={{
                  width: fit.width * previewScale,
                  height: fit.height * previewScale,
                }}>
                <div
                  style={{
                    width: fit.width,
                    height: fit.height,
                    transform: previewScale < 1 ? `scale(${previewScale})` : `scale(${previewScale})`,
                    transformOrigin: "top left",
                  }}>
                  {/* Every page its own A4 sheet, 25px apart on screen at any zoom, like Word (owner, 2026-10-04):
                      see PagedResume. The gap is inside the scaled paper, so it's divided by the scale. */}
                  <div ref={paperWrapRef} className="w-fit">
                    <PagedResume
                      design={design}
                      sections={sections}
                      content={content}
                      chrome={design.chrome}
                      gap={25 / previewScale}
                      sheetClassName="rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.15)]"
                      onPageCountChange={setPageCount}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* The continuous paper the PDF export prints (see `printPaperRef`), out of sight. */}
            <div ref={printPaperRef} aria-hidden className="pointer-events-none fixed left-[-10000px] top-0">
              <ResumePaper design={design} sections={sections} content={content} chrome={design.chrome} />
            </div>
          </section>
          </PaperHighlightProvider>

          {/* RIGHT RAIL */}
          <aside className="sticky top-[88px]">
            {docTab === "customize" ? (
              <CustomizePanelsRail flashItem={flashCustomizeItem} registerRef={registerCustomizeRef} />
            ) : (
              <AiAssistRail
                isBlank={isBlank}
                cards={cards}
                dismissedCount={checkSuggestions.filter((suggestion) => marks.dismissed.includes(suggestion.id)).length}
                check={check}
                stale={checkIsStale}
                checkStatus={checker.status}
                checkFailure={checker.failure}
                onRemoveCheck={removeCheck}
                onCheckGeneral={checkGeneral}
                onCheckAgainstJob={() => void pickJobFor("scan")}
                onRecheck={recheck}
                onDismissCheckFailure={checker.clearFailure}
                suggestionOutcomes={suggestionOutcomes}
                onRunSuggestion={(suggestion) => void runCheckSuggestion(suggestion)}
                onDismissSuggestion={dismissCheckSuggestion}
                onPointAt={(suggestion) => setPointFocus(focusOfSuggestion(suggestion))}
                aiRunning={aiRunning}
                askInput={askInput}
                onAskInputChange={setAskInput}
                onAskSubmit={() => void handleAskSubmit()}
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
        fileName={safeFileName(downloadFileName)}
        onDownload={handleDownload}
      />
    </div>
  );
};

export default ResumeScreenBody;
