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

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FC, type SetStateAction } from "react";
import { ArrowLeft, Download, Plus } from "lucide-react";
import TimeAgo from "timeago-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import DownloadModal from "@/app/components/dashboard/modals/DownloadModal";
import { ResumePaper, PageGuides } from "@/app/components/dashboard/resume/paper";
import { useResumeDesign } from "@/app/components/dashboard/resume/useResumeDesign";
import { ALL_FONT_VARS } from "@/app/lib/dashboard/resume/fonts";
import { apiMessage } from "@/app/lib/api/core";
import { createResumeDocument } from "@/app/lib/resume/api";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { useSidebarCollapse } from "@/app/components/dashboard/SidebarCollapseContext";
import {
  cloneContent,
  createBlankContent,
  fromStored,
  isBlankContent,
  isStaleCheck,
  type CheckPosting,
  type ResumeCheck,
  type ResumeDocument,
} from "./resume-document";
import { useResumeAutosave } from "./useResumeAutosave";
import DocumentSwitcher from "./DocumentSwitcher";
import NewResumeDialog, { type NewResumeMode } from "./NewResumeDialog";
import ContentForm from "./content/ContentForm";
import CustomizeNav from "./CustomizeNav";
import CustomizePanelsRail from "./CustomizePanelsRail";
import AiAssistRail from "./AiAssistRail";
import AiToolsList from "./AiToolsList";
import { useJobPicker } from "@/app/components/dashboard/jobs/JobPickerProvider";
import type { PickedJob } from "@/app/lib/jobs/fields";
// `applyQuantify` is the one tool function still executed in the browser, and
// deliberately so: committing a chosen suggestion substitutes one string at one
// index. It is an array update, it has to feel instant, and a round trip could
// only make it slower and occasionally fail. Everything that needs judgment —
// or a credit — now runs in the AI service through `app/lib/resume/ai.ts`.
import { applyQuantify, type QuantifySuggestion, type RewriteVariant } from "@/app/lib/dashboard/resume/ai-tools";
import {
  fixToneAndGrammar,
  injectKeywords,
  quantifySuggestions,
  rewriteVariants as buildRewriteVariants,
  shortenToOnePage,
  tailorToJob,
} from "@/app/lib/resume/ai";
import { useResumeSuggestion } from "@/hooks/mutations/useResumeSuggestion";
import { useCheckResume } from "@/hooks/mutations/useCheckResume";

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
        content: "grid-cols-[380px_1fr_350px]",
        customize: "grid-cols-[180px_1fr_450px]",
        ai: "grid-cols-[300px_1fr_360px]",
      }
    : {
        overview: "grid-cols-[1fr_324px]",
        content: "grid-cols-[360px_1fr_320px]",
        customize: "grid-cols-[188px_1fr_404px]",
        ai: "grid-cols-[308px_1fr_324px]",
      };

// The three zoom controls share one quiet recipe — hairline border, full
// circle, muted ink — so the control sits in the background. Hover is where
// it comes forward: ink border, a hair of hard shadow, and a real press that
// travels onto that shadow and drops it.
const ZOOM_BUTTON_CLASS =
  "grid h-6 w-6 place-content-center rounded-full border border-black/15 bg-white text-sm font-semibold leading-none text-black/70 transition-[transform,box-shadow,background-color,border-color,color] duration-100 ease-out hover:border-[#222325] hover:bg-[#f7f7f7] hover:text-primary hover:shadow-[0.5px_0.5px_0_0_#222325] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none cursor-pointer";

// What Tailor and the ATS card's "Against a job" read from a picked job. Skills
// and requirements are asked for but never required: a pasted posting may name
// none. One constant feeds both the pick and the type, so they cannot drift.
const RESUME_JOB_SPEC = "company, role, description, skills?, requirements?";
type ResumeJob = PickedJob<typeof RESUME_JOB_SPEC>;

export interface ResumeScreenBodyProps {
  documents: ResumeDocument[];
  activeDocId: string;
  activeDoc: ResumeDocument;
  setDocuments: Dispatch<SetStateAction<ResumeDocument[]>>;
  setActiveDocId: Dispatch<SetStateAction<string | null>>;
  /** Every save that lands, including the one flushed as this component unmounts — see `useResumeAutosave`. */
  onSaved: (id: string, updatedAt: Date) => void;
}

const ResumeScreenBody: FC<ResumeScreenBodyProps> = ({ documents, activeDocId, activeDoc, setDocuments, setActiveDocId, onSaved }) => {
  const { design, sections, dispatch } = useResumeDesign();
  const { collapsed: sidebarCollapsed } = useSidebarCollapse();

  const [docTab, setDocTab] = useState<DocTab>("content");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [newResumeOpen, setNewResumeOpen] = useState(false);
  const [creatingResume, setCreatingResume] = useState(false);

  // The active document's live content — captured here for the same reason
  // design/sections live in the provider: it must be readable at the moment
  // of an explicit save-before-switch (see `switchTo`/`createNewResume`).
  const [content, setContent] = useState<ResumeContent>(() => activeDoc.content);

  // Whether there is anything to accept is `suggestions` below; this is only
  // what the user has done about it.
  const [summarySuggestion, setSummarySuggestion] = useState<SummarySuggestionState>("pending");

  // Everything a resume IS — content, design, sections — saved as it changes.
  // The ATS state further down is deliberately not part of it.
  const autosave = useResumeAutosave({ id: activeDocId, content, design, sections, savedAt: activeDoc.updatedAt, onSaved });

  // Which tool is out, and why the last one came back empty-handed. Owned by
  // the hook rather than by this component: a run can now fail, and "one at a
  // time" has to hold across an await rather than across a timeout.
  const { running: aiRunning, run: runSuggestion } = useResumeSuggestion();
  const [aiDone, setAiDone] = useState<Set<string>>(new Set());
  // Live per-tool result captions + the two tools with inline pickers.
  const [aiCaptions, setAiCaptions] = useState<Record<string, string | undefined>>({});
  const [rewriteOptions, setRewriteOptions] = useState<RewriteVariant[] | null>(null);
  const [quantifyList, setQuantifyList] = useState<QuantifySuggestion[] | null>(null);
  const [quantifyApplied, setQuantifyApplied] = useState<Set<number>>(new Set());
  // One job picker, three reasons to open it: Tailor and Add missing keywords
  // rewrite content against the job; the ATS card's "Against a job" only
  // scores against it.
  const { pickJob } = useJobPicker();

  // The ATS card's check — a real scan of the document on screen.
  const checker = useCheckResume();
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(new Set());
  const [askInput, setAskInput] = useState("");
  const [askStatus, setAskStatus] = useState<string | null>(null);

  const [activeCustomizeItem, setActiveCustomizeItem] = useState("document");
  const [flashCustomizeItem, setFlashCustomizeItem] = useState<string | null>(null);
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
  const checkIsStale = useMemo(() => isStaleCheck({ check: activeDoc.check, content }), [activeDoc.check, content]);
  // A job check's findings stand only while the check does — Remove takes the
  // "to match this posting" rewrite away with the posting it was matched to.
  const suggestions = activeDoc.check?.job ? (activeDoc.suggestions ?? null) : null;
  const downloadFileName = content.name.trim() ? `${content.name.trim().replace(/\s+/g, "-")}-Resume` : "Resume";
  const previewScale = Math.max(0.45, Math.min(1.8, fit.scale * (zoomPercent / 100)));

  const setZoom = (next: number) => setZoomPercent(Math.min(180, Math.max(45, next)));

  // -------------------------------------------------------------------------
  // Document switch / create — explicit save-then-swap, not a reactive
  // effect. `design`/`sections` come from the hook (live provider state);
  // `content` is this component's own local state. Both get written back
  // onto the OUTGOING document before the id changes. That stash is only the
  // in-memory copy the switcher and the landing read; the save to the library
  // is `useResumeAutosave` flushing as this component unmounts.
  // -------------------------------------------------------------------------

  const switchTo = useCallback(
    (nextId: string) => {
      if (nextId === activeDocId) return;
      setDocuments((prev) => prev.map((d) => (d.id === activeDocId ? { ...d, design, sections, content } : d)));
      setActiveDocId(nextId);
    },
    [activeDocId, design, sections, content, setDocuments, setActiveDocId],
  );

  // Back to the landing — same stash-the-outgoing-document discipline as
  // `switchTo`, just with no incoming document afterwards.
  const backToLanding = useCallback(() => {
    setDocuments((prev) => prev.map((d) => (d.id === activeDocId ? { ...d, design, sections, content } : d)));
    setActiveDocId(null);
  }, [activeDocId, design, sections, content, setDocuments, setActiveDocId]);

  const createNewResume = useCallback(
    async (label: string, mode: NewResumeMode) => {
      setCreatingResume(true);
      try {
        // A fresh document always starts at the base design/sections — even
        // "duplicate" only copies CONTENT, never the outgoing document's
        // customization, so every new document genuinely starts at the real
        // default look (which the library stores as no design at all).
        const stored = await createResumeDocument({
          label: label.trim() || "New resume",
          content: mode === "duplicate" ? cloneContent(content) : createBlankContent(),
        });
        const newDoc = fromStored(stored);
        setDocuments((prev) => [newDoc, ...prev.map((d) => (d.id === activeDocId ? { ...d, design, sections, content } : d))]);
        setActiveDocId(newDoc.id);
        setNewResumeOpen(false);
      } catch (error) {
        // The dialog stays open on what they typed: nothing was created, so
        // there is nothing to switch to.
        toast.error(apiMessage(error));
      } finally {
        setCreatingResume(false);
      }
    },
    [activeDocId, design, sections, content, setDocuments, setActiveDocId],
  );

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
  // Every tool now runs in the AI service. Four of them reach a model and cost
  // a credit; `shorten` and `tone` are deterministic and cost nothing, but they
  // go over the wire too so that what a tool does has one definition rather
  // than two that drift.
  //
  // What did NOT move is where the caption comes from. The service returns the
  // facts — which terms were added, how many words were cut, what was fixed —
  // and the sentence is still written here, because it is copy rather than
  // data, and a model is never asked to count its own edits.
  // -------------------------------------------------------------------------

  /**
   * Lands a finished run: apply the edit, mark the tool done, write its caption.
   *
   * `apply` runs inside the same handler the await returned to, so the edit is
   * made against the content as it is NOW rather than as it was when the button
   * was pressed — which matters because a tool's round trip is long enough for
   * the user to have typed.
   */
  const landAiTool = (id: string, caption: string, apply?: () => void) => {
    apply?.();
    setAiDone((prev) => new Set(prev).add(id));
    setAiCaptions((prev) => ({ ...prev, [id]: caption }));
  };

  const quote = (terms: string[]) => terms.map((term) => `"${term}"`).join(" and ");

  const runAiTool = (id: string) => {
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
        landAiTool(id, "3 fresh takes on your Summary — pick one below.", () => setRewriteOptions(variants));
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
        landAiTool(id, `${suggestions.length} bullet${suggestions.length === 1 ? "" : "s"} could carry a number — apply below.`, () => {
          setQuantifyList(suggestions);
          setQuantifyApplied(new Set());
        });
      })();
      return;
    }

    if (id === "shorten") {
      void (async () => {
        const result = await runSuggestion("shorten", () => shortenToOnePage({ content }));
        if (!result) return;
        if (result.removedWords === 0) {
          landAiTool(id, "Already tight — nothing worth cutting.");
          return;
        }
        landAiTool(
          id,
          `Trimmed ${result.removedWords} words (${result.trimmedBullets} lower-impact bullet${result.trimmedBullets === 1 ? "" : "s"}).`,
          () => setContent(result.content),
        );
      })();
      return;
    }

    if (id === "tone") {
      void (async () => {
        const result = await runSuggestion("tone", () => fixToneAndGrammar({ content }));
        if (!result) return;
        if (result.fixes.length === 0) {
          landAiTool(id, "No issues found — your resume reads clean.");
          return;
        }
        landAiTool(id, `Fixed ${result.fixes.join(", ")}.`, () => setContent(result.content));
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
    const result = await runSuggestion("keywords", () =>
      injectKeywords({ content, jdText: job.description, company: job.company, role: job.role }),
    );
    if (!result) return;

    if (result.added.length === 0) {
      landAiTool("keywords", `Nothing missing — your resume already covers what ${job.company} asked for.`);
      return;
    }
    // The same narrow diff as `tailor`, for the same reason — see the note there.
    landAiTool("keywords", `Added ${quote(result.added)} to your Summary and Skills.`, () =>
      setContent((prev) => ({ ...prev, summary: result.content.summary, skills: result.content.skills })),
    );
  };

  /** Tailor lands here from the job picker. */
  const handleTailorJob = async (job: ResumeJob) => {
    const result = await runSuggestion("tailor", () =>
      tailorToJob({ content, jdText: job.description, company: job.company, role: job.role }),
    );
    if (!result) return;

    landAiTool("tailor", `Tailored to ${job.role} at ${job.company} — wove ${quote(result.woven)} in.`, () => {
      // Only the two fields the service actually rewrote, folded onto the
      // content as it is NOW. `tailorToJob` used to be a pure function this
      // screen could simply re-run against `prev`; it is a round trip now, and
      // writing `result.content` back whole would silently discard anything the
      // user typed while it was out. The service asks the model for a narrow
      // diff — a summary and a skills list — precisely so the rest of the
      // document never has to travel, and this is the other half of that deal.
      setContent((prev) => ({ ...prev, summary: result.content.summary, skills: result.content.skills }));
      // Deliberately NOT a check. This used to stamp a job check with a score
      // 13 points up, which reported a measurement nobody had taken. Tailoring
      // changes the text, so any standing check goes stale by itself and the
      // card offers to run it again — which is the only way to know whether
      // the tailor actually moved the number.
    });
  };

  // -------------------------------------------------------------------------
  // The ATS card's own checks — score only, never a content rewrite. A real
  // scan of the document as it stands, through the same scorer the ATS screen
  // uses, so the two surfaces report the same number for the same text.
  // -------------------------------------------------------------------------

  /**
   * Runs one check and puts it on the document it was run for.
   *
   * The document id is captured before the await, not read after it: a check
   * that lands after a switch belongs to the resume it scored. (In practice a
   * switch remounts this component and aborts the stream first; this is what
   * keeps the write correct if that ever stops being true.)
   */
  const runCheck = async (posting: CheckPosting | null) => {
    const docId = activeDocId;
    const putCheck = (check: ResumeCheck) => setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, check } : d)));
    const settled = await checker.run({ content, label: activeDoc.label, job: posting }, putCheck);
    if (settled) putCheck(settled);
  };

  const checkGeneral = () => void runCheck(null);

  const checkAgainstJob = (job: ResumeJob) =>
    void runCheck({ id: job.id, company: job.company, role: job.role, description: job.description });

  /** The same check again — same posting (or none), the text as it is now. */
  const recheck = () => void runCheck(activeDoc.check?.posting ?? null);

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
   * any more, so removing one no longer resets the Tailor tool either.
   */
  const removeCheck = () => {
    setDocuments((prev) => prev.map((d) => (d.id === activeDocId ? { ...d, check: null } : d)));
    checker.clearFailure();
  };

  const useRewriteVariant = (index: number) => {
    const variant = rewriteOptions?.[index];
    if (!variant) return;
    setContent((prev) => ({ ...prev, summary: variant.text }));
    setRewriteOptions(null);
    setAiCaptions((prev) => ({ ...prev, rewrite: `Applied the ${variant.style} take to your Summary.` }));
  };

  const applyQuantifyAt = (index: number) => {
    const suggestion = quantifyList?.[index];
    if (!suggestion || quantifyApplied.has(index)) return;
    setContent((prev) => applyQuantify(prev, suggestion));
    setQuantifyApplied((prev) => new Set(prev).add(index));
  };

  const applyAllQuantify = () => {
    if (!quantifyList) return;
    setContent((prev) => quantifyList.reduce((acc, sg, i) => (quantifyApplied.has(i) ? acc : applyQuantify(acc, sg)), prev));
    setQuantifyApplied(new Set(quantifyList.map((_, i) => i)));
    setAiCaptions((prev) => ({ ...prev, quantify: `All ${quantifyList.length} bullets now carry a number.` }));
  };

  const acceptSummarySuggestion = () => {
    if (!suggestions) return;
    const { text } = suggestions.summary;
    setContent((prev) => ({ ...prev, summary: text }));
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
      if (skillsIdx !== -1 && experienceIdx !== -1 && skillsIdx > experienceIdx) {
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
    // Nothing is behind this box yet — no route takes a free-form rewrite
    // instruction. It used to say a credit had been spent and the rewrite
    // would be applied, and neither was true.
    setAskStatus(`Noted: "${askInput.trim()}". Free-form rewrites aren't available yet — the AI Tools tab has the ones that are.`);
    setAskInput("");
    window.setTimeout(() => setAskStatus(null), 4000);
  };

  return (
    <div className={cn("min-h-screen bg-[#f6f6f6]", ALL_FONT_VARS)}>
      {/* Header */}
      <header className="sticky top-0 z-20 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center h-full">
          <button
            type="button"
            onClick={backToLanding}
            aria-label="Back to all resumes"
            className="mr-2 grid h-8 w-8 flex-none place-content-center rounded-full border border-black/15 bg-white text-black/60 transition-colors hover:border-[#222325] hover:text-primary cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
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
              )}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 flex-none">
          <DocumentSwitcher documents={documents} activeDocId={activeDocId} onSwitch={switchTo} />
          <StickerButton type="button" variant="outline" size="md" onClick={() => setNewResumeOpen(true)}>
            <Plus className="h-4 w-4" />
            New resume
          </StickerButton>
          <StickerButton type="button" variant="primary" size="md" onClick={() => setDownloadOpen(true)}>
            <Download className="h-4 w-4" />
            Download
          </StickerButton>
        </div>
      </header>

      <main className="px-6 py-7 pb-14 max-w-[1540px] mx-auto">
        <div className={cn("grid gap-4 items-start", GRID_COLS_CLASS(sidebarCollapsed)[docTab])}>
          {/* LEFT SIDEBAR — Overview has none; its old "N pages · N roles ·
              last edited" line moved to a small caption above the preview
              (below), shown on every tab instead of parked in a rail only
              Overview ever showed. */}
          {docTab !== "overview" && (
            <aside className="sticky top-[88px] max-h-[calc(100vh-112px)] overflow-y-auto overflow-x-hidden scrollbar-neo">
              <div className="rounded-xl border-2 border-[#222325] bg-white p-1.5">
                {docTab === "content" && (
                  <ContentForm
                    content={content}
                    setContent={setContent}
                    suggestionReason={suggestions?.summary.reason ?? null}
                    summarySuggestion={summarySuggestion}
                    onAcceptSummarySuggestion={acceptSummarySuggestion}
                    onDismissSummarySuggestion={dismissSummarySuggestion}
                  />
                )}

                {docTab === "customize" && <CustomizeNav activeItem={activeCustomizeItem} onSelect={scrollToSetting} />}

                {docTab === "ai" && (
                  <AiToolsList
                    aiRunning={aiRunning}
                    aiDone={aiDone}
                    captions={aiCaptions}
                    onRun={runAiTool}
                    rewriteVariants={rewriteOptions}
                    onUseRewrite={useRewriteVariant}
                    quantify={quantifyList}
                    quantifyApplied={quantifyApplied}
                    onApplyQuantify={applyQuantifyAt}
                    onApplyAllQuantify={applyAllQuantify}
                  />
                )}
              </div>
            </aside>
          )}

          {/* CENTER — resume document preview, identical across every tab */}
          <section className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3 px-1 text-xs text-black/45">
              <p aria-live="polite">
                {pageCount} page{pageCount === 1 ? "" : "s"} · {content.experience.length} role{content.experience.length === 1 ? "" : "s"} ·{" "}
                {autosave.status.kind === "saved" && (
                  <>
                    saved · last edited <TimeAgo datetime={autosave.savedAt} opts={{ minInterval: 10 }} />
                  </>
                )}
                {autosave.status.kind === "saving" && "saving…"}
                {/* Two different failures. One that may pass on its own is
                    retried for them, so the copy says that and nothing about
                    why — the upstream's own sentence already says "try again",
                    and it is us doing the trying. A refusal is theirs to fix,
                    so it gets the server's sentence, which names the field. */}
                {autosave.status.kind === "error" && (
                  <span className="font-semibold text-[#b23c26]">
                    {autosave.status.retrying ? (
                      "not saved yet — we'll keep trying. Your changes are safe on this page."
                    ) : (
                      <>
                        not saved — {autosave.status.message}{" "}
                        <button type="button" onClick={autosave.flush} className="cursor-pointer underline decoration-2 underline-offset-2">
                          Try again
                        </button>
                      </>
                    )}
                  </span>
                )}
              </p>

              {/* Zoom — a quiet pill that only comes forward on hover. */}
              <div className="group/zoom flex items-center gap-2 rounded-full border border-black/15 bg-white px-2 py-1 shadow-sm transition-[border-color,box-shadow] duration-100 ease-out hover:border-[#222325] hover:shadow-[1px_1px_0_0_#222325]">
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => setZoom(Math.max(45, zoomPercent - 10))}
                  className={ZOOM_BUTTON_CLASS}>
                  −
                </button>
                <span className="min-w-[48px] text-center text-xs font-semibold tabular-nums text-black/70 transition-colors group-hover/zoom:text-primary">{zoomPercent}%</span>
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => setZoom(Math.min(180, zoomPercent + 10))}
                  className={ZOOM_BUTTON_CLASS}>
                  +
                </button>
                <button type="button" onClick={() => setZoom(100)} className={cn(ZOOM_BUTTON_CLASS, "ml-1 w-auto bg-[#f4f4f0] px-2.5 text-xs font-medium hover:bg-[#e1f073]")}>
                  Fit
                </button>
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
                comment above for why that matters for `PageGuides`.
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
                  <div
                    ref={paperWrapRef}
                    className="relative w-fit overflow-hidden rounded-sm bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.15)]">
                    <ResumePaper design={design} sections={sections} content={content} chrome={design.chrome} />
                    <PageGuides containerRef={paperWrapRef} onPageCountChange={setPageCount} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT RAIL */}
          <aside className="sticky top-[88px]">
            {docTab === "customize" ? (
              <CustomizePanelsRail flashItem={flashCustomizeItem} registerRef={registerCustomizeRef} />
            ) : (
              <AiAssistRail
                isBlank={isBlank}
                hasSuggestions={suggestions !== null}
                check={activeDoc.check}
                stale={checkIsStale}
                checkStatus={checker.status}
                checkFailure={checker.failure}
                onRemoveCheck={removeCheck}
                onCheckGeneral={checkGeneral}
                onCheckAgainstJob={() => void pickJobFor("scan")}
                onRecheck={recheck}
                onDismissCheckFailure={checker.clearFailure}
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

      <DownloadModal open={downloadOpen} onOpenChange={setDownloadOpen} docLabel="resume" fileName={downloadFileName} />
      <NewResumeDialog
        open={newResumeOpen}
        onOpenChange={setNewResumeOpen}
        currentDocLabel={activeDoc.label}
        creating={creatingResume}
        onCreate={(label, mode) => void createNewResume(label, mode)}
      />
    </div>
  );
};

export default ResumeScreenBody;
