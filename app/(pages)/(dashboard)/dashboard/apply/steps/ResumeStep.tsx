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
import {
  IMPACT_WORTH_FIXING_BELOW,
  LANGUAGE_LEVELS,
  keepProof,
  languageAsk,
  matchesEnough,
  namesLanguage,
  provedIn,
  TRIED,
  workedIn,
  onlyInSkills,
  unbackedSkills,
  workingItems,
  worthGapChip,
  fitGap,
} from "@/app/lib/apply/fixes";
import { impactMisses } from "@/app/lib/apply/impact";
import { editBullet, editSummary, type LineEdit } from "@/app/lib/apply/edits";
import { hiddenLabel, pushStep, scoreOfScan, scoreStep, stampStep, stepId, undoIfWorse } from "@/app/lib/apply/history";
import { scanBaseline, sendingResumeId, textPrint, type ApplyState, type FitAsk } from "@/app/lib/apply/state";
import { ATS_BILLING_HREF, isCurrentScore, missingGaps, prepareResumeForDoc, scanCoverage } from "@/app/lib/ats/api";
import type { IngestedResumeDetail } from "@/app/lib/ats/types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { qk } from "@/app/lib/query/keys";
import {
  injectKeywords,
  quantifySuggestions,
  storedBulletIndex,
  tailorToJob,
  type KeywordInjection,
  type ResumePlace,
} from "@/app/lib/resume/ai";
import { applyQuantify, type FitAddition } from "@/app/lib/dashboard/resume/ai-tools";
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
import {
  FixesTabs,
  ScoreRow,
  StuffingNote,
  type GapChip,
  type ScoreState,
  type StuffingNoteView,
  type Suggestion,
} from "../parts/ScoreFixes";
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
/** A keyword run that changed nothing: already there, or no line took it. Asked again, it would do the same. */
const NO_LINE_TOOK = "No line took that cleanly. If you've done it, click the line and say it there.";

/** The history step "Tailor to this job" leaves; read to offer it once per draft. */
const FITTED_LABEL = "Tailored to this job";

const withoutExtension = (name: string) => name.replace(/\.[a-z0-9]{1,5}$/i, "");

/** What a failed save says: never a provider's own words ("Voyage embed timed out after 3000ms"). */
const changeMessage = (error: unknown): string =>
  error instanceof BackendError && error.status >= 500
    ? "Couldn't save that change just now, so nothing changed. Please try again."
    : apiMessage(error);

/** A change that went into the draft: its history step, and the version it was saved as. */
interface CommittedStep {
  stepId: string;
  resumeId: string;
  version: number;
  /** The same text as the version being sent: nothing new to score. */
  unchanged: boolean;
}

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
      void runScan({ resumeId, jdText: job.description, jobId: job.savedJobId, jobTitle: job.role }).then((finished) => {
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
    [runScan, job.description, job.savedJobId, job.role, update, draftVersionNow],
  );

  // Once per resume version: a version already scored (here or before a refresh) is shown, not re-run.
  // A provisional version (an undo still being saved, below zero) waits: the service has the older words.
  useEffect(() => {
    if (!editable || !scoreKey || !sendingId || version === null || version < 0 || !sendingReady || stored) return;
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
  const paperChanges = useMemo(
    () => (content && paperBefore ? changeCount(resumeChanges(paperBefore, content)) : 0),
    [content, paperBefore],
  );

  // ---- Edits made in the resume creator come back -----------------------------------------------
  // Read when this tab is shown again, and once on load, so the preview and the score follow them.
  // Only what changed THERE since this page last wrote or read the copy (review, 2026-10-19: a copy
  // left stale by a later tool, edit or eye here was brought back over it as "your edits").
  const pulling = useRef(false);
  const lastPull = useRef(0);
  const creatorSeen = useRef(resume.creatorSeen);
  /** The creator's copy now says this: kept for the next read, and in the session for after a reload. */
  function sawInCreator(text: string) {
    const seen = textPrint(text);
    creatorSeen.current = seen;
    update((s) => ({ ...s, resume: { ...s.resume, creatorSeen: seen } }));
  }
  // The latest render's `commitChange`, for the listener below: the one it subscribed with saw the
  // draft before it loaded, and turned every pull after a reload away (review, 2026-10-19).
  const commitLatest = useRef<typeof commitChange | null>(null);
  useEffect(() => {
    commitLatest.current = commitChange;
  });
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
        const text = resumeContentToText(copy.content);
        // Unchanged in the creator. A session from before this was kept has nothing to tell by, and
        // compares with the draft as it did.
        if (creatorSeen.current !== null && textPrint(text) === creatorSeen.current) return;
        const current = queryClient.getQueryData<IngestedResumeDetail>(qk.ats.resume(draftId))?.content;
        if (!current) return;
        if (text !== resumeContentToText(current)) {
          const commit = commitLatest.current;
          if (!commit || !(await commit("Edited in the resume creator", copy.content))) return;
          toast.success("Brought in your edits from the resume creator.");
        }
        sawInCreator(text);
      } catch (error) {
        // The copy is gone: the next "Open in editor" makes a new one.
        if (error instanceof BackendError && error.status === 404) {
          creatorSeen.current = null;
          update((s) => ({ ...s, resume: { ...s.resume, creatorDocId: null, creatorSeen: null } }));
        }
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
    // `commitLatest` holds the latest `commitChange`, so this need not re-subscribe (and re-read the copy) on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, resume.creatorDocId, resume.draftId, queryClient, update]);

  // ---- Picking the base ----------------------------------------------------------------------
  function setBase(picked: PickedResume) {
    // What the AI worked in, or could not place, was for the other resume's words (review, 2026-10-19).
    update((s) => ({
      ...s,
      proposal: null,
      resume: { ...s.resume, baseId: picked.resumeId, baseName: picked.name, sendDraft: false, worked: [], asks: [], fitAt: null },
    }));
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
  // "Tailor to this job"'s asks still open where the draft stands: the Tailor that asked is not
  // undone, no "No", and no "Yes" step standing (undo past the "Yes" asks again, owner 2026-10-20).
  const standing = new Set(history.slice(0, historyAt + 1).map((step) => step.id));
  const openAsks = (resume.asks ?? []).filter(
    (ask) => !ask.no && (ask.fromStep === null || standing.has(ask.fromStep)) && !(ask.addedIn !== null && standing.has(ask.addedIn)),
  );

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

  // A tool's change waiting for its score, to be undone if it scores lower (the effect under "The
  // fixes"): the step it made, and the draft version that step was saved as.
  const worseGuard = useRef<{ stepId: string; resumeId: string; version: number } | null>(null);
  // Changes begun on the draft, any kind: a tool whose run saw one start lands over words it never
  // read, so it changes nothing (`runAndCommit`).
  const commits = useRef(0);

  // Undo, redo and a jump are instant (owner, 2026-10-20: "slow and laggy"): saving a version
  // re-embeds it on the service, a second or more, so the page never waits for it. The step's words
  // and score show at once under a provisional version (below zero, never scored), and the saves run
  // here one at a time behind it: only the latest step asked for is written, so ten quick undos make
  // one save. A failed save goes back to the step the service still holds.
  const jumps = useRef<{
    /** The step to write next, under the provisional version it shows as. */
    next: { stepId: string; content: ResumeContent; provisional: number } | null;
    running: Promise<void> | null;
    /** What the service holds: the draft as last saved, and the step it is. */
    held: { detail: IngestedResumeDetail; stepId: string } | null;
    seq: number;
  }>({ next: null, running: null, held: null, seq: 0 });

  /** The saves still waiting: a change waits for them, so it is written over the step the person sees. */
  async function jumpsSaved() {
    while (jumps.current.running) await jumps.current.running;
  }

  /**
   * One change: the words go into the draft, the change becomes the latest step of the history (any
   * steps undone before it are cleared), and the new version is scored. The step it made once it is
   * in, else null.
   */
  async function commitChange(label: string, words: ResumeContent): Promise<CommittedStep | null> {
    const before = content;
    if (!before) return null;
    // Any change is made over a tool's change still waiting for its score: that one is kept. A tool's
    // own change is watched again once it is in (`runAndCommit`).
    worseGuard.current = null;
    commits.current += 1;
    setChangeError(null);
    // An undo or jump still being saved goes first, so this lands over the step the person sees.
    await jumpsSaved();
    const versionNow = draftVersionNow(resume.draftId);
    try {
      const saved = await writeDraft(words);
      queryClient.setQueryData(qk.ats.resume(saved.resumeId), asDetail(saved));
      const at = new Date().toISOString();
      const id = stepId();
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
          id,
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
      return { stepId: id, resumeId: saved.resumeId, version: saved.version, unchanged };
    } catch (error) {
      setChangeError(changeMessage(error));
      return null;
    }
  }

  function saveJumps() {
    const q = jumps.current;
    if (q.running) return;
    q.running = (async () => {
      while (q.next) {
        const job = q.next;
        q.next = null;
        try {
          const saved = await writeDraft(job.content);
          q.held = { detail: asDetail(saved), stepId: job.stepId };
          const key = qk.ats.resume(saved.resumeId);
          // The real version replaces the provisional one, unless a later jump is already showing. The
          // words shown are kept as they are: they are the same, and the page need not draw them again.
          const shown = queryClient.getQueryData<IngestedResumeDetail>(key);
          if (shown?.version === job.provisional) queryClient.setQueryData(key, { ...asDetail(saved), content: shown.content });
          const real = (v: number) => (v === job.provisional ? saved.version : v);
          update((s) => ({
            ...s,
            resume: {
              ...s.resume,
              draftId: saved.resumeId,
              draftName: saved.fileName,
              history: s.resume.history.map((row) => (row.version === job.provisional ? { ...row, version: saved.version } : row)),
            },
            scan: s.scan ? { ...s.scan, version: real(s.scan.version) } : s.scan,
          }));
        } catch (error) {
          // Back to what the service holds, quietly: the line under the card says the change didn't save.
          q.next = null;
          const held = q.held;
          if (held) {
            queryClient.setQueryData(qk.ats.resume(held.detail.resumeId), held.detail);
            update((s) => {
              const index = s.resume.history.findIndex((row) => row.id === held.stepId);
              if (index < 0) return s;
              const shown = scoreOfScan(s.resume.history[index].report).report;
              return {
                ...s,
                resume: { ...s.resume, historyAt: index },
                scan: shown ? { resumeId: held.detail.resumeId, version: held.detail.version, report: shown, previousScore: null } : s.scan,
              };
            });
          }
          setChangeError(changeMessage(error));
        }
      }
    })().finally(() => {
      q.running = null;
    });
  }

  /**
   * Undo, redo or a jump in the history: that step's words and score show at once, and are saved to
   * the draft behind it. True when the draft moved to that step.
   */
  function jumpTo(index: number): boolean {
    const step = history[index];
    const draftId = resume.draftId;
    if (!step || index === historyAt || busy || !draftId) return false;
    // The person's own move: a tool's change still waiting for its score is no longer watched, so a
    // redo is never undone again (review, 2026-10-19).
    worseGuard.current = null;
    commits.current += 1;
    setChangeError(null);
    const q = jumps.current;
    const key = qk.ats.resume(draftId);
    const now = queryClient.getQueryData<IngestedResumeDetail>(key);
    const versionNow = now?.version;
    // Nothing waiting to be saved: the cache is what the service holds, and where a failure goes back to.
    if (now && !q.running && !q.next && history[historyAt]) q.held = { detail: now, stepId: history[historyAt].id };
    q.seq -= 1;
    const provisional = q.seq;
    const shown = scoreOfScan(step.report).report;
    // A read of the draft still on its way would land the older words over these.
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData<IngestedResumeDetail>(key, {
      resumeId: draftId,
      fileName: now?.fileName ?? resume.draftName ?? draftLabel,
      status: "ready",
      error: null,
      content: step.content,
      version: provisional,
    });
    update((s) => ({
      ...s,
      proposal: null,
      resume: {
        ...s.resume,
        sendDraft: true,
        history: leaving(s, versionNow).map((row, i) => (i === index ? { ...row, version: provisional } : row)),
        historyAt: index,
      },
      // The score jumps with it: the step's own report. Nothing is measured against the step left: a
      // jump is not a change, so the card just says "Up to date". A step with no score of today's
      // formula keeps the last scan (another version), so this one is rescored once it is saved.
      scan: shown ? { resumeId: draftId, version: provisional, report: shown, previousScore: null } : s.scan,
    }));
    q.next = { stepId: step.id, content: step.content, provisional };
    saveJumps();
    return true;
  }

  // Ctrl+Z / Ctrl+Shift+Z walk the history while this step shows, outside a text field.
  useEffect(() => {
    if (!actionsSlot || !editable) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      jumpTo(event.shiftKey ? historyAt + 1 : historyAt - 1);
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
  // What the cards read: the resume as it goes, without what is hidden for this job (owner,
  // 2026-10-19: nothing is suggested for, or done to, a hidden part).
  const visible = useMemo(() => (content ? visibleContent({ ...content, hiddenParts: shownHidden }) : null), [content, shownHidden]);

  // Only what is worth adding, and nothing at all once the resume matches enough (owner, 2026-10-19:
  // "Western market experience ... Personalized communication ... that's so cheesy" for a senior at 93).
  const done = report ? matchesEnough(report) : false;
  // What the AI already worked in, still where it put it on the resume as sent: never offered again
  // (50-job run, 2026-10-19: half the picks stayed partly shown, and adding them again added nothing).
  // A term on a line hidden since is gone from what is scored, so its chip comes back (review, 2026-10-19).
  // "Prove" always works in bullets, so what it could not place is read against Bullets alone.
  const worked = visible ? workedIn(state.resume.worked ?? [], visible, places) : new Set<string>();
  const proved = visible ? provedIn(state.resume.worked ?? [], visible) : new Set<string>();
  const worthGaps = done ? [] : gaps.filter((gap) => worthGapChip(verdictById.get(gap.id)) && !worked.has(gap.label.toLowerCase()));
  // What "Tailor to this job" works toward: every gap worth adding, duties included (a duty gets no
  // chip: it is real work to reframe, never a keyword to add).
  const fitGaps = done ? [] : gaps.filter((gap) => fitGap(verdictById.get(gap.id)));
  const gapChips: GapChip[] = worthGaps.map((gap) => ({
    id: gap.id,
    label: gap.label,
    wants: verdictById.get(gap.id)?.requirement.text ?? gap.label,
  }));
  // A skill only in Skills is worth proving in a line only while the scan counts it partly: one Skills
  // already satisfies gains nothing from a bullet (50-job run, 2026-10-19: "Prove" moved no score).
  const proofChips: GapChip[] = (
    done
      ? []
      : (report?.verdicts ?? []).filter(
          (verdict) =>
            onlyInSkills(verdict) &&
            verdict.state === "partial" &&
            !proved.has((verdict.requirement.label?.trim() || verdict.requirement.text).toLowerCase()),
        )
  ).map((verdict) => ({
    id: verdict.requirement.id,
    label: verdict.requirement.label?.trim() || verdict.requirement.text,
    wants: verdict.requirement.text,
  }));
  const working = report ? workingItems(report, content) : [];
  const toolsIdle = editable && Boolean(content) && tools.running === null && !busy;

  // A tool's change that comes back scoring lower than the step before it is undone, and the person
  // told so (50-job run, 2026-10-19: a rewrite for Impact or keywords could cost keyword match). The
  // step stays in the history, so redo brings it back. Never a change the person made by hand: any
  // other change, undo or jump disarms it (review, 2026-10-19), and it waits while an eye's choice or
  // another tool is on its way, so it never says "undone" of a change it could not take back.
  useEffect(() => {
    const pending = worseGuard.current;
    if (!pending) return;
    if (!editable || !sendingDraft) {
      // Tracked, or the Original picked to send: undo would switch the person back to the draft.
      worseGuard.current = null;
      return;
    }
    // Decided once this version's own score is in.
    if (!stored || stored.resumeId !== pending.resumeId || stored.version !== pending.version) return;
    if (busy || tools.running !== null || pendingHidden !== null) return;
    worseGuard.current = null;
    const back = undoIfWorse(history, historyAt, pending.stepId, stored.report);
    if (back === null) return;
    if (jumpTo(back)) toast("That change lowered your score, so it was undone.");
    // jumpTo reads the state it is called with; the guard fires once per tool change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, sendingDraft, stored, history, historyAt, busy, tools.running, pendingHidden]);

  /** Runs a tool, then puts what it wrote into the draft as one change. `nothing` says why, when that is nothing. */
  async function runAndCommit(
    label: string,
    busyText: string,
    run: () => Promise<{ content: ResumeContent } | null>,
    nothing = "Nothing on your resume changed that time. Try again, or click a line to say it yourself.",
  ): Promise<CommittedStep | null> {
    if (!toolsIdle) return null;
    setBusy(busyText);
    setChangeError(null);
    const startedAt = commits.current;
    try {
      const result = await run();
      if (!result || !content) return null;
      // A line retyped, an eye or the creator's edits came in while it ran: the tool's words were
      // made from the resume before that, and would put it back (review, 2026-10-19).
      if (commits.current !== startedAt) {
        setChangeError("Your resume changed while that ran, so nothing was changed. Try again.");
        return null;
      }
      // Never at the cost of what proves a requirement: a line the scan quotes as proof, rewritten so
      // it no longer says it, goes back as it was (owner, 2026-10-19), and the person is told which.
      const guarded = report
        ? keepProof(content, reconcileGroups(result.content), report)
        : { content: reconcileGroups(result.content), kept: [] };
      // Nothing new on the page: said plainly, never a history step that claims a change (owner,
      // 2026-10-19: "no matter the times I add this thing, it does not change anything").
      if (changeCount(resumeChanges(content, guarded.content)) === 0 && guarded.kept.length === 0) {
        setChangeError(nothing);
        return null;
      }
      if (guarded.kept.length > 0) {
        toast(
          `Kept ${guarded.kept.length === 1 ? "a line" : "some lines"} as ${guarded.kept.length === 1 ? "it was" : "they were"}: ${guarded.kept.length === 1 ? "it proves" : "they prove"} ${guarded.kept.join(", ")}.`,
        );
      }
      // Undo goes back to the words this tool started from only on the draft being sent, or on the
      // first change, whose step before it is where the draft started (review, 2026-10-19).
      const undoable = sendingDraft || history.length === 0;
      const made = await commitChange(label, guarded.content);
      // Watched until it is scored: a tool's change that costs points is undone (above).
      if (made && undoable && !made.unchanged) worseGuard.current = { stepId: made.stepId, resumeId: made.resumeId, version: made.version };
      return made;
    } finally {
      setBusy(null);
    }
  }

  const keywordsFor = (terms: string[]) => (terms.length > 0 ? terms.slice(0, MAX_TOOL_GAPS) : null);

  function tailor(words: ResumeContent | null = content, allowed: ResumePlace[] = places) {
    if (!words) return;
    const tailorPlaces = allowed.filter((place) => place === "summary" || place === "skills");
    const summary = tailorPlaces.includes("summary");
    const skills = tailorPlaces.includes("skills");
    if (!summary && !skills) return;
    // Said as what it may touch, never Skills when only the summary goes (review, 2026-10-19).
    // "Tailored" leads every label: `tailoredAlready` reads it.
    const label = summary && skills ? "Tailored summary & skills" : summary ? "Tailored summary" : "Tailored skills";
    const busyText =
      summary && skills ? "Tailoring your summary and skills…" : summary ? "Writing your summary…" : "Tailoring your skills…";
    void runAndCommit(label, busyText, async () => {
      const result = await tools.run("tailor", () =>
        tailorToJob({
          content: words,
          jdText: job.description,
          company: job.company,
          role: job.role,
          // Only what the chips call worth adding: never the nice-to-haves they hide (review, 2026-10-19).
          keywords: keywordsFor(worthGaps.map((gap) => gap.label)),
          places: tailorPlaces,
        }),
      );
      return result ? { content: result.content } : null;
    });
  }

  /**
   * "Tailor to this job" (owner, 2026-10-20): every line weighed against the posting, most kept,
   * some tuned or led with what the job wants, never a fact added. What the job asks for and the
   * resume does not show comes back as asks ("NetSuite, if you have used it"), each a yes or no.
   */
  function tailorWhole() {
    if (!content) return;
    let lines: string[] = [];
    let asks: FitAddition[] = [];
    void runAndCommit(
      FITTED_LABEL,
      "Tailoring your resume to this job…",
      async () => {
        const result = await tools.run("tailor", () =>
          tailorToJob({
            content: { ...content, hiddenParts: shownHidden },
            jdText: job.description,
            company: job.company,
            role: job.role,
            keywords: keywordsFor(fitGaps.map((gap) => gap.label)),
            whole: true,
          }),
        );
        if (!result) return null;
        lines = (result.changed ?? []).map((change) => change.after);
        asks = result.couldAdd ?? [];
        return { content: result.content };
      },
      "Your resume already fits this job.",
    ).then((made) => {
      if (made) showOnPage(lines);
      // Nothing changed: the row hides on this step, and the asks say what is left (never "already fits").
      if (!made) {
        const at = history[historyAt]?.id ?? "start";
        update((s) => ({ ...s, resume: { ...s.resume, fitAt: at } }));
        if (asks.length > 0) setChangeError(null);
      }
      if (asks.length === 0) return;
      // Asked from the step this Tailor made, or from where the draft stood when it changed nothing.
      const fromStep = made?.stepId ?? history[historyAt]?.id ?? null;
      const terms = new Set(asks.map((ask) => ask.term.toLowerCase()));
      update((s) => ({
        ...s,
        resume: {
          ...s.resume,
          asks: [
            ...(s.resume.asks ?? []).filter((ask) => !terms.has(ask.term.toLowerCase())),
            ...asks.map(
              (ask): FitAsk => ({
                term: ask.term,
                ifTrue: ask.ifTrue,
                place: ask.place === "skills" ? "skills" : "experience",
                fromStep,
                no: false,
                addedIn: null,
              }),
            ),
          ],
        },
      }));
    });
  }

  /** The job's title as the resume's headline: one change, undoable like any other. */
  function applyJobTitle(title: string) {
    if (!content || !toolsIdle) return;
    setBusy("Updating your title and rescoring…");
    void commitChange(`Title set to ${title}`, { ...content, title }).finally(() => setBusy(null));
  }

  /** Marks one ask answered: `no`, or the step its "Yes" made. */
  function answerAsk(term: string, answer: { no: true } | { addedIn: string }) {
    update((s) => ({
      ...s,
      resume: {
        ...s.resume,
        asks: (s.resume.asks ?? []).map((ask) =>
          ask.term === term ? { ...ask, ...("no" in answer ? { no: true } : { addedIn: answer.addedIn }) } : ask,
        ),
      },
    }));
  }

  /**
   * An "if true" ask answered yes (owner, 2026-10-20): work the person did goes into the line of
   * their experience where it fits; a tool, a language or a certification is safer in Skills, and so
   * is work no line could take, or a resume with no experience yet. Undo takes it out and asks again.
   */
  function addIfTrue(item: FitAsk) {
    if (!content || !toolsIdle) return;
    const toSkills = (words: ResumeContent, note: string | null) => {
      const next = addSkills(words, [item.term]);
      if (next === words) {
        setChangeError("Already in your Skills.");
        return;
      }
      setBusy(`Adding ${item.term} and rescoring…`);
      void commitChange(`Added ${item.term} to Skills`, next)
        .then((made) => {
          if (!made) return;
          answerAsk(item.term, { addedIn: made.stepId });
          if (note) toast(note);
        })
        .finally(() => setBusy(null));
    };
    if (item.place === "skills" || !content.experience.some((entry) => entry.bullets.length > 0)) {
      toSkills(content, null);
      return;
    }
    let outcome: KeywordInjection | null = null;
    void runAndCommit(`Added ${item.term} to your experience`, `Adding ${item.term} to your experience…`, async () => {
      const result = await tools.run("keywords", () =>
        injectKeywords({
          content,
          jdText: job.description,
          company: job.company,
          role: job.role,
          keywords: [item.term],
          places: ["bullets"],
          insist: true,
          // What the person said yes to, so the line says that work, not only the name.
          hints: { [item.term]: { means: item.ifTrue, proof: [] } },
        }),
      );
      outcome = result;
      return result ? { content: result.content } : null;
    }).then((made) => {
      if (made) {
        answerAsk(item.term, { addedIn: made.stepId });
        if (outcome) tellKeywords(outcome);
        return;
      }
      // The AI answered but no line took it: Skills, said so. A failed call keeps the ask.
      if (outcome && content) {
        setChangeError(null);
        toSkills(content, `No line in your experience fit ${item.term}, so it went into Skills.`);
      }
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
      void runAndCommit(
        `Worked ${n} ${noun} into ${where}`,
        `Working ${n} ${noun} into ${where}…`,
        async () => {
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
        },
        NO_LINE_TOOK,
      ).then((made) => {
        // Kept even when nothing changed: what it found already there, or could place nowhere, is
        // never offered again to change nothing (50-job run, 2026-10-19).
        if (outcome) rememberWorked(outcome, places);
        if (!made) return;
        setPicked(new Set());
        if (outcome) tellKeywords(outcome);
      });
      return;
    }
    const words = addSkills(content, labels);
    // Every one listed already: nothing would change, so no step says it did (review, 2026-10-19).
    if (words === content) {
      setChangeError("Already in your Skills.");
      return;
    }
    setBusy(`Adding ${labels.length} ${labels.length === 1 ? "keyword" : "keywords"} and rescoring…`);
    void commitChange(`Added ${labels.length} ${labels.length === 1 ? "keyword" : "keywords"} to Skills`, words).then((made) => {
      if (made) setPicked(new Set());
      setBusy(null);
    });
  }

  /**
   * Keeps the keywords this run worked in, with where, so they are not offered again while they
   * stand; and what it tried and could place nowhere, with the places it tried (`tried`): asked again
   * there it would add nothing, but another place may take it (review, 2026-10-19).
   */
  function rememberWorked(outcome: KeywordInjection, tried: readonly ResumePlace[]) {
    // One no line took went into Skills for now: the lines it was tried in would not take it either.
    const lineTried = tried.filter((place) => place !== "skills");
    const placed = [
      ...Object.entries(outcome.placed ?? {}).map(([label, lines]) => ({ label, lines })),
      ...[...outcome.missed, ...(outcome.notShown ?? []).map((note) => note.term)].map((label) => ({ label, lines: [TRIED, ...tried] })),
      ...(lineTried.length > 0 ? (outcome.skillsOnly ?? []).map((label) => ({ label, lines: [TRIED, ...lineTried] })) : []),
    ];
    if (placed.length === 0) return;
    const labels = new Set(placed.map((term) => term.label.toLowerCase()));
    update((s) => ({
      ...s,
      resume: { ...s.resume, worked: [...(s.resume.worked ?? []).filter((term) => !labels.has(term.label.toLowerCase())), ...placed] },
    }));
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
    let outcome: KeywordInjection | null = null;
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
        outcome = result;
        return result ? { content: result.content } : null;
      },
      NO_LINE_TOOK,
    ).then(() => {
      if (outcome) rememberWorked(outcome, ["bullets"]);
    });
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
        .map((proposal) => ({
          ...proposal,
          bulletIndex: storedBulletIndex(sent.experience[proposal.entryIndex].bullets, proposal.bulletIndex),
        }))
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
  // A summary to write: none yet, shown, something worth adding, and not written already in this
  // draft's history. Never "tailor the one you have": across 50 jobs it helped 3 times in 21, failed
  // the writing rules 8 and changed nothing 9 (2026-10-19). A summary hidden for this job is the
  // person's choice, so it gets no row either (review, 2026-10-19: "Summary is hidden. Tailor it" ran
  // that same tailor, and kept "Nothing left to add" from showing at 90 and over).
  // Any written for this draft, undone or not: one the score took back is never offered again at once.
  const tailoredAlready = history.some((step) => step.label.startsWith("Tailored s"));
  // Undone, it can be run again: only the steps up to where the person stands count.
  const fittedAlready = history.slice(0, historyAt + 1).some((step) => step.label === FITTED_LABEL);
  // The job's title as a resume headline: what comes before a comma or a dash ("Chief Compliance
  // Officer, Ramp Advisory LLC" is "Chief Compliance Officer").
  const titleFit = report?.titleFit ?? null;
  const headlineTitle = (job.role ?? "").split(/\s*(?:,|\s[-–|]\s|\()\s*/)[0].trim().slice(0, 120) || null;
  const fold = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
  const summaryMissing = Boolean(visible) && !summaryHidden && !tailoredAlready && !summaryText && worthGaps.length > 0;
  // A language the posting asks for and the resume never states, only one worth adding as the chips
  // are (`languageAsk`): the person picks their level, and it goes into Skills as one plain line the
  // scorer reads ("English: fluent (C1)").
  const language = !done && report && visible && !shownHidden.includes("skills") ? languageAsk(report, visible) : null;
  function addLanguage(level: string) {
    if (!content || !language || !toolsIdle) return;
    const line = `${language.language}: ${level}`;
    setBusy(`Adding ${line} and rescoring…`);
    // A bare "English" the keyword tool once added makes way for the line with the level.
    const words = addSkills(removeSkills(content, [language.language]), [line]);
    void commitChange(`Added ${line} to Skills`, words).finally(() => setBusy(null));
  }
  const levelChoices = LANGUAGE_LEVELS.map((level) => ({
    label: level[0].toUpperCase() + level.slice(1),
    onClick: () => addLanguage(level),
  }));
  /** The chip of the language the card would ask about: it asks for the level itself (owner, 2026-10-19). */
  function isLanguageChip(chip: GapChip): boolean {
    return language !== null && namesLanguage(`${chip.label} ${chip.wants}`, language.language);
  }
  const shownChips: GapChip[] = gapChips.map((chip) =>
    isLanguageChip(chip)
      ? {
          ...chip,
          choices: { title: language?.level ? `Asks for ${language.level}. Yours:` : "Your level:", options: levelChoices },
        }
      : chip,
  );
  const languageOnChip = gapChips.some(isLanguageChip);
  const suggestions: Suggestion[] = [
    ...(language && !languageOnChip
      ? [
          {
            id: "language",
            title: `Add your ${language.language} level.`,
            action: "",
            icon: "tailor" as const,
            choices: levelChoices,
          },
        ]
      : []),
    // The lines Impact language marks down, only while it reads low (owner, 2026-10-19: "show me what
    // impact language looks at", then "three bullets, bruh" at 89): a click lights them, "Fix them" mends them.
    ...(impact !== undefined && impact !== null && impact < IMPACT_WORTH_FIXING_BELOW && misses && misses.lines.length > 0
      ? [
          {
            id: "impact",
            title: `Strengthen ${misses.lines.length} ${misses.lines.length === 1 ? "bullet" : "bullets"} points for impact.`,
            action: "Fix them",
            icon: "quantify" as const,
            onClick: () => strengthen(),
            onShow: () => showOnPage(misses.lines, "experience"),
          },
        ]
      : []),
    // The job's title as the headline, unless it already reads the same (owner, 2026-10-20): the
    // title counts toward keyword match, so it is one of the fixes.
    ...(content && visible && headlineTitle && titleFit && titleFit.kind !== "same" && fold(content.title ?? "") !== fold(headlineTitle)
      ? [
          {
            id: "title",
            title: `Use "${headlineTitle}" as your title.`,
            action: "Use it",
            icon: "tailor" as const,
            onClick: () => applyJobTitle(headlineTitle),
          },
        ]
      : []),
    // The whole resume toward the job, once per draft, while anything is still worth adding. Hidden
    // while its asks are open, and on the step it last changed nothing on (owner, 2026-10-20).
    ...(!done && content && visible && !fittedAlready && openAsks.length === 0 && resume.fitAt !== (history[historyAt]?.id ?? "start") && fitGaps.length > 0
      ? [
          {
            id: "fit",
            title: "Tailor CV to this job.",
            action: "Tailor",
            icon: "tailor" as const,
            onClick: () => tailorWhole(),
          },
        ]
      : []),
    // What the job asks for that the resume does not show: only added on a yes (owner, 2026-10-20).
    ...openAsks.map((item) => ({
      id: `if-true-${item.term}`,
      title: item.ifTrue,
      action: "",
      icon: "tailor" as const,
      choices: [
        { label: "Yes, add it", onClick: () => addIfTrue(item) },
        { label: "No", onClick: () => answerAsk(item.term, { no: true }) },
      ],
    })),
    ...(summaryMissing && content
      ? [
          {
            id: "tailor",
            title: "No summary yet.",
            action: "Write one",
            icon: "tailor" as const,
            // The summary only: a run that also rewrote Skills could cost the score (50-job run, 2026-10-19).
            onClick: () => tailor(content, ["summary"]),
          },
        ]
      : []),
  ];

  // The points-off note, until it is kept as is for this score. The skills it is about are named
  // here from the resume (the scorer's own line only says how many), so each can be acted on.
  const UNBACKED_REASON = /appear nowhere in your experience$/;
  const unbacked =
    report && visible && (report.stuffing ?? []).some((reason) => UNBACKED_REASON.test(reason)) ? unbackedSkills(visible, report) : [];
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
    void commitChange(`Removed ${n} ${n === 1 ? "skill" : "skills"} from Skills`, removeSkills(content, unbacked)).finally(() =>
      setBusy(null),
    );
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
      // What the copy says now: a later change here is never overwritten by it.
      sawInCreator(resumeContentToText(words));
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
        createPortal(<DraftHistory history={history} at={historyAt} onJump={jumpTo} disabled={!editable || Boolean(busy)} />, actionsSlot)}

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
          <div className="flex flex-col gap-2.5 lg:flex-row">
            {/* Side by side only once each card has room for a file name; stacked beside the sidebar on a tablet. */}
            {resume.draftId && (
              <ResumeCard
                name={draftName}
                meta={
                  draft.isPending ? (
                    <Bone className="mt-1 h-2.5 w-40" />
                  ) : draft.isError ? (
                    "Couldn't open it just now"
                  ) : (
                    `Draft for this job · ${changes} ${changes === 1 ? "change" : "changes"}`
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
                  "Original"
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
                      .join(" and ")} hidden.`
                  : editable
                    ? "Click a line to edit it."
                    : null}
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
          {/* A line being retyped is the person's own work: the undo for a tool's change would re-render it and wipe the typing (review, 2026-10-19). */}
          <div
            ref={paperRef}
            onFocusCapture={() => {
              worseGuard.current = null;
            }}
            className="bg-[#ecece6] px-4 py-7 sm:px-7">
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
                  editable
                    ? { hidden: shownHidden, onToggle: toggleHidden, experienceIds: content.experience.map((entry) => entry.id) }
                    : undefined
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
      // min-w-0: side by side, a long file name truncates instead of pushing "Sending" and the menu off the card.
      "flex min-h-[60px] min-w-0 flex-1 items-center gap-3 rounded-xl bg-white pl-3.5 pr-2.5",
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
