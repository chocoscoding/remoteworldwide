"use client";

// Step 2: the resume this application goes out with (owner's design, 2026-10-19, "AI apply resume
// step").
//
// It starts from one resume (the master by default, or one uploaded or picked) and keeps ONE
// working copy for this application (owner, 2026-10-03): the original is never touched, and the
// draft stays out of every resume list until the application is tracked, when it is kept as the
// version that was sent.
//
// Three cards, top to bottom: which resume goes, the score and the fixes together, and the resume
// itself with an eye beside each section, role and line.
//
// Every change goes straight into the draft as a step of its history: a tool's rewrite, keywords
// added to Skills, a part hidden for this job. There is no "use this version" step any more; undo,
// redo and the history list (top right of the wizard) are how a change is taken back, and the
// score jumps with them without a re-score. Each new version is scored (always current, a credit a
// version; a repeat of the same version and posting comes from the scan cache, free), and "What
// your last change did" says which keywords it matched.
//
// Everything here (the picks of the resume, the draft, its history, the score) lives in the
// application's session, so a refresh loses none of it.

import { useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Download, ExternalLink, Eye, Layers, MoreHorizontal, RotateCw, Upload, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Bone, Loading, RowsSkeleton } from "@/app/components/dashboard/ui/Skeleton";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useDocuments } from "@/app/components/dashboard/documents/DocumentsProvider";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { changeCount, resumeChanges } from "@/app/lib/apply/changes";
import { LANGUAGE_LEVELS, keepProof, languageAsk, namesLanguage, onlyInSkills, unbackedSkills, workingItems } from "@/app/lib/apply/fixes";
import { impactMisses, openingWord } from "@/app/lib/apply/impact";
import { editBullet, editSummary, type LineEdit } from "@/app/lib/apply/edits";
import { hiddenLabel, pushStep, scoreOfScan, scoreStep, stampStep, stepId } from "@/app/lib/apply/history";
import { scanBaseline, sendingResumeId, type ApplyState } from "@/app/lib/apply/state";
import { ATS_BILLING_HREF, isCurrentScore, missingGaps, prepareResumeForDoc, scanCoverage } from "@/app/lib/ats/api";
import type { IngestedResumeDetail } from "@/app/lib/ats/types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { qk } from "@/app/lib/query/keys";
import { injectKeywords, quantifySuggestions, storedBulletIndex, tailorToJob, type KeywordInjection, type ResumePlace } from "@/app/lib/resume/ai";
import { applyQuantify } from "@/app/lib/dashboard/resume/ai-tools";
import {
  RESUME_ACCEPT,
  createDraftResume,
  createResumeDocument,
  getResumeDocument,
  importResume,
  parsedResumeOfBuilt,
  resumeContentToText,
  saveResumeDocument,
  updateDraftResume,
  visibleContent,
  type ImportedResume,
} from "@/app/lib/resume/api";
import { addSkills, reconcileGroups, removeSkills } from "@/app/lib/resume/skills";
import { useIngestedResumeQuery, useIngestedResumesQuery } from "@/hooks/queries/useAtsQueries";
import { useMasterResumeQuery } from "@/hooks/queries/useMasterResume";
import { useResumeSuggestion } from "@/hooks/mutations/useResumeSuggestion";
import type { StartedJob } from "../job";
import type { useApplyScan } from "../useApplyScan";
import ChangesPaper from "../parts/ChangesPaper";
import DraftHistory from "../parts/DraftHistory";
import ResumePreviewDialog, { DownloadButton } from "../parts/ResumePreviewDialog";
import { FixesTabs, ScoreRow, StuffingNote, type GapChip, type ScoreState, type StuffingNoteView, type Suggestion } from "../parts/ScoreFixes";
import SelectResumeDialog, { type PickedResume } from "../parts/SelectResumeDialog";
import { useResumeDownload } from "../parts/useResumeDownload";

export interface ResumeStepProps {
  job: StartedJob;
  state: ApplyState;
  /** Functional, so an answer that lands after a wait is applied to the state as it is then. */
  update: (recipe: (state: ApplyState) => ApplyState) => void;
  /** False once the application is tracked: nothing here changes, and nothing is scored. */
  editable: boolean;
  scan: ReturnType<typeof useApplyScan>;
  /** The wizard header's slot for this step's undo, redo and history; null while another step shows. */
  actionsSlot?: HTMLElement | null;
}

/** The service's cap on a tool's want-list. */
const MAX_TOOL_GAPS = 20;

/** The least time between two reads of the resume creator's copy: focus and visibility both fire on a tab switch. */
const PULL_GAP_MS = 5_000;

/** How long the eyes wait after the last click before saving: a few clicks make one version, and one score. */
const HIDE_SAVE_DELAY_MS = 1_200;
/** How long before a failed draft save is tried once more. */
const RETRY_SAVE_MS = 1_500;

const withoutExtension = (name: string) => name.replace(/\.[a-z0-9]{1,5}$/i, "");

/** The Impact row's line: "4 open with a weak verb (Held, Acted, Collaborated, Took) and 7 have no number." */
const impactDetail = (weak: string[], bare: number): string => {
  const names = [...new Set(weak.map(openingWord).filter(Boolean))].slice(0, 4);
  const parts = [
    weak.length > 0
      ? `${weak.length} ${weak.length === 1 ? "opens" : "open"} with a weak verb${names.length > 0 ? ` (${names.join(", ")})` : ""}`
      : null,
    bare > 0 ? `${bare} ${bare === 1 ? "has" : "have"} no number` : null,
  ].filter(Boolean);
  return `${parts.join(" and ")}.`;
};

/** What a failed save says: never a provider's own words ("Voyage embed timed out after 3000ms"). */
const changeMessage = (error: unknown): string =>
  error instanceof BackendError && error.status >= 500
    ? "Couldn't save that change just now, so nothing changed. Please try again."
    : apiMessage(error);

/** The draft cache entry the wizard reads (`useIngestedResumeQuery`), from a save's answer. */
const asDetail = (saved: ImportedResume): IngestedResumeDetail => ({
  resumeId: saved.resumeId,
  version: saved.version,
  status: saved.status as IngestedResumeDetail["status"],
  fileName: saved.fileName,
  content: saved.content,
  error: null,
});

const ResumeStep: FC<ResumeStepProps> = ({ job, state, update, editable, scan, actionsSlot = null }) => {
  const queryClient = useQueryClient();
  const { docs, loading: docsLoading } = useDocuments();
  const ingested = useIngestedResumesQuery();
  const tools = useResumeSuggestion();
  const { download, printer } = useResumeDownload();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  const [previewing, setPreviewing] = useState<"draft" | "base" | null>(null);
  const [openingCreator, setOpeningCreator] = useState(false);
  // The fixes: the keywords picked to add, where AI changes may go, and what is being done now.
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [places, setPlaces] = useState<ResumePlace[]>(["bullets", "skills"]);
  const [busy, setBusy] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  // The −1 pt note set aside ("Keep as is") for this score.
  const [keptStuffing, setKeptStuffing] = useState<string | null>(null);
  // "Show in resume": the lines lit on the page now, and a key so the same lines light again.
  const [flash, setFlash] = useState<{ texts: string[]; key: number } | null>(null);
  // The eyes' choice while it waits to be saved (shown at once), and its save timer.
  const [pendingHidden, setPendingHidden] = useState<string[] | null>(null);
  const hideTimer = useRef<number | null>(null);
  const flushHidden = useRef<(() => void) | null>(null);

  const { resume } = state;
  const sendingId = sendingResumeId(resume);
  const sending = useIngestedResumeQuery(sendingId);
  const base = useIngestedResumeQuery(resume.baseId);
  const draft = useIngestedResumeQuery(resume.draftId);
  // What the draft's words were built from, for the preview's marks.
  const draftFrom = useIngestedResumeQuery(resume.draftFromId);

  // Skills a tool added to the flat list only are brought into the entries the page prints, so what
  // is shown is what is scored.
  const sendingContent = sending.data?.content ?? null;
  const content = useMemo(() => (sendingContent ? reconcileGroups(sendingContent) : null), [sendingContent]);
  const version = sending.data?.version ?? null;
  const sendingReady = sending.data?.status === "ready";

  // A resume that couldn't be opened (the AI service restarting, say) is said, with a way to try
  // again, rather than left looking like it is still being read (owner, 2026-10-03: "I am stuck").
  const resumeFailed =
    (sendingId !== null && sending.isError) || (resume.baseId !== null && base.isError) || (resume.draftId !== null && draft.isError);
  function retryResumes() {
    if (sendingId && sending.isError) void sending.refetch();
    if (resume.baseId && base.isError) void base.refetch();
    if (resume.draftId && draft.isError) void draft.refetch();
  }

  // ---- The default: the master resume, else the newest one that was read ----------------------
  const masterImport = useRef(false);
  const masterResume = useMasterResumeQuery();
  useEffect(() => {
    // Both lists first: deciding before My documents is in would skip the master.
    if (!editable || resume.baseId || !ingested.data || docsLoading || masterResume.isPending) return;
    const ready = ingested.data.filter((row) => row.status === "ready");
    const pick = (resumeId: string, baseName: string) =>
      update((s) => (s.resume.baseId ? s : { ...s, resume: { ...s.resume, baseId: resumeId, baseName } }));
    const newest = () => {
      if (ready[0]) pick(ready[0].resumeId, ready[0].fileName);
    };
    const built = masterResume.data?.source === "built" ? masterResume.data : null;
    if (built && !masterImport.current) {
      // The master is a resume made here: read from its content (deduped by the service when unedited).
      masterImport.current = true;
      void parsedResumeOfBuilt(built.id)
        .then((prepared) => pick(prepared.resumeId, built.name))
        .catch(newest);
      return;
    }
    if (built) return;
    const master = docs.find((doc) => doc.kind === "resume" && doc.master && !doc.archived);
    const masterName = master ? (master.ext ? `${master.name}.${master.ext}` : master.name) : null;
    const linked = master?.aiResumeId ? ready.find((row) => row.resumeId === master.aiResumeId) : undefined;
    if (master && linked && masterName) {
      pick(linked.resumeId, masterName);
      return;
    }
    if (master && masterName && !masterImport.current) {
      // The master was never read for scoring: read it now (free, and remembered on the file).
      masterImport.current = true;
      void prepareResumeForDoc(master.id)
        .then((prepared) => pick(prepared.resumeId, masterName))
        .catch(newest);
      return;
    }
    if (!master) newest();
  }, [editable, resume.baseId, ingested.data, docs, docsLoading, masterResume.isPending, masterResume.data, update]);

  // ---- The score: automatic, and again after every change ---------------------------------------
  // A stored score an older formula made (owner, 2026-10-19: no longer keyword match alone) is not
  // this version's score: it shows as stale, and the effect below rescores the version once, not
  // charged twice (the AI's credit ledger knows the version). A tracked application is never
  // rescored, so it keeps the score it went with; and when the rescore fails (too few credits to
  // start one), the old score stands as it did, rather than leaving the card empty.
  const live = scan.resumeId !== null && scan.resumeId === sendingId ? scan : null;
  const stored =
    state.scan &&
    state.scan.resumeId === sendingId &&
    state.scan.version === version &&
    (!editable || isCurrentScore(state.scan.report) || Boolean(live?.failure))
      ? state.scan
      : null;
  // The stored score of this exact version first: after an undo the scanner still holds the newer version's report.
  const report = stored?.report ?? live?.report ?? null;
  const scoring = live?.status === "scoring";
  const scoreKey = sendingId && version !== null ? `${sendingId}:${version}` : null;
  const triedKey = useRef<string | null>(null);
  // The last score of this resume, even of an older version: "Edited since this score".
  const anyScore = state.scan && state.scan.resumeId === sendingId ? state.scan : null;

  /** The draft's version as it is now, from the cache every save writes to. */
  const draftVersionNow = useCallback(
    (draftId: string | null) => (draftId ? queryClient.getQueryData<IngestedResumeDetail>(qk.ats.resume(draftId))?.version : undefined),
    [queryClient],
  );

  const { run: runScan } = scan;
  const runScore = useCallback(
    (resumeId: string, scoredVersion: number) => {
      void runScan({ resumeId, jdText: job.description, jobId: job.savedJobId }).then((finished) => {
        if (!finished) return;
        update((s) => {
          // Measured against the last version scored (never a partly checked one, nor one an older formula
          // made); a re-run of the same version keeps what it was measured against. Each requirement's state
          // and each check's value before this version are what "Now matched" and "+18" are read from.
          const baseline = scanBaseline(s.scan, resumeId, scoredVersion);
          // The history step this version belongs to takes its score: the step the draft is at, when this is the draft as it is now.
          // A partly checked scan is shown, never kept as a step's score (owner, 2026-10-19): going back rescores.
          const isDraft = resumeId === s.resume.draftId;
          const history =
            !isDraft || finished.degraded
              ? s.resume.history
              : draftVersionNow(resumeId) === scoredVersion
                ? stampStep(s.resume.history, s.resume.historyAt, scoredVersion, finished)
                : scoreStep(s.resume.history, scoredVersion, finished);
          return {
            ...s,
            resume: { ...s.resume, history },
            scan: { resumeId, version: scoredVersion, report: finished, ...baseline },
          };
        });
      });
    },
    [runScan, job.description, job.savedJobId, update, draftVersionNow],
  );

  // Once per resume version: a version already scored (here or before a refresh) is shown, not re-run.
  useEffect(() => {
    if (!editable || !scoreKey || !sendingId || version === null || !sendingReady || stored) return;
    if (triedKey.current === scoreKey) return;
    triedKey.current = scoreKey;
    runScore(sendingId, version);
  }, [editable, scoreKey, sendingId, version, sendingReady, stored, runScore]);

  const scoreState: ScoreState = !sendingId
    ? { kind: "none" }
    : scoring || (!report && (sending.isPending || sending.data?.status === "pending" || !live?.failure))
      ? { kind: "scoring" }
      : live?.failure && !report
        ? { kind: "failed", message: live.failure.message, retryable: live.failure.retryable, credits: live.failure.kind === "credits" }
        : report && stored && scanCoverage(report).partial
          ? { kind: "partial", checked: scanCoverage(report).checked, total: scanCoverage(report).total }
          : report && stored
            ? { kind: "ready" }
            : { kind: "stale" };
  const shownReport = report ?? (scoreState.kind === "stale" ? (anyScore?.report ?? null) : null);

  const gaps = report ? missingGaps(report) : [];
  const verdictById = useMemo(() => new Map((report?.verdicts ?? []).map((verdict) => [verdict.requirement.id, verdict])), [report]);

  // ---- The resume, whole, at the bottom ---------------------------------------------------------
  const sendingDraft = resume.sendDraft && resume.draftId !== null && sendingId === resume.draftId;
  const draftData = draft.data?.content ?? null;
  const draftContent = useMemo(() => (draftData ? reconcileGroups(draftData) : null), [draftData]);
  const draftBase = draftFrom.data?.content ?? base.data?.content ?? null;
  // Sending the draft: what changed for this job is marked (once what it was made from is in). Sending the original: nothing is.
  const paperBefore = sendingDraft && draftBase ? draftBase : content;
  const paperChanges = useMemo(() => (content && paperBefore ? changeCount(resumeChanges(paperBefore, content)) : 0), [content, paperBefore]);

  // ---- Edits made in the resume creator come back -----------------------------------------------
  // Read when this tab is shown again, and once on load, so the preview and the score follow them.
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
        await commitChange("Edited in the resume creator", copy.content);
        toast.success("Brought in your edits from the resume creator.");
      } catch (error) {
        // The copy is gone: the next "Open in editor" makes a new one.
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
    // `commitChange` reads the latest state through `update`; re-subscribing on every render would re-read on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ---- Changes: every one goes into the draft as a step of its history ----------------------------
  const draftLabel = `${withoutExtension(resume.baseName ?? "Resume")} for ${job.company}`;
  const history = resume.history;
  const historyAt = resume.historyAt;

  /** Writes words into this application's one draft: made the first time, updated in place after. A provider hiccup is tried once more. */
  async function writeDraft(words: ResumeContent): Promise<ImportedResume> {
    const write = async (): Promise<ImportedResume> => {
      try {
        return resume.draftId ? await updateDraftResume(resume.draftId, words, draftLabel) : await createDraftResume(words, draftLabel);
      } catch (error) {
        // The draft is gone (removed elsewhere): start a new one rather than fail.
        if (!(resume.draftId && error instanceof BackendError && error.status === 404)) throw error;
        return createDraftResume(words, draftLabel);
      }
    };
    try {
      return await write();
    } catch (error) {
      if (!(error instanceof BackendError && error.status >= 500)) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, RETRY_SAVE_MS));
      return write();
    }
  }

  /**
   * The step being left keeps the score its words had: the current score, when it is of the draft as
   * it is now (read before the draft is written again). A score that was lost along the way (a reload
   * mid-score, say) is put back here rather than shown wrong after an undo. One an older formula made
   * is not: the step keeps none, and going back to it rescores.
   */
  function leaving(s: ApplyState, versionNow: number | undefined) {
    const draftId = s.resume.draftId;
    if (
      !s.scan ||
      s.scan.report.degraded ||
      !isCurrentScore(s.scan.report) ||
      !draftId ||
      s.scan.resumeId !== draftId ||
      versionNow === undefined ||
      s.scan.version !== versionNow
    )
      return s.resume.history;
    return stampStep(s.resume.history, s.resume.historyAt, versionNow, s.scan.report);
  }

  /**
   * One change: the words go into the draft, the change becomes the latest step of the history (any
   * steps undone before it are cleared), and the new version is scored. True once it is in.
   */
  async function commitChange(label: string, words: ResumeContent): Promise<boolean> {
    const before = content;
    if (!before) return false;
    setChangeError(null);
    const versionNow = draftVersionNow(resume.draftId);
    try {
      const saved = await writeDraft(words);
      queryClient.setQueryData(qk.ats.resume(saved.resumeId), asDetail(saved));
      const at = new Date().toISOString();
      const unchanged = saved.resumeId === sendingId && saved.version === version;
      update((s) => {
        let steps = leaving(s, versionNow);
        let index = s.resume.historyAt;
        if (steps.length === 0) {
          // The first change: where the draft started is the first step, with the score it had (none
          // when that was partly checked or made by an older formula).
          steps = [
            {
              id: stepId(),
              label: `Started from ${s.resume.baseName ?? "your resume"}`,
              at,
              content: before,
              version: null,
              ...scoreOfScan(report),
            },
          ];
          index = 0;
        }
        const pushed = pushStep(steps, index, {
          id: stepId(),
          label,
          at,
          content: words,
          version: saved.version,
          // The same text is the same version: it keeps the score it has, and nothing is re-scored.
          ...scoreOfScan(unchanged ? report : null),
        });
        return {
          ...s,
          proposal: null,
          resume: {
            ...s.resume,
            draftId: saved.resumeId,
            draftName: saved.fileName,
            draftFromId: s.resume.sendDraft && s.resume.draftId ? s.resume.draftFromId : s.resume.baseId,
            sendDraft: true,
            history: pushed.history,
            historyAt: pushed.at,
          },
        };
      });
      return true;
    } catch (error) {
      setChangeError(changeMessage(error));
      return false;
    }
  }

  /** Undo, redo or a jump in the history: that step's words go back into the draft, with its score if it has one. */
  async function jumpTo(index: number) {
    const step = history[index];
    if (!step || index === historyAt || busy) return;
    setBusy("Going back to that step…");
    setChangeError(null);
    const versionNow = draftVersionNow(resume.draftId);
    try {
      const saved = await writeDraft(step.content);
      queryClient.setQueryData(qk.ats.resume(saved.resumeId), asDetail(saved));
      update((s) => ({
        ...s,
        proposal: null,
        resume: {
          ...s.resume,
          draftId: saved.resumeId,
          draftName: saved.fileName,
          sendDraft: true,
          history: leaving(s, versionNow).map((row, i) => (i === index ? { ...row, version: saved.version } : row)),
          historyAt: index,
        },
        // The score jumps with it: the step's own report, read for the version it was just saved as.
        // Nothing is measured against the step left: a jump is not a change, so the card just says "Up to date".
        // A step with no score of today's formula keeps the last scan (another version), so this one is rescored.
        scan:
          step.report && !step.report.degraded && isCurrentScore(step.report)
            ? { resumeId: saved.resumeId, version: saved.version, report: step.report, previousScore: null }
            : s.scan,
      }));
    } catch (error) {
      setChangeError(changeMessage(error));
    } finally {
      setBusy(null);
    }
  }

  // Ctrl+Z / Ctrl+Shift+Z walk the history while this step shows, outside a text field.
  useEffect(() => {
    if (!actionsSlot || !editable) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      void jumpTo(event.shiftKey ? historyAt + 1 : historyAt - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- The eyes: parts hidden for this application only ---------------------------------------
  // Owner, 2026-10-18: hide a section, a role or one line without leaving the flow. What is hidden
  // stays on the page, washed out, and is left out of what is scored, written from and sent.
  const savedHidden = useMemo(() => content?.hiddenParts ?? [], [content]);
  const shownHidden = pendingHidden ?? savedHidden;

  function toggleHidden(key: string) {
    if (!content) return;
    const next = shownHidden.includes(key) ? shownHidden.filter((part) => part !== key) : [...shownHidden, key];
    setPendingHidden(next);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    const words = content;
    const was = savedHidden;
    const save = () => {
      void commitChange(hiddenLabel(was, next, words), { ...words, hiddenParts: next }).finally(() => setPendingHidden(null));
    };
    flushHidden.current = save;
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      flushHidden.current = null;
      save();
    }, HIDE_SAVE_DELAY_MS);
  }

  // Leaving the step with a choice still waiting: it is saved, not dropped.
  useEffect(
    () => () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      flushHidden.current?.();
    },
    [],
  );

  // ---- Click-to-edit lines on the page ------------------------------------------------------------
  // Owner, 2026-10-19: "click it and edit its text ... delete the line, change the number". Each
  // edit is one change of the draft (undo takes it back); an eye's choice still waiting goes with it.
  function commitEdit(edit: LineEdit | null) {
    if (!edit || !editable) return;
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
      flushHidden.current = null;
    }
    void commitChange(edit.label, edit.content).finally(() => setPendingHidden(null));
  }
  const paperEdits =
    editable && content
      ? {
          onSummary: (text: string) => commitEdit(editSummary({ ...content, hiddenParts: shownHidden }, text)),
          onBullet: (entryId: string, index: number, text: string) =>
            commitEdit(editBullet({ ...content, hiddenParts: shownHidden }, entryId, index, text)),
        }
      : undefined;

  // ---- The fixes ---------------------------------------------------------------------------------
  const gapChips: GapChip[] = gaps.map((gap) => ({
    id: gap.id,
    label: gap.label,
    wants: verdictById.get(gap.id)?.requirement.text ?? gap.label,
  }));
  const proofChips: GapChip[] = (report?.verdicts ?? []).filter(onlyInSkills).map((verdict) => ({
    id: verdict.requirement.id,
    label: verdict.requirement.label?.trim() || verdict.requirement.text,
    wants: verdict.requirement.text,
  }));
  const working = report ? workingItems(report, content) : [];
  const toolsIdle = editable && Boolean(content) && tools.running === null && !busy;

  /** Runs a tool, then puts what it wrote into the draft as one change. */
  async function runAndCommit(label: string, busyText: string, run: () => Promise<{ content: ResumeContent } | null>): Promise<boolean> {
    if (!toolsIdle) return false;
    setBusy(busyText);
    setChangeError(null);
    try {
      const result = await run();
      if (!result || !content) return false;
      // Never at the cost of what proves a requirement: a line the scan quotes as proof, rewritten so
      // it no longer says it, goes back as it was (owner, 2026-10-19), and the person is told which.
      const guarded = report ? keepProof(content, reconcileGroups(result.content), report) : { content: reconcileGroups(result.content), kept: [] };
      // Nothing new on the page: said plainly, never a history step that claims a change (owner,
      // 2026-10-19: "no matter the times I add this thing, it does not change anything").
      if (changeCount(resumeChanges(content, guarded.content)) === 0 && guarded.kept.length === 0) {
        setChangeError("Nothing on your resume changed that time. Try again, or click a line to say it yourself.");
        return false;
      }
      if (guarded.kept.length > 0) {
        toast(
          `Kept ${guarded.kept.length === 1 ? "a line" : "some lines"} as ${guarded.kept.length === 1 ? "it was" : "they were"}: ${guarded.kept.length === 1 ? "it proves" : "they prove"} ${guarded.kept.join(", ")}.`,
        );
      }
      return await commitChange(label, guarded.content);
    } finally {
      setBusy(null);
    }
  }

  const keywordsFor = (terms: string[]) => (terms.length > 0 ? terms.slice(0, MAX_TOOL_GAPS) : null);

  function tailor(words: ResumeContent | null = content, allowed: ResumePlace[] = places) {
    if (!words) return;
    const tailorPlaces = allowed.filter((place) => place === "summary" || place === "skills");
    void runAndCommit("Tailored summary & skills", "Tailoring your summary and skills…", async () => {
      const result = await tools.run("tailor", () =>
        tailorToJob({
          content: words,
          jdText: job.description,
          company: job.company,
          role: job.role,
          keywords: keywordsFor(gaps.map((gap) => gap.label)),
          places: tailorPlaces,
        }),
      );
      return result ? { content: result.content } : null;
    });
  }

  /**
   * "Add N keywords to …": where "Apply changes to" says (owner, 2026-10-19: "it's only adding to
   * skills"). With Bullets or Summary on, the AI works each one into a line there (and Skills, when
   * on), insisted: the person picked them. Skills alone is straight into Skills, no AI.
   */
  function addPicked() {
    if (!content || !toolsIdle) return;
    // A language is answered by its level, picked on its chip; never sent to be "added" bare.
    const chosen = gapChips.filter((chip) => picked.has(chip.id) && !isLanguageChip(chip));
    const labels = chosen.map((chip) => chip.label);
    if (labels.length === 0) return;
    // What each one means: the posting's requirement and the words the scorer reads it in, so the
    // line says that, not only the label (owner, 2026-10-19: "multichannel" alone stayed partial).
    const hints = Object.fromEntries(
      chosen.map((chip) => [chip.label, { means: chip.wants, proof: verdictById.get(chip.id)?.requirement.proof ?? [] }]),
    );
    const n = labels.length;
    const noun = n === 1 ? "keyword" : "keywords";
    if (places.includes("bullets") || places.includes("summary")) {
      const where = places.includes("bullets") ? "your experience" : "your summary";
      let outcome: KeywordInjection | null = null;
      void runAndCommit(`Worked ${n} ${noun} into ${where}`, `Working ${n} ${noun} into ${where}…`, async () => {
        const result = await tools.run("keywords", () =>
          injectKeywords({
            content,
            jdText: job.description,
            company: job.company,
            role: job.role,
            keywords: labels,
            places,
            insist: true,
            hints,
          }),
        );
        outcome = result;
        return result ? { content: result.content } : null;
      }).then((made) => {
        if (!made) return;
        setPicked(new Set());
        if (outcome) tellKeywords(outcome);
      });
      return;
    }
    const words = addSkills(content, labels);
    setBusy(`Adding ${labels.length} ${labels.length === 1 ? "keyword" : "keywords"} and rescoring…`);
    void commitChange(`Added ${labels.length} ${labels.length === 1 ? "keyword" : "keywords"} to Skills`, words).then((made) => {
      if (made) setPicked(new Set());
      setBusy(null);
    });
  }

  /**
   * After "Add N keywords": the lines they went into, lit on the page, and a word on any that only
   * made it into Skills or that nothing on the resume backed (owner, 2026-10-19: warn, never refuse).
   */
  function tellKeywords(outcome: KeywordInjection) {
    const lines = Object.values(outcome.placed ?? {})
      .flat()
      .filter((line) => line !== "Skills");
    if (lines.length > 0) showOnPage(lines);
    const inSkills = outcome.skillsOnly ?? [];
    const toBack = (outcome.advice ?? []).map((note) => note.term).filter((term) => !inSkills.includes(term));
    const list = (terms: string[]) => (terms.length === 1 ? terms[0] : `${terms.slice(0, -1).join(", ")} and ${terms[terms.length - 1]}`);
    if (inSkills.length > 0) {
      toast(
        `${list(inSkills)} went into Skills for now: no line took ${inSkills.length === 1 ? "it" : "them"} cleanly. Click the line where you did it and say it there.`,
      );
    } else if (toBack.length > 0) {
      toast(`Added. Your resume didn't show ${list(toBack)} before, so have a real example ready for the interview.`);
    }
  }

  /**
   * "Prove the N in a bullet" and "Show them in experience": the keywords only in Skills (or the ones
   * the note names), each worked into a line of experience. Insisted: Skills already lists them, and
   * that must not count as done (owner, 2026-10-19: "it does not add anything to work experience").
   */
  function prove(terms: string[] = proofChips.map((chip) => chip.label)) {
    if (!content || terms.length === 0) return;
    void runAndCommit(
      `Worked ${terms.length} ${terms.length === 1 ? "skill" : "skills"} into your experience`,
      "Working them into your experience…",
      async () => {
        const result = await tools.run("keywords", () =>
          injectKeywords({
            content,
            jdText: job.description,
            company: job.company,
            role: job.role,
            keywords: terms,
            places: ["bullets"],
            insist: true,
          }),
        );
        return result ? { content: result.content } : null;
      },
    );
  }

  /**
   * "Fix them" on the Impact row (owner, 2026-10-19: "why can't I make it better?"): each bullet that
   * loses Impact points gets what it lacks, a strong opening, a number, or both, as one change. The
   * Quantify tool, never the free-form Ask (Ask rewrote lines that proved requirements, padded every
   * bullet and took the score from 61 to the 40s); applied here, and only to bullets shown for this job.
   */
  function strengthen() {
    if (!content) return;
    const sent = { ...content, hiddenParts: shownHidden };
    let rewritten: string[] = [];
    void runAndCommit("Strengthened your bullets", "Strengthening the bullets that lose Impact points…", async () => {
      const proposals = await tools.run("quantify", () => quantifySuggestions({ content: sent, section: "experience", openers: true }));
      if (!proposals) return null;
      const landed = proposals
        .filter((proposal) => !proposal.customId && sent.experience[proposal.entryIndex])
        .map((proposal) => ({ ...proposal, bulletIndex: storedBulletIndex(sent.experience[proposal.entryIndex].bullets, proposal.bulletIndex) }))
        .filter((proposal) => {
          const entry = sent.experience[proposal.entryIndex];
          return !shownHidden.includes(`exp:${entry.id}`) && !shownHidden.includes(`exp:${entry.id}:${proposal.bulletIndex}`);
        });
      if (landed.length === 0) {
        setChangeError("Every bullet shown already opens strongly and carries a number.");
        return null;
      }
      rewritten = landed.map((proposal) => proposal.after);
      return { content: landed.reduce(applyQuantify, content) };
    }).then((made) => {
      if (made) showOnPage(rewritten);
    });
  }

  // What the cards read: the resume as it goes, without what is hidden for this job (owner,
  // 2026-10-19: nothing is suggested for, or done to, a hidden part).
  const visible = useMemo(() => (content ? visibleContent({ ...content, hiddenParts: shownHidden }) : null), [content, shownHidden]);

  /** "Show in resume": these lines brought into view and lit leaf green for a moment. */
  function showOnPage(texts: string[], fallback: string | null = null) {
    if (texts.length > 0) setFlash({ texts, key: Date.now() });
    else showSection(fallback);
  }

  const impact = report?.metrics.find((metric) => metric.id === "impact-language")?.value;
  // The lines Impact language marks down, read as the scorer reads them, live as the person edits.
  const misses = visible ? impactMisses(visible) : null;
  const summaryHidden = shownHidden.includes("summary");
  const summaryText = visible?.summary.trim() ?? "";
  // A summary worth tailoring: shown, and naming none of what the posting still misses, and not
  // tailored already in this draft's history (owner, 2026-10-19: the button left the bottom row).
  const tailoredAlready = history.slice(0, historyAt + 1).some((step) => step.label.startsWith("Tailored"));
  const summaryUntailored =
    Boolean(visible) &&
    !summaryHidden &&
    !tailoredAlready &&
    gaps.length > 0 &&
    !gaps.some((gap) => summaryText.toLowerCase().includes(gap.label.toLowerCase()));
  // A language the posting asks for and the resume never states: the person picks their level, and
  // it goes into Skills as one plain line the scorer reads ("English: fluent (C1)").
  const language = report && visible && !shownHidden.includes("skills") ? languageAsk(report, visible) : null;
  function addLanguage(level: string) {
    if (!content || !language || !toolsIdle) return;
    const line = `${language.language}: ${level}`;
    setBusy(`Adding ${line} and rescoring…`);
    // A bare "English" the keyword tool once added makes way for the line with the level.
    const words = addSkills(removeSkills(content, [language.language]), [line]);
    void commitChange(`Added ${line} to Skills`, words).finally(() => setBusy(null));
  }
  const levelChoices = LANGUAGE_LEVELS.map((level) => ({ label: level[0].toUpperCase() + level.slice(1), onClick: () => addLanguage(level) }));
  /** The chip of the language the card would ask about: it asks for the level itself (owner, 2026-10-19). */
  function isLanguageChip(chip: GapChip): boolean {
    return language !== null && namesLanguage(`${chip.label} ${chip.wants}`, language.language);
  }
  const shownChips: GapChip[] = gapChips.map((chip) =>
    isLanguageChip(chip)
      ? {
          ...chip,
          choices: { title: language?.level ? `The posting asks for ${language.level}. Your level:` : "Your level:", options: levelChoices },
        }
      : chip,
  );
  const languageOnChip = gapChips.some(isLanguageChip);
  const suggestions: Suggestion[] = [
    ...(language && !languageOnChip
      ? [
          {
            id: "language",
            title: `Your resume doesn't say your ${language.language} level.`,
            detail: language.level ? `The posting asks for ${language.level}. Pick yours:` : "The posting asks for it. Pick yours:",
            action: "",
            icon: "tailor" as const,
            choices: levelChoices,
          },
        ]
      : []),
    // Every line that loses Impact points, and why (owner, 2026-10-19: "show me what impact language
    // looks at"): its weak openings named, a click lights them all, "Fix them" mends both halves.
    ...(impact !== undefined && impact !== null && misses && misses.lines.length > 0
      ? [
          {
            id: "impact",
            title: `${misses.lines.length} ${misses.lines.length === 1 ? "bullet loses" : "bullets lose"} Impact points.`,
            detail: impactDetail(misses.weakOpeners, misses.noNumber.length),
            action: "Fix them",
            icon: "quantify" as const,
            onClick: () => strengthen(),
            onShow: () => showOnPage(misses.lines, "experience"),
          },
        ]
      : []),
    ...(summaryUntailored && content
      ? [
          {
            id: "tailor",
            title: summaryText ? "Summary isn't tailored to this job." : "No summary yet.",
            detail: summaryText ? "It names none of what the posting asks for." : "A short one aimed at this job is what recruiters read first.",
            action: summaryText ? "Tailor it" : "Write one",
            icon: "tailor" as const,
            onClick: () => tailor(content, ["summary", "skills"]),
            ...(summaryText ? { onShow: () => showOnPage([summaryText], "summary") } : {}),
          },
        ]
      : []),
    ...(summaryHidden && content
      ? [
          {
            id: "summary",
            title: "Summary is hidden.",
            detail: "Recruiters skim it first: a tailored one helps here.",
            action: "Tailor it",
            icon: "tailor" as const,
            onClick: () => tailor({ ...content, hiddenParts: shownHidden.filter((key) => key !== "summary") }, ["summary", "skills"]),
          },
        ]
      : []),
  ];

  // The points-off note, until it is kept as is for this score. The skills it is about are named
  // here from the resume (the scorer's own line only says how many), so each can be acted on.
  const UNBACKED_REASON = /appear nowhere in your experience$/;
  const unbacked = report && visible && (report.stuffing ?? []).some((reason) => UNBACKED_REASON.test(reason)) ? unbackedSkills(visible, report) : [];
  const stuffingNote: StuffingNoteView | null =
    report && (report.stuffingPenalty ?? 0) > 0 && (report.stuffing ?? []).length > 0 && keptStuffing !== report.scanId
      ? {
          points: report.stuffingPenalty ?? 0,
          unbacked,
          others: (report.stuffing ?? []).filter((reason) => unbacked.length === 0 || !UNBACKED_REASON.test(reason)),
        }
      : null;

  /** "Remove from Skills": the unbacked skills out of this job's draft; no AI, so no credit for the change. */
  function removeUnbacked() {
    if (!content || !toolsIdle || unbacked.length === 0) return;
    const n = unbacked.length;
    setBusy(`Removing ${n} ${n === 1 ? "skill" : "skills"} and rescoring…`);
    void commitChange(`Removed ${n} ${n === 1 ? "skill" : "skills"} from Skills`, removeSkills(content, unbacked)).finally(() => setBusy(null));
  }

  /** A section on the page, brought into view: where "Show in resume" goes when it has no lines to light. */
  function showSection(section: string | null) {
    const kind = section === "certifications" ? "training" : section;
    const target = kind ? paperRef.current?.querySelector<HTMLElement>(`[data-resume-section="${kind}"]`) : null;
    (target ?? paperRef.current)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const stuffingView = stuffingNote ? (
    <StuffingNote
      note={stuffingNote}
      onProve={toolsIdle ? () => prove(unbacked) : undefined}
      onRemove={toolsIdle ? removeUnbacked : undefined}
      onShowWhere={() => showOnPage(unbacked, unbacked.length > 0 ? "skills" : "experience")}
      onKeep={() => setKeptStuffing(report?.scanId ?? null)}
    />
  ) : null;

  // ---- The resume creator -----------------------------------------------------------------------
  /**
   * "Open in editor": a copy in the resume creator, in a new tab, made once and refreshed with the
   * draft's words on every later open, so opening it again never adds another resume.
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

  const draftName = resume.draftName ?? draftLabel;
  const baseName = resume.baseName ?? base.data?.fileName ?? "Your resume";
  const sendingName = sendingDraft ? draftName : baseName;
  const changes = Math.max(0, history.length > 0 ? historyAt : paperChanges);
  const hiddenSections = shownHidden.filter((key) => !key.startsWith("exp:") || !/:\d+$/.test(key)).length;
  const hiddenLines = shownHidden.length - hiddenSections;

  return (
    <div className="flex flex-col gap-4">
      {actionsSlot &&
        createPortal(
          <DraftHistory history={history} at={historyAt} onJump={(index) => void jumpTo(index)} disabled={!editable || Boolean(busy)} />,
          actionsSlot,
        )}

      {/* Which resume */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[#222325]/8 bg-white p-[18px]">
        <div className="flex items-center gap-2">
          <h2 className="m-0 flex-1 text-base font-extrabold text-primary">Which resume goes with it?</h2>
          <button type="button" disabled={!editable || uploading} onClick={() => fileRef.current?.click()} className={OUTLINE_BUTTON}>
            <Upload className="h-[13px] w-[13px]" strokeWidth={2.4} />
            Upload
          </button>
          <button type="button" disabled={!editable} onClick={() => setSelectOpen(true)} className={OUTLINE_BUTTON}>
            <Layers className="h-[13px] w-[13px]" strokeWidth={2.4} />
            From my resumes
          </button>
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
        {uploadError && <p className="text-sm text-[#b23c26]">{uploadError}</p>}
        {uploading && (
          <Loading label="Reading your upload">
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
                No resume picked yet. Upload one (PDF, DOCX, TXT or MD) or pick one you already have.
              </p>
            )
          )
        ) : (
          <div className="flex flex-col gap-2.5 md:flex-row">
            {resume.draftId && (
              <ResumeCard
                name={draftName}
                meta={
                  draft.isPending ? (
                    <Bone className="mt-1 h-2.5 w-40" />
                  ) : draft.isError ? (
                    "Couldn't open it just now"
                  ) : (
                    `The one draft for this job · ${changes} ${changes === 1 ? "change" : "changes"}`
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
                          label: "Open in editor",
                          icon: ExternalLink,
                          busy: openingCreator,
                          onSelect: () => void openInCreator(draftContent, draftName),
                        },
                        { id: "preview", label: "Preview", icon: Eye, onSelect: () => setPreviewing("draft") },
                        { id: "pdf", label: "Download as PDF", icon: Download, onSelect: () => download(draftContent, draftName, "pdf") },
                        {
                          id: "docx",
                          label: "Download as DOCX",
                          icon: Download,
                          onSelect: () => download(draftContent, draftName, "docx"),
                        },
                      ]
                    : undefined
                }
              />
            )}
            <ResumeCard
              name={baseName}
              meta={
                base.isPending || base.data?.status === "pending" ? (
                  <Bone className="mt-1 h-2.5 w-40" />
                ) : base.isError ? (
                  "Couldn't open it just now"
                ) : base.data?.status === "failed" ? (
                  (base.data.error ?? "Couldn't be read")
                ) : (
                  "The original, kept as it is"
                )
              }
              selected={!resume.sendDraft}
              disabled={!editable || (base.data !== undefined && base.data.status !== "ready")}
              onSelect={() => update((s) => ({ ...s, resume: { ...s.resume, sendDraft: false } }))}
              menu={
                base.data?.content
                  ? [
                      { id: "preview", label: "Preview", icon: Eye, onSelect: () => setPreviewing("base") },
                      {
                        id: "pdf",
                        label: "Download as PDF",
                        icon: Download,
                        onSelect: () => base.data?.content && download(base.data.content, baseName, "pdf"),
                      },
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
          </div>
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
      </section>

      {/* The score and the fixes, together */}
      <section className="flex flex-col gap-[18px] rounded-2xl border border-[#222325]/8 bg-white p-5">
        <ScoreRow
          state={scoreState}
          report={shownReport}
          previousScore={stored?.previousScore ?? null}
          previousMetrics={stored?.previousMetrics}
          company={job.company}
          creditsHref={ATS_BILLING_HREF}
          onRescore={sendingId && version !== null ? () => runScore(sendingId, version) : undefined}
        />
        {report && (
          <FixesTabs
            gaps={shownChips}
            skillsOnly={proofChips}
            picked={picked}
            onToggle={(id) =>
              setPicked((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onClear={() => setPicked(new Set())}
            working={working}
            suggestions={suggestions}
            places={places}
            onPlaces={setPlaces}
            busy={busy ?? (tools.running ? "Working on it…" : null)}
            disabled={!toolsIdle}
            onAddPicked={addPicked}
            onProve={() => prove()}
            error={changeError ?? (tools.failure && !tools.running ? tools.failure.message : null)}
            creditsHref={tools.failure?.needsCredits ? ATS_BILLING_HREF : null}
            unchecked={report.degraded ? report.verdicts.filter((verdict) => verdict.state === "undetermined").length : 0}
            onRescore={sendingId && version !== null ? () => runScore(sendingId, version) : undefined}
            note={stuffingView}
          />
        )}
      </section>

      {/* The resume, whole, with an eye beside each section, role and line */}
      {sendingId && (
        <section className="flex flex-col overflow-hidden rounded-2xl border border-[#222325]/8 bg-white">
          <div className="flex flex-wrap items-center gap-2.5 px-[18px] py-4">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-extrabold text-primary">The resume you&apos;re sending</span>
              <span className="text-xs text-[#5f6062]">
                {shownHidden.length > 0
                  ? `${[
                      hiddenSections > 0 ? `${hiddenSections} ${hiddenSections === 1 ? "section" : "sections"}` : null,
                      hiddenLines > 0 ? `${hiddenLines} ${hiddenLines === 1 ? "line" : "lines"}` : null,
                    ]
                      .filter(Boolean)
                      .join(" and ")} hidden. Click a line to edit it. Your saved resume is untouched.`
                  : editable
                    ? "Click a line to edit it, or use an eye to hide it for this job. Your saved resume is untouched."
                    : "Your saved resume is untouched."}
              </span>
            </span>
            {content && <DownloadButton onDownload={(format) => download({ ...content, hiddenParts: shownHidden }, sendingName, format)} />}
            {sendingDraft && draftContent && (
              <button
                type="button"
                disabled={openingCreator}
                onClick={() => void openInCreator(draftContent, draftName)}
                className={cn(OUTLINE_BUTTON, "h-[38px]")}>
                <ExternalLink className="h-[13px] w-[13px]" strokeWidth={2.4} />
                Open in editor
              </button>
            )}
          </div>
          <div ref={paperRef} className="bg-[#ecece6] px-4 py-7 sm:px-7">
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
              <ChangesPaper
                content={{ ...content, hiddenParts: shownHidden }}
                before={paperBefore}
                eyes={
                  editable ? { hidden: shownHidden, onToggle: toggleHidden, experienceIds: content.experience.map((entry) => entry.id) } : undefined
                }
                edits={paperEdits}
                flash={flash}
              />
            )}
          </div>
        </section>
      )}

      <SelectResumeDialog open={selectOpen} onOpenChange={setSelectOpen} onPicked={setBase} />

      {previewing === "draft" && draftContent && (
        <ResumePreviewDialog
          open
          onOpenChange={(open) => !open && setPreviewing(null)}
          title={draftName}
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
          title={baseName}
          content={base.data.content}
          before={base.data.content}
          onDownload={(format) => base.data?.content && download(base.data.content, baseName, format)}
        />
      )}
      {printer}
    </div>
  );
};

const OUTLINE_BUTTON =
  "flex h-8 flex-none cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#222325]/22 bg-white px-2.5 text-xs font-extrabold text-primary disabled:cursor-default disabled:opacity-50";

/** A page of resume while it opens: a name, then a few sections. */
const PaperSkeleton: FC = () => (
  <div className="mx-auto flex w-full max-w-[760px] flex-col gap-7 bg-white p-8 sm:p-10">
    <div className="flex flex-col gap-2">
      <Bone className="h-6 w-1/3" />
      <Bone className="h-3 w-1/4" />
    </div>
    {[0, 1, 2].map((section) => (
      <div key={section} className="flex flex-col gap-2.5">
        <Bone className="h-3 w-28" />
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-5/6" />
      </div>
    ))}
  </div>
);

interface RowMenuEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  busy?: boolean;
}

const MENU_ITEM =
  "flex w-full cursor-pointer items-center gap-2.5 border-b border-black/8 px-3.5 py-2.5 text-left text-xs font-semibold text-primary transition-colors last:border-b-0 hover:bg-[#fbfbf7] disabled:cursor-wait disabled:opacity-60";

/** A resume card's ⋯ menu: the same menu as a row in My documents. */
const RowMenu: FC<{ name: string; entries: RowMenuEntry[] }> = ({ name, entries }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`More for ${name}`}
          title="More"
          className={cn(
            "grid h-[30px] w-[30px] flex-none cursor-pointer place-content-center rounded-lg text-primary transition-colors hover:bg-black/[0.05]",
            open && "bg-black/[0.05]",
          )}>
          <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4} className="br-bold w-56 overflow-hidden rounded-xl border-2 border-black bg-white p-0">
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            disabled={entry.busy}
            onClick={() => {
              // Called inside the click: "Open in editor" opens its tab before anything is awaited.
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

/** One resume to send, side by side with the other (owner's design): a filled check and a lime edge on the one going. */
const ResumeCard: FC<{
  name: string;
  meta: ReactNode;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  menu?: RowMenuEntry[];
}> = ({ name, meta, selected, disabled, onSelect, menu }) => (
  <div
    className={cn(
      "flex min-h-[60px] flex-1 items-center gap-3 rounded-xl bg-white pl-3.5 pr-2.5",
      selected ? "border-[1.5px] border-[#222325] shadow-[2px_2px_0_0_#e1f073]" : "border border-[#222325]/14",
    )}>
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn("flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left", disabled ? "cursor-default" : "cursor-pointer")}>
      {selected ? (
        <span className="grid h-5 w-5 flex-none place-content-center rounded-full bg-[#222325]">
          <Check className="h-[11px] w-[11px] text-[#e1f073]" strokeWidth={3.2} />
        </span>
      ) : (
        <span className="h-5 w-5 flex-none rounded-full border-[1.5px] border-[#222325]/35" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-sm text-primary", selected ? "font-extrabold" : "font-bold")}>{name}</span>
        <span className="truncate text-xs text-[#5f6062]">{meta}</span>
      </span>
      {selected && <span className="flex-none rounded-full bg-[#e1f073] px-[9px] py-0.5 text-xs font-extrabold text-primary">Sending</span>}
    </button>
    {menu && menu.length > 0 && <RowMenu name={name} entries={menu} />}
  </div>
);

export default ResumeStep;
