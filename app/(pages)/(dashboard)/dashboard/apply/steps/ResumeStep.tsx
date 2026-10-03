"use client";

// Step 2: the resume this application goes out with.
//
// It starts from one resume (the master by default, or one uploaded or picked
// with "Select resume") and keeps ONE working copy for this application (owner,
// 2026-10-03): the tools' proposals are used into that same draft, updated in
// place, instead of filing a new resume every time. The original is never
// touched, and the draft stays out of every resume list until the application
// is tracked, when it is kept as the version that was sent.
//
// The resume marked "Sending this" is what is scored, what the letter is written
// from and what is recorded. It is scored automatically, and again after every
// change (owner's choice: always current, a credit per version; a repeat of the
// same version and posting is served from the scan cache for free). The gaps the
// score finds can be picked, each with what to do about it, and fixed together
// for one credit; the two tools work every gap in at once. They add what is
// asked: a term nothing on the resume backs up comes with advice to be ready to
// back it up in an interview, never a refusal (owner).
//
// One column, top to bottom (owner, 2026-10-03): which resume, the score, the
// tools, then the resume itself, whole, collapsed at the bottom until "Preview"
// or its own header opens it. It stays open until the user closes it.
//
// "Open in resume creator" edits a copy there; coming back to this tab brings
// those edits into the draft as its next version, which is scored like any
// other change, so the preview and the score follow what was edited.
//
// Everything here (the picks, the draft, the score, a proposal that cost a
// credit) lives in the application's session, so a refresh loses none of it.

import { useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Library,
  MoreHorizontal,
  RotateCw,
  Sparkles,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { Bone, LinesSkeleton, Loading, RowsSkeleton } from "@/app/components/dashboard/ui/Skeleton";
import { useDocuments } from "@/app/components/dashboard/documents/DocumentsProvider";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { changeCount, resumeChanges } from "@/app/lib/apply/changes";
import { noteParts, scoreColor, withoutEmDashes } from "@/app/lib/apply/score";
import { sendingResumeId, type ApplyProposal, type ApplyState, type ResumeToolId } from "@/app/lib/apply/state";
import { ATS_BILLING_HREF, SCAN_CREDITS, missingGaps, prepareResumeForDoc, scanTier } from "@/app/lib/ats/api";
import type { IngestedResumeDetail } from "@/app/lib/ats/types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { qk } from "@/app/lib/query/keys";
import { SUGGESTION_CREDITS, injectKeywords, tailorToJob } from "@/app/lib/resume/ai";
import {
  RESUME_ACCEPT,
  createDraftResume,
  createResumeDocument,
  getResumeDocument,
  importResume,
  resumeContentToText,
  saveResumeDocument,
  updateDraftResume,
  type ImportedResume,
} from "@/app/lib/resume/api";
import { useIngestedResumeQuery, useIngestedResumesQuery } from "@/hooks/queries/useAtsQueries";
import { useResumeSuggestion } from "@/hooks/mutations/useResumeSuggestion";
import type { StartedJob } from "../job";
import type { useApplyScan } from "../useApplyScan";
import ChangesPaper from "../parts/ChangesPaper";
import GapPicker from "../parts/GapPicker";
import ResumePreviewDialog, { DownloadButton } from "../parts/ResumePreviewDialog";
import { useResumeDownload } from "../parts/useResumeDownload";
import SelectResumeDialog, { type PickedResume } from "../parts/SelectResumeDialog";

export interface ResumeStepProps {
  job: StartedJob;
  state: ApplyState;
  /** Functional, so an answer that lands after a wait is applied to the state as it is then. */
  update: (recipe: (state: ApplyState) => ApplyState) => void;
  /** False once the application is tracked: nothing here changes, and nothing is scored. */
  editable: boolean;
  scan: ReturnType<typeof useApplyScan>;
}

/** The service's cap on a tool's want-list: every gap the panel shows fits. */
const MAX_TOOL_GAPS = 20;

/** The least time between two reads of the resume creator's copy: focus and visibility both fire on a tab switch. */
const PULL_GAP_MS = 5_000;

const withoutExtension = (name: string) => name.replace(/\.[a-z0-9]{1,5}$/i, "");

/** The draft cache entry the wizard reads (`useIngestedResumeQuery`), from a save's answer. */
const asDetail = (saved: ImportedResume): IngestedResumeDetail => ({
  resumeId: saved.resumeId,
  version: saved.version,
  status: saved.status as IngestedResumeDetail["status"],
  fileName: saved.fileName,
  content: saved.content,
  error: null,
});

const ResumeStep: FC<ResumeStepProps> = ({ job, state, update, editable, scan }) => {
  const queryClient = useQueryClient();
  const { docs, loading: docsLoading } = useDocuments();
  const ingested = useIngestedResumesQuery();
  const tools = useResumeSuggestion();
  const { download, printer } = useResumeDownload();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  const [using, setUsing] = useState(false);
  const [useError, setUseError] = useState<string | null>(null);
  // The popup preview: a proposal not used yet, or either resume from its row's menu.
  const [previewing, setPreviewing] = useState<"proposal" | "draft" | "base" | null>(null);
  const [openingCreator, setOpeningCreator] = useState(false);
  const [paperOpen, setPaperOpen] = useState(false);
  // Where the last tool run was started, so its failure is said there: the gaps' fix button, or the tools card.
  const [toolFrom, setToolFrom] = useState<"gaps" | "tools">("tools");
  const scrollOnOpen = useRef(false);

  const { resume } = state;
  const sendingId = sendingResumeId(resume);
  const sending = useIngestedResumeQuery(sendingId);
  const base = useIngestedResumeQuery(resume.baseId);
  const draft = useIngestedResumeQuery(resume.draftId);
  // What the draft's words were built from, for the preview's marks.
  const draftFrom = useIngestedResumeQuery(resume.draftFromId);

  const content = sending.data?.content ?? null;
  const version = sending.data?.version ?? null;
  const sendingReady = sending.data?.status === "ready";

  // A resume that couldn't be opened (the AI service restarting, say) is said, with a way to try
  // again, rather than left looking like it is still being read (owner, 2026-10-03: "I am stuck").
  const resumeFailed = (sendingId !== null && sending.isError) || (resume.baseId !== null && base.isError) || (resume.draftId !== null && draft.isError);
  function retryResumes() {
    if (sendingId && sending.isError) void sending.refetch();
    if (resume.baseId && base.isError) void base.refetch();
    if (resume.draftId && draft.isError) void draft.refetch();
  }

  // ---- The default: the master resume, else the newest one that was read ----------------------
  const masterImport = useRef(false);
  useEffect(() => {
    // Both lists first: deciding before My documents is in would skip the master.
    if (!editable || resume.baseId || !ingested.data || docsLoading) return;
    const ready = ingested.data.filter((row) => row.status === "ready");
    const master = docs.find((doc) => doc.kind === "resume" && doc.master && !doc.archived);
    const masterName = master ? (master.ext ? `${master.name}.${master.ext}` : master.name) : null;
    const linked = master?.aiResumeId ? ready.find((row) => row.resumeId === master.aiResumeId) : undefined;
    if (master && linked && masterName) {
      update((s) => (s.resume.baseId ? s : { ...s, resume: { ...s.resume, baseId: linked.resumeId, baseName: masterName } }));
      return;
    }
    if (master && masterName && !masterImport.current) {
      // The master was never read for scoring: read it now (free, and remembered on the file).
      masterImport.current = true;
      void prepareResumeForDoc(master.id)
        .then((prepared) =>
          update((s) => (s.resume.baseId ? s : { ...s, resume: { ...s.resume, baseId: prepared.resumeId, baseName: masterName } })),
        )
        .catch(() => {
          const newest = ready[0];
          if (newest)
            update((s) => (s.resume.baseId ? s : { ...s, resume: { ...s.resume, baseId: newest.resumeId, baseName: newest.fileName } }));
        });
      return;
    }
    if (!master && ready[0]) {
      const newest = ready[0];
      update((s) => (s.resume.baseId ? s : { ...s, resume: { ...s.resume, baseId: newest.resumeId, baseName: newest.fileName } }));
    }
  }, [editable, resume.baseId, ingested.data, docs, docsLoading, update]);

  // ---- The score: automatic, and again after every change ---------------------------------------
  const stored = state.scan && state.scan.resumeId === sendingId && state.scan.version === version ? state.scan : null;
  const live = scan.resumeId !== null && scan.resumeId === sendingId ? scan : null;
  const report = live?.report ?? stored?.report ?? null;
  const scoring = live?.status === "scoring";
  const scoreKey = sendingId && version !== null ? `${sendingId}:${version}` : null;
  const triedKey = useRef<string | null>(null);

  const { run: runScan } = scan;
  const runScore = useCallback(
    (resumeId: string, scoredVersion: number) => {
      void runScan({ resumeId, jdText: job.description, jobId: job.savedJobId }).then((finished) => {
        if (!finished) return;
        update((s) => {
          // Measured against the last version scored; a re-run of the same version keeps what it was measured against.
          const same = s.scan?.resumeId === resumeId && s.scan.version === scoredVersion;
          const previousScore = same ? (s.scan?.previousScore ?? null) : (s.scan?.report.score ?? null);
          return { ...s, scan: { resumeId, version: scoredVersion, report: finished, previousScore } };
        });
      });
    },
    [runScan, job.description, job.savedJobId, update],
  );

  // Once per resume version: a version already scored (here or before a refresh) is shown, not re-run.
  useEffect(() => {
    if (!editable || !scoreKey || !sendingId || version === null || !sendingReady || stored) return;
    if (triedKey.current === scoreKey) return;
    triedKey.current = scoreKey;
    runScore(sendingId, version);
  }, [editable, scoreKey, sendingId, version, sendingReady, stored, runScore]);

  // How much the latest change moved the score: what makes progress visible from one version to the next.
  const scoreChange = stored && stored.previousScore !== null ? Math.round(stored.report.score) - Math.round(stored.previousScore) : null;

  const gaps = report ? missingGaps(report) : [];
  const verdictById = new Map((report?.verdicts ?? []).map((verdict) => [verdict.requirement.id, verdict]));

  // ---- The resume, whole, at the bottom ---------------------------------------------------------
  const sendingDraft = resume.sendDraft && resume.draftId !== null && sendingId === resume.draftId;
  const draftContent = draft.data?.content ?? null;
  const draftBase = draftFrom.data?.content ?? base.data?.content ?? null;
  // Sending the draft: what tailoring changed is marked (once what it was made from is in). Sending the original: nothing is.
  const paperBefore = sendingDraft && draftBase ? draftBase : content;
  const paperChanges = useMemo(
    () => (content && paperBefore ? changeCount(resumeChanges(paperBefore, content)) : 0),
    [content, paperBefore],
  );

  /** "Preview": opens the resume at the bottom and takes the page there (`scroll-mt-40` clears the wizard's 128px sticky header). */
  function showPaper() {
    if (paperOpen) {
      paperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    scrollOnOpen.current = true;
    setPaperOpen(true);
  }

  useEffect(() => {
    if (!paperOpen || !scrollOnOpen.current) return;
    scrollOnOpen.current = false;
    paperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [paperOpen]);

  // ---- Edits made in the resume creator come back -----------------------------------------------
  // Without this the creator's copy drifted from the draft, and neither the preview nor the score
  // ever saw those edits (owner, 2026-10-03). Read when this tab is shown again, and once on load.
  const pulling = useRef(false);
  const lastPull = useRef(0);
  useEffect(() => {
    const docId = resume.creatorDocId;
    const draftId = resume.draftId;
    if (!editable || !docId || !draftId) return;
    async function pull() {
      if (document.visibilityState !== "visible" || pulling.current || !docId || !draftId) return;
      if (Date.now() - lastPull.current < PULL_GAP_MS) return;
      lastPull.current = Date.now();
      pulling.current = true;
      try {
        const copy = await getResumeDocument(docId);
        const current = queryClient.getQueryData<IngestedResumeDetail>(qk.ats.resume(draftId))?.content;
        if (!current || resumeContentToText(copy.content) === resumeContentToText(current)) return;
        const saved = await updateDraftResume(draftId, copy.content);
        queryClient.setQueryData(qk.ats.resume(saved.resumeId), asDetail(saved));
        // Edited for this application, so it is what goes out.
        update((s) => ({ ...s, proposal: null, resume: { ...s.resume, sendDraft: true } }));
        toast.success("Brought in your edits from the resume creator.");
      } catch (error) {
        // The copy is gone: the next "Open in resume creator" makes a new one.
        if (error instanceof BackendError && error.status === 404) update((s) => ({ ...s, resume: { ...s.resume, creatorDocId: null } }));
      } finally {
        pulling.current = false;
      }
    }
    void pull();
    const onShow = () => void pull();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [editable, resume.creatorDocId, resume.draftId, queryClient, update]);

  // ---- Picking the base ----------------------------------------------------------------------
  function setBase(picked: PickedResume) {
    update((s) => ({ ...s, proposal: null, resume: { ...s.resume, baseId: picked.resumeId, baseName: picked.name, sendDraft: false } }));
  }

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const imported = await importResume(file);
      await queryClient.invalidateQueries({ queryKey: qk.ats.ingested() });
      setBase({ resumeId: imported.resumeId, name: imported.fileName });
    } catch (error) {
      setUploadError(apiMessage(error));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ---- The tools -------------------------------------------------------------------------------
  /** Runs a tool against the resume being sent; true once its proposal is in. */
  async function runTool(tool: ResumeToolId, only?: string[]): Promise<boolean> {
    if (!sendingId || !content) return false;
    setToolFrom(only ? "gaps" : "tools");
    // Started from the gaps above: the tools card, where the result takes shape, comes into view.
    if (only) requestAnimationFrame(() => toolsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    const forResumeId = sendingId;
    const wanted = only ?? gaps.map((gap) => gap.label).slice(0, MAX_TOOL_GAPS);
    const input = { content, jdText: job.description, company: job.company, role: job.role, keywords: wanted.length > 0 ? wanted : null };
    // A gap the score found a close line for isn't "unbacked", whatever the tool's own check says:
    // the steps above showed that line, and the two must agree.
    const closeOnResume = new Set(
      gaps
        .filter((gap) => {
          const verdict = verdictById.get(gap.id);
          return verdict?.state === "partial" && verdict.evidence.length > 0;
        })
        .map((gap) => gap.label),
    );
    setUseError(null);
    let proposal: ApplyProposal | null = null;
    if (tool === "tailor") {
      const result = await tools.run("tailor", () => tailorToJob(input));
      if (result) proposal = { tool, forResumeId, content: result.content, terms: result.woven, unbacked: [] };
    } else {
      const result = await tools.run("keywords", () => injectKeywords(input));
      if (result) {
        const unbacked = result.unbacked.filter((term) => !closeOnResume.has(term));
        proposal = { tool, forResumeId, content: result.content, terms: result.added, unbacked };
      }
    }
    if (!proposal) return false;
    const made = proposal;
    update((s) => ({ ...s, proposal: made }));
    // A fix started from the gaps above lands in the tools card: bring it into view.
    requestAnimationFrame(() => toolsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    return true;
  }

  const proposal = state.proposal && state.proposal.forResumeId === sendingId ? state.proposal : null;
  const draftLabel = `${withoutExtension(resume.baseName ?? "Resume")} for ${job.company}`;

  /** "Use this version": into the application's one draft, made the first time and updated in place after. */
  async function adoptProposal() {
    if (!proposal || using) return;
    setUsing(true);
    setUseError(null);
    try {
      let saved: ImportedResume;
      try {
        saved = resume.draftId
          ? await updateDraftResume(resume.draftId, proposal.content, draftLabel)
          : await createDraftResume(proposal.content, draftLabel);
      } catch (error) {
        // The draft is gone (removed elsewhere): start a new one rather than fail.
        if (!(resume.draftId && error instanceof BackendError && error.status === 404)) throw error;
        saved = await createDraftResume(proposal.content, draftLabel);
      }
      queryClient.setQueryData(qk.ats.resume(saved.resumeId), asDetail(saved));
      update((s) => ({
        ...s,
        proposal: null,
        resume: { ...s.resume, draftId: saved.resumeId, draftName: saved.fileName, draftFromId: s.resume.baseId, sendDraft: true },
      }));
    } catch (error) {
      // A provider timing out on the way ("Voyage embed timed out…") is ours to retry, not the user's to read.
      setUseError(
        error instanceof BackendError && error.status >= 500
          ? "That version couldn't be saved just now. Try again in a moment."
          : apiMessage(error),
      );
    } finally {
      setUsing(false);
    }
  }

  /**
   * "Open in resume creator": a copy there, in a new tab, made once and refreshed with the draft's
   * words on every later open, so opening it again never adds another resume.
   */
  async function openInCreator(words: ResumeContent, label: string) {
    // Opened inside the click: a tab opened after an await is a popup a blocker may refuse.
    const tab = window.open("", "_blank");
    setOpeningCreator(true);
    try {
      let docId = resume.creatorDocId;
      if (docId) {
        try {
          await saveResumeDocument(docId, { content: words, label });
        } catch (error) {
          if (!(error instanceof BackendError && error.status === 404)) throw error;
          docId = null;
        }
      }
      if (!docId) {
        const made = await createResumeDocument({ label, content: words });
        docId = made.id;
        const id = made.id;
        update((s) => ({ ...s, resume: { ...s.resume, creatorDocId: id } }));
      }
      const href = `/dashboard/resume?doc=${encodeURIComponent(docId)}`;
      if (tab) tab.location.href = href;
      else window.open(href, "_blank");
    } catch (error) {
      tab?.close();
      toast.error(apiMessage(error));
    } finally {
      setOpeningCreator(false);
    }
  }

  const canTailor = Boolean(job.description);
  const canKeywords = Boolean(job.description) || gaps.length > 0;
  const fromOtherBase = Boolean(resume.draftId && resume.draftFromId && resume.draftFromId !== resume.baseId);
  const toolsIdle = editable && Boolean(content) && tools.running === null;
  const sendingName = sendingDraft ? (resume.draftName ?? draftLabel) : (resume.baseName ?? base.data?.fileName ?? "Your resume");

  // The two buttons say what they do; a line under them only when one can't run (owner, 2026-10-03: "it's just two buttons").
  const toolsBlocked = !sendingId
    ? "Pick a resume first."
    : !content
      ? sending.isError
        ? "The resume couldn't be opened just now. Try again above."
        : sending.isPending
          ? null
          : "It can be worked on once it has been read."
      : !canTailor
        ? "Tailoring needs the job's description."
        : null;
  const draftName = resume.draftName ?? draftLabel;
  const baseName = resume.baseName ?? base.data?.fileName ?? "Your resume";

  return (
    <div className="flex flex-col gap-5">
      {/* Which resume */}
      <DashCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-primary">Which resume goes with it?</p>
            <p className="mt-0.5 text-sm text-black/55">
              The one marked “Sending this” is what&apos;s scored, what the letter is written from, and what&apos;s recorded.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StickerButton variant="outline" size="sm" disabled={!editable || uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Upload
            </StickerButton>
            <StickerButton variant="outline" size="sm" disabled={!editable} onClick={() => setSelectOpen(true)}>
              <Library className="h-3.5 w-3.5" />
              Select resume
            </StickerButton>
            <input
              ref={fileRef}
              type="file"
              accept={RESUME_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </div>
        </div>

        {uploadError && <p className="mt-3 text-sm text-[#b23c26]">{uploadError}</p>}

        <div className="mt-4 flex flex-col gap-2">
          {uploading && (
            <Loading label="Reading your upload">
              <RowsSkeleton rows={1} />
            </Loading>
          )}
          {using && !resume.draftId && (
            <Loading label="Saving this version">
              <RowsSkeleton rows={1} />
            </Loading>
          )}
          {!resume.baseId ? (
            ingested.isPending ? (
              <Loading label="Finding your resume">
                <RowsSkeleton rows={1} />
              </Loading>
            ) : (
              !uploading && (
                <p className="text-sm leading-relaxed text-black/55">
                  No resume picked yet. Upload one (PDF, DOCX, TXT or MD) or select one you already have.
                </p>
              )
            )
          ) : (
            <>
              {resume.draftId && (
                <ResumeRow
                  icon={<Sparkles className="h-4 w-4 flex-none text-[#6c7a1e]" aria-hidden />}
                  name={resume.draftName ?? `Tailored for ${job.company}`}
                  meta={
                    draft.isPending ? (
                      <Bone className="mt-1 h-2.5 w-40" />
                    ) : draft.isError ? (
                      "Couldn't open it just now"
                    ) : (
                      [
                        "Draft for this application",
                        draft.data ? `version ${draft.data.version}` : null,
                        fromOtherBase ? "made from an earlier pick" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    )
                  }
                  selected={resume.sendDraft}
                  disabled={!editable}
                  onSelect={() => update((s) => ({ ...s, resume: { ...s.resume, sendDraft: true } }))}
                  menu={
                    draftContent
                      ? [
                          {
                            id: "creator",
                            label: "Open in resume creator",
                            icon: ExternalLink,
                            busy: openingCreator,
                            onSelect: () => void openInCreator(draftContent, draftName),
                          },
                          { id: "preview", label: "Preview", icon: Eye, onSelect: () => setPreviewing("draft") },
                          { id: "pdf", label: "Download as PDF", icon: Download, onSelect: () => download(draftContent, draftName, "pdf") },
                          { id: "docx", label: "Download as DOCX", icon: Download, onSelect: () => download(draftContent, draftName, "docx") },
                        ]
                      : undefined
                  }
                />
              )}
              <ResumeRow
                icon={<FileText className="h-4 w-4 flex-none text-black/40" aria-hidden />}
                name={resume.baseName ?? base.data?.fileName ?? "Your resume"}
                meta={
                  base.isPending || base.data?.status === "pending" ? (
                    <Bone className="mt-1 h-2.5 w-40" />
                  ) : base.isError ? (
                    "Couldn't open it just now"
                  ) : base.data?.status === "failed" ? (
                    (base.data.error ?? "Couldn't be read")
                  ) : resume.draftId ? (
                    "The original, kept as it is"
                  ) : (
                    "Your resume, as it is"
                  )
                }
                selected={!resume.sendDraft}
                // Pickable unless it is known not to be readable: one still loading, or that failed to load, can still be chosen.
                disabled={!editable || (base.data !== undefined && base.data.status !== "ready")}
                onSelect={() => update((s) => ({ ...s, resume: { ...s.resume, sendDraft: false } }))}
                menu={
                  base.data?.content
                    ? [
                        { id: "preview", label: "Preview", icon: Eye, onSelect: () => setPreviewing("base") },
                        { id: "pdf", label: "Download as PDF", icon: Download, onSelect: () => base.data?.content && download(base.data.content, baseName, "pdf") },
                        {
                          id: "docx",
                          label: "Download as DOCX",
                          icon: Download,
                          onSelect: () => base.data?.content && download(base.data.content, baseName, "docx"),
                        },
                      ]
                    : undefined
                }
              />
            </>
          )}
          {resumeFailed && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-[#b23c26]/20 bg-[#fdf4f2] px-3.5 py-2.5">
              <p className="min-w-0 flex-1 text-sm text-[#b23c26]">Your resume couldn&apos;t be opened just now.</p>
              <StickerButton variant="outline" size="sm" onClick={retryResumes}>
                <RotateCw className="h-3.5 w-3.5" />
                Try again
              </StickerButton>
            </div>
          )}
        </div>
      </DashCard>

      {/* The score */}
      <DashCard className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-primary">ATS score</p>
            <p className="mt-0.5 text-sm text-black/55">
              {job.description
                ? "How well the resume you're sending matches this posting."
                : "No description on file, so this is a general score."}{" "}
              Scored again after every change, {SCAN_CREDITS} credit a version.
            </p>
          </div>
          <StickerButton variant="outline" size="sm" disabled={!content} onClick={showPaper}>
            <Eye className="h-3.5 w-3.5" />
            Preview resume
          </StickerButton>
        </div>

        {!sendingId ? (
          <p className="text-[15px] text-black/60">Pick or upload a resume. It&apos;s scored as soon as there is one.</p>
        ) : scoring ? (
          <Loading label={state.scan ? "Scoring your latest version" : "Scoring against the posting"}>
            <ScoreSkeleton />
          </Loading>
        ) : report ? (
          <>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
              <ScoreRing value={report.score} size={128} fillColor={scoreColor(report.score)} />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Pill variant={scanTier(report.score).tone}>{scanTier(report.score).label}</Pill>
                  {scoreChange !== null && <ScoreChange delta={scoreChange} />}
                </div>
                {live?.status === "explaining" && (
                  <Loading label="Writing up why" className="w-full max-w-xl">
                    <LinesSkeleton lines={2} />
                  </Loading>
                )}
                {report.explanation && <p className="text-[15px] leading-relaxed text-black/75">{withoutEmDashes(report.explanation)}</p>}
                {report.degraded && (
                  <ScoringNote text={report.degradedReason ?? "Scored on a reduced path, so treat it as a rough read."} />
                )}
              </div>
            </div>
            {gaps.length > 0 && (
              <div className="border-t border-black/8 pt-5">
                <GapPicker
                  gaps={gaps}
                  verdictById={verdictById}
                  fixing={tools.running === "keywords"}
                  onFix={toolsIdle ? (labels) => runTool("keywords", labels) : undefined}
                  fixError={toolFrom === "gaps" ? (tools.failure?.message ?? null) : null}
                />
              </div>
            )}
          </>
        ) : live?.failure ? (
          <div className="flex flex-col gap-2.5" role="alert">
            <p className="text-[15px] text-[#b23c26]">{withoutEmDashes(live.failure.message)}</p>
            <div className="flex flex-wrap gap-2">
              {live.failure.retryable && version !== null && (
                <StickerButton variant="outline" size="sm" onClick={() => runScore(sendingId, version)}>
                  <RotateCw className="h-3.5 w-3.5" />
                  Try again
                </StickerButton>
              )}
              {live.failure.kind === "credits" && (
                <Link href={ATS_BILLING_HREF} target="_blank" rel="noopener noreferrer">
                  <StickerButton variant="primary" size="sm">
                    Top up credits
                  </StickerButton>
                </Link>
              )}
            </div>
          </div>
        ) : sending.isPending ? (
          <Loading label="Opening the resume">
            <ScoreSkeleton />
          </Loading>
        ) : sending.isError ? (
          <div className="flex flex-col items-start gap-2.5" role="alert">
            <p className="text-[15px] text-[#b23c26]">The resume couldn&apos;t be opened just now, so it hasn&apos;t been scored.</p>
            <StickerButton variant="outline" size="sm" onClick={retryResumes}>
              <RotateCw className="h-3.5 w-3.5" />
              Try again
            </StickerButton>
          </div>
        ) : sending.data?.status === "pending" ? (
          <Loading label="Reading the resume">
            <ScoreSkeleton />
          </Loading>
        ) : !sendingReady ? (
          <p className="text-[15px] text-black/60">{sending.data?.error ?? "This resume couldn't be read, so it can't be scored. Upload or select another."}</p>
        ) : (
          <Loading label="Getting ready to score">
            <ScoreSkeleton />
          </Loading>
        )}
      </DashCard>

      {/* The tools: two small buttons, no card or title around them (owner, 2026-10-03). A card appears only for
          what they make: a result taking shape, and the proposal to add or discard. */}
      <div ref={toolsRef} className="flex scroll-mt-40 flex-col gap-3">
        {proposal ? (
          <DashCard className="p-6">
            <ProposalPanel
              proposal={proposal}
              original={content}
              using={using}
              error={useError}
              onUse={() => void adoptProposal()}
              onPreview={() => setPreviewing("proposal")}
              onDiscard={() => update((s) => ({ ...s, proposal: null }))}
            />
          </DashCard>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <ToolButton
                label="Tailor summary & skills"
                hint={`Rewrites your summary toward this posting and adds the skills it asks for. ${SUGGESTION_CREDITS} credit.`}
                disabled={!toolsIdle || !canTailor}
                onClick={() => void runTool("tailor")}
              />
              <ToolButton
                label="Work in missing keywords"
                hint={`Works every gap the score found into your summary, skills and bullets. ${SUGGESTION_CREDITS} credit.`}
                disabled={!toolsIdle || !canKeywords}
                onClick={() => void runTool("keywords")}
              />
            </div>
            {tools.running ? (
              <DashCard className="p-6">
                <Loading label={tools.running === "tailor" ? "Tailoring your resume" : "Working the gaps in"}>
                  <ProposalSkeleton />
                </Loading>
              </DashCard>
            ) : sendingId && !content && sending.isPending ? (
              <Loading label="Opening the resume">
                <LinesSkeleton lines={1} className="max-w-md" />
              </Loading>
            ) : (
              toolsBlocked && <p className="text-sm leading-relaxed text-black/55">{toolsBlocked}</p>
            )}
            {toolFrom === "tools" && tools.failure && !tools.running && (
              <p role="alert" className="text-sm text-[#b23c26]">
                {tools.failure.message}
              </p>
            )}
            {tools.failure?.needsCredits && (
              <Link
                href={ATS_BILLING_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-primary underline underline-offset-2">
                Top up credits
              </Link>
            )}
          </>
        )}
      </div>

      {/* The resume, whole: collapsed until "Preview" or its header opens it */}
      {sendingId && (
        <div ref={paperRef} className="scroll-mt-40">
          <DashCard className="overflow-hidden p-0">
            <button
              type="button"
              aria-expanded={paperOpen}
              onClick={() => setPaperOpen((open) => !open)}
              className="flex w-full cursor-pointer items-center gap-3 px-6 py-5 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-primary">The resume you&apos;re sending</span>
                <span className="block truncate text-sm text-black/55">
                  {sendingName}
                  {sendingDraft ? ` · ${paperChanges} change${paperChanges === 1 ? "" : "s"} for this job` : " · as it is"}
                </span>
              </span>
              <span className="flex-none text-xs font-bold text-primary">{paperOpen ? "Hide" : "Show"}</span>
              <ChevronDown className={cn("h-5 w-5 flex-none text-primary transition-transform", paperOpen && "rotate-180")} aria-hidden />
            </button>

            {paperOpen && (
              <div className="border-t border-black/8 bg-[#f0f0ea] px-4 py-5 sm:px-8 sm:py-7">
                {sending.isPending || sending.data?.status === "pending" ? (
                  <Loading label="Opening the resume">
                    <PaperSkeleton />
                  </Loading>
                ) : !content ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-black/60">
                      {sending.isError ? "The resume couldn't be opened just now." : (sending.data?.error ?? "This resume couldn't be read.")}
                    </p>
                    {sending.isError && (
                      <StickerButton variant="outline" size="sm" onClick={retryResumes}>
                        <RotateCw className="h-3.5 w-3.5" />
                        Try again
                      </StickerButton>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      {sendingDraft ? (
                        <p className="text-sm text-black/65">
                          {paperChanges > 0 ? (
                            <>
                              What changed for this job is{" "}
                              <span className="bg-[#eef7b8] underline decoration-[#9aab1f] decoration-2 underline-offset-2">
                                highlighted
                              </span>
                              .
                            </>
                          ) : (
                            "Nothing here differs from the original yet."
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-black/65">Your resume, as it is.</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <DownloadButton onDownload={(format) => download(content, sendingName, format)} />
                        {sendingDraft && draftContent && (
                          <StickerButton variant="outline" size="sm" disabled={openingCreator} onClick={() => void openInCreator(draftContent, draftName)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open in resume creator
                          </StickerButton>
                        )}
                      </div>
                    </div>
                    <ChangesPaper content={content} before={paperBefore} />
                  </>
                )}
              </div>
            )}
          </DashCard>
        </div>
      )}

      <SelectResumeDialog open={selectOpen} onOpenChange={setSelectOpen} onPicked={setBase} />

      {previewing === "proposal" && proposal && (
        <ResumePreviewDialog
          open
          onOpenChange={(open) => !open && setPreviewing(null)}
          title={proposal.tool === "tailor" ? "Tailored version, not used yet" : "Keywords worked in, not used yet"}
          content={proposal.content}
          before={content}
        />
      )}
      {previewing === "draft" && draftContent && (
        <ResumePreviewDialog
          open
          onOpenChange={(open) => !open && setPreviewing(null)}
          title={resume.draftName ?? draftLabel}
          content={draftContent}
          // What it was made from, once that is in; until then nothing is marked rather than everything.
          before={draftBase ?? draftContent}
          onOpenInCreator={() => void openInCreator(draftContent, draftName)}
          openingInCreator={openingCreator}
          onDownload={(format) => download(draftContent, draftName, format)}
        />
      )}
      {previewing === "base" && base.data?.content && (
        <ResumePreviewDialog
          open
          onOpenChange={(open) => !open && setPreviewing(null)}
          title={resume.baseName ?? base.data.fileName}
          content={base.data.content}
          before={base.data.content}
          onDownload={(format) => base.data?.content && download(base.data.content, baseName, format)}
        />
      )}
      {printer}
    </div>
  );
};

/**
 * One of the two tools: a small button, no icon, with a lime-green edge at rest and ink on hover so it
 * reads apart from the score card above (owner, 2026-10-03). What it does and costs is its tooltip,
 * not text around it.
 */
const ToolButton: FC<{ label: string; hint: string; disabled: boolean; onClick: () => void }> = ({ label, hint, disabled, onClick }) => (
  <button
    type="button"
    title={hint}
    disabled={disabled}
    onClick={onClick}
    className="br-plain-press br-lime inline-flex h-9 cursor-pointer items-center rounded-lg border-2 border-[#c9d65a] bg-[#f8fbe8] px-3.5 text-sm font-bold whitespace-nowrap text-primary transition-colors hover:border-[#222325] hover:bg-[#222325] hover:text-white disabled:pointer-events-none disabled:opacity-45">
    {label}
  </button>
);

/** The score card's shape while a score is on its way: the ring, the tier and a few lines. */
const ScoreSkeleton: FC = () => (
  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
    <Bone className="h-32 w-32 flex-none rounded-full" />
    <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
      <Bone className="h-7 w-28 rounded-full" />
      <LinesSkeleton lines={3} className="max-w-xl" />
    </div>
  </div>
);

/** A tool's proposal while it is written: the terms, the change line and the new summary. */
const ProposalSkeleton: FC = () => (
  <div className="flex flex-col gap-3.5">
    <div className="flex flex-wrap gap-1.5">
      {["w-24", "w-36", "w-20"].map((width) => (
        <Bone key={width} className={cn("h-7 rounded-full", width)} />
      ))}
    </div>
    <Bone className="h-3 w-56" />
    <div className="rounded-xl border border-black/8 p-4">
      <LinesSkeleton lines={3} />
    </div>
  </div>
);

/** A page of resume while it opens: a name, then a few sections. */
const PaperSkeleton: FC = () => (
  <div className="mx-auto flex w-full max-w-[816px] flex-col gap-7 bg-white p-8 sm:p-10">
    <div className="flex flex-col gap-2">
      <Bone className="h-6 w-1/3" />
      <Bone className="h-3 w-1/4" />
    </div>
    {[0, 1, 2].map((section) => (
      <div key={section} className="flex flex-col gap-2.5">
        <Bone className="h-3 w-28" />
        <LinesSkeleton lines={3} />
      </div>
    ))}
  </div>
);

/** How much the latest change moved the score. */
const ScoreChange: FC<{ delta: number }> = ({ delta }) => (
  <span className={cn("text-sm font-semibold", delta > 0 ? "text-[#3d7a1f]" : delta < 0 ? "text-[#b23c26]" : "text-black/50")}>
    {delta > 0 ? `Up ${delta}` : delta < 0 ? `Down ${-delta}` : "No change"} since your last version
  </span>
);

/** A note on how the score was reached, with the count in its "9 of 14" underlined (owner, 2026-10-03). */
const ScoringNote: FC<{ text: string }> = ({ text }) => {
  const clean = withoutEmDashes(text).trim();
  const sentence = (/[.!?]$/.test(clean) ? clean : `${clean}.`).replace(/^./, (first) => first.toUpperCase());
  return (
    <p className="text-[15px] leading-relaxed text-black/70">
      {noteParts(sentence).map((part, index) =>
        part.kind === "count" ? (
          <span key={index} className="text-primary underline decoration-2 underline-offset-4">
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
};

interface RowMenuEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  busy?: boolean;
}

const MENU_ITEM =
  "flex w-full cursor-pointer items-center gap-2.5 border-b border-black/8 px-3.5 py-2.5 text-left text-xs font-semibold text-primary transition-colors last:border-b-0 hover:bg-[#fbfbf7] disabled:cursor-wait disabled:opacity-60";

/** A resume row's ⋯ menu, beside "Sending this": the same menu as a row in My documents. */
const RowMenu: FC<{ name: string; entries: RowMenuEntry[] }> = ({ name, entries }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`More for ${name}`}
          className={cn(
            "grid h-8 w-8 flex-none cursor-pointer place-content-center rounded-lg text-black/50 transition-colors hover:bg-black/[0.05] hover:text-primary",
            open && "bg-black/[0.05] text-primary",
          )}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4} className="br-bold w-56 overflow-hidden rounded-xl border-2 border-black bg-white p-0">
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            disabled={entry.busy}
            onClick={() => {
              // Called inside the click: "Open in resume creator" opens its tab before anything is awaited.
              entry.onSelect();
              setOpen(false);
            }}
            className={MENU_ITEM}>
            <entry.icon className="h-3.5 w-3.5 flex-none text-black/55" aria-hidden />
            {entry.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

const ResumeRow: FC<{
  icon: ReactNode;
  name: string;
  meta: ReactNode;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  menu?: RowMenuEntry[];
}> = ({ icon, name, meta, selected, disabled, onSelect, menu }) => (
  <div
    className={cn(
      "flex items-center rounded-md border pr-1.5 transition-colors",
      selected ? "border-[#222325] bg-[#f6faea]" : "border-black/12",
    )}>
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-3 rounded-md px-3.5 py-3 text-left",
        disabled ? "cursor-default" : "cursor-pointer",
        !selected && !disabled && "hover:bg-[#f6f6f6]",
      )}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-primary">{name}</span>
        <span className="block truncate text-[13px] text-black/50">{meta}</span>
      </span>
      {selected ? (
        <Pill variant="positive">Sending this</Pill>
      ) : (
        !disabled && <span className="flex-none text-xs font-semibold text-black/45">Send this</span>
      )}
    </button>
    {menu && menu.length > 0 && <RowMenu name={name} entries={menu} />}
  </div>
);

const ProposalPanel: FC<{
  proposal: ApplyProposal;
  original: ResumeContent | null;
  using: boolean;
  error: string | null;
  onUse: () => void;
  onPreview: () => void;
  onDiscard: () => void;
}> = ({ proposal, original, using, error, onUse, onPreview, onDiscard }) => {
  const changes = resumeChanges(original, proposal.content);
  const nothing = changeCount(changes) === 0;

  return (
    // Saving the version: the panel holds still and pulses until the draft is in.
    <div className={cn("flex flex-col gap-3.5", using && "animate-pulse")} aria-busy={using}>
      {nothing ? (
        <p className="text-[15px] text-black/65">Nothing to change. Your resume already says all of this.</p>
      ) : (
        <>
          {proposal.terms.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-black/45">Worked in</p>
              <div className="flex flex-wrap gap-1.5">
                {proposal.terms.map((term) => (
                  <Pill key={term} variant="positive">
                    {term}
                  </Pill>
                ))}
              </div>
            </div>
          )}
          <p className="text-sm leading-relaxed text-black/65">
            {[
              changes.summary.length > 0 ? "a new summary" : null,
              changes.bullets.length > 0 ? `${changes.bullets.length} bullet${changes.bullets.length === 1 ? "" : "s"} reworded` : null,
              changes.skills.length > 0 ? `${changes.skills.length} skill${changes.skills.length === 1 ? "" : "s"} added` : null,
            ]
              .filter(Boolean)
              .join(", ")
              .replace(/^./, (first) => first.toUpperCase())}
            .
          </p>
          {changes.summary.length > 0 && (
            <div className="rounded-xl bg-[#f6faea] p-4">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-black/45">New summary</p>
              <p className="text-sm leading-relaxed text-black/75">{proposal.content.summary}</p>
            </div>
          )}
        </>
      )}
      {proposal.unbacked.length > 0 && (
        <div className="rounded-xl border border-dashed border-black/20 p-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-black/45">Be ready to back these up</p>
          <p className="mb-2.5 text-sm leading-relaxed text-black/65">
            Nothing in your resume or profile backs these up yet, so make sure you can back them up in an interview.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {proposal.unbacked.map((term) => (
              <Pill key={term} variant="outline-dashed">
                {term}
              </Pill>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-[#b23c26]">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {!nothing && (
          <StickerButton variant="primary" size="sm" disabled={using} onClick={onUse}>
            <Check className="h-3.5 w-3.5" />
            Add to resume
          </StickerButton>
        )}
        {!nothing && (
          <StickerButton variant="outline" size="sm" disabled={using} onClick={onPreview}>
            <Eye className="h-3.5 w-3.5" />
            Preview
          </StickerButton>
        )}
        <StickerButton variant="outline" size="sm" disabled={using} onClick={onDiscard}>
          <X className="h-3.5 w-3.5" />
          {nothing ? "Close" : "Discard"}
        </StickerButton>
      </div>
    </div>
  );
};

export default ResumeStep;
