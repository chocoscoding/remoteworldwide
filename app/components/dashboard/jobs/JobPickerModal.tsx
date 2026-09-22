"use client";

// The job picker's dialog. Opened only through `useJobPicker()`
// (./JobPickerProvider); no screen mounts it directly.
//
// Built on the Radix primitives rather than `components/ui/dialog` so the
// overlay can carry a blur — the shared DialogContent hardcodes a flat
// `bg-black/80`, and changing it there would repaint every other modal.
//
// Focus and stacking are each deliberate, for a bug the old dialog had or
// would have had nested inside the win log:
//
// - No `autoFocus`. React runs it before this dialog's focus scope pauses the
//   win log's, so the win log pulls focus back and it lands on its close
//   button. `onOpenAutoFocus` runs once this scope is in charge.
// - `onCloseAutoFocus` returns focus to whatever was focused when `pickJob`
//   was called or, when a screen re-rendered that element away, to the dialog
//   underneath (see `restoreFocusAfterClose`). No `Dialog.Trigger` is
//   involved, so Radix alone would drop it on <body> every time.
// - Overlay and content sit at z-[60], above the win log's z-50. Escape and
//   outside clicks already reach only the topmost dialog.
// - No Radix Select: its own dismissable layer, torn down while open, can leave
//   <body> at pointer-events:none and freeze the dashboard. And no toasts:
//   clicking one while the win log is open counts as an outside click and
//   throws the win log's draft away. Every error and success here is inline.

import { useEffect, useId, useReducer, useRef, useState, type FC, type FormEvent, type ReactNode, type RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronDown, Chrome, CircleAlert, ClipboardPaste, Loader2, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import AutoGrowTextarea from "@/app/components/dashboard/ui/AutoGrowTextarea";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import LogoMini from "@/app/components/svg/LogoMini";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { EXTENSION_URL, useExtensionPresence } from "@/app/lib/extension/presence";
import {
  JOB_FIELD_META,
  unfilledRequiredFields,
  type JobField,
  type ParsedFieldSpec,
  type PickerStatus,
  type PickerTab,
} from "@/app/lib/jobs/fields";
import type { JobImportItem, JobSource, PlatformJobSearchItem, SavedJobItem } from "@/app/lib/jobs/types";
import { useJobImport } from "@/hooks/queries/useJobImport";
import { savedJobQuery, useDebouncedValue, usePlatformJobSearch, useSavedJobsQuery } from "@/hooks/queries/useJobQueries";
import { forgetJobImport, useSaveJob, useStartJobImport, useUpdateSavedJob } from "@/hooks/mutations/useJobMutations";
import {
  DESCRIPTION_MAX_CHARS,
  WAIT_AFTER_MS,
  changesForUpdate,
  enrichFailureMessage,
  fieldsNeedingExtraction,
  importFailureCopy,
  initialPickerState,
  isLastingEnrichRefusal,
  linkFrom,
  listAnnouncement,
  pickerReducer,
  pickerStatusOf,
  planForm,
  runningKey,
  saveInputFrom,
  stageCopy,
  watchedImportId,
  type ImportFailureCode,
  type RecoveryAction,
} from "./pickerReducer";

export interface JobPickerModalProps {
  sessionId: number;
  open: boolean;
  parsed: ParsedFieldSpec;
  title: string | undefined;
  initialTab: PickerTab;
  returnFocus: HTMLElement | null;
  onStatusChange: (sessionId: number, status: PickerStatus) => void;
  onCancel: (sessionId: number) => void;
  onPicked: (sessionId: number, job: SavedJobItem) => void;
  /** Whether the backend already refused to enrich this job's current description. Held by the provider, so it outlives this dialog. */
  isEnrichRefused: (job: SavedJobItem) => boolean;
  /** Records a refusal that would repeat, so the next pick of the same text does not ask again. */
  onEnrichRefused: (job: SavedJobItem) => void;
}

const FIELD =
  "w-full rounded-xl border-[1.5px] border-black/14 bg-white px-3.5 py-2 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]";

const LABEL = "mb-1 block text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55";

/** The small sticker buttons a recovery offers. */
const RECOVERY =
  "inline-flex cursor-pointer items-center rounded-md border-[1.5px] border-[#222325] bg-white px-2.5 py-1 text-xs font-bold text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

const TAB_OPTIONS: { id: PickerTab; label: string }[] = [
  { id: "platform", label: "From Remote Worldwide" },
  { id: "paste", label: "Paste a job" },
];

const PLACEHOLDERS: Partial<Record<JobField, string>> = {
  company: "e.g. Stripe",
  role: "e.g. Senior Product Designer",
  description: "What the posting says — requirements, responsibilities, anything worth scoring against…",
  url: "https://…",
  salary: "e.g. $120k–150k, or leave blank",
  location: "e.g. Remote, Europe",
};

const SOURCE_LABELS: Record<JobSource, string> = {
  platform: "From Remote Worldwide",
  link: "Added from a link",
  paste: "Pasted by you",
  manual: "Added by you",
};

/** Often enough to cross WAIT_AFTER_MS on time and to count seconds smoothly. */
const TICK_MS = 500;

/**
 * Milliseconds the run named `runKey` has been going, re-read every TICK_MS;
 * 0 when nothing runs.
 *
 * The clock is read in the effect, never during render (one render could
 * otherwise show two different times) and never in the handlers that start a
 * run. Each reading carries its run's key, so a new run shows 0 from its first
 * render instead of, for a frame, the previous run's time — which past
 * WAIT_AFTER_MS would flash the waiting state.
 */
function useElapsed(runKey: string | null): number {
  const [reading, setReading] = useState<{ key: string; ms: number } | null>(null);
  useEffect(() => {
    if (runKey === null) return;
    const startedAt = Date.now();
    const handle = window.setInterval(() => setReading({ key: runKey, ms: Date.now() - startedAt }), TICK_MS);
    return () => window.clearInterval(handle);
  }, [runKey]);
  return runKey !== null && reading?.key === runKey ? reading.ms : 0;
}

const fieldId = (uid: string, field: JobField) => `${uid}-job-${field}`;

const initials = (company: string | null) => (company ?? "").trim().slice(0, 2).toUpperCase() || "?";

const jobTitle = (job: Pick<SavedJobItem, "company" | "role">) =>
  `${job.company ?? "Untitled company"} — ${job.role ?? "untitled role"}`;

/**
 * A 400 on the POST itself is the route's validator refusing the input before
 * any import existed. For a link, that is the link. For text, the only rule
 * this dialog can break is the length cap (it never sends empty text), and the
 * backend answers that with 400, not 413. Read as `request-failed`, it would
 * offer "Try again", which re-sends the same text into the same refusal.
 */
function requestFailureCode(error: unknown, link: boolean): ImportFailureCode {
  if (error instanceof BackendError) {
    if (error.status === 400) return link ? "invalid-url" : "too-long";
    if (error.status === 413) return "too-long";
  }
  return "request-failed";
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/**
 * Rides under the import form the way store promos do — but in this system's
 * clothes, and pitching the honest alternative to pasting: the extension saves
 * the posting from the careers page itself.
 *
 * It renders for exactly one person: someone who could install it and has not.
 * Nothing at all until `NEXT_PUBLIC_EXTENSION_URL` names a real listing, and
 * nothing for a browser that already answered the presence ping — selling
 * somebody the thing they are running is how a promo loses its credibility.
 * The old copy claimed a 4.9 rating and a Chrome Web Store feature; both were
 * invented, and neither is coming back without a listing to read them off.
 */
const ExtensionPromo: FC = () => {
  const { status } = useExtensionPresence();
  if (!EXTENSION_URL || status !== "absent") return null;

  return (
    <div className="mt-3 flex flex-none items-center gap-4 rounded-2xl border-[1.5px] border-[#222325] bg-[#222325] p-4 shadow-[4px_4px_0_0_#e1f073]">
      <span className="grid h-11 w-11 flex-none place-content-center rounded-xl bg-[#e1f073]">
        <Chrome className="h-5 w-5 text-[#222325]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">Skip the pasting next time</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/60">
          The Chrome extension saves any posting straight to your jobs, in one click, from the careers page itself.
        </p>
      </div>
      <a
        href={EXTENSION_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="flex-none rounded-lg border-[1.5px] border-white/30 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-white">
        Get it
      </a>
    </div>
  );
};

/** Only a real web address goes into an <img>: logos are whatever the posting named. */
const logoSrc = (url: string | null): string | null => (url && /^https?:\/\//i.test(url) ? url : null);

/**
 * The company's logo when the posting has one, and its initials on ink when it
 * has none — or when the logo fails to load, since a broken image reads worse
 * than no image.
 */
const CompanyMark: FC<{ company: string | null; logo: string | null }> = ({ company, logo }) => {
  const [broken, setBroken] = useState(false);
  const src = logoSrc(logo);

  if (src && !broken) {
    return (
      // A plain <img>, as in Avatar.tsx: logos come from whatever host a posting
      // names, and next/image would need every one of them in remotePatterns.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setBroken(true)}
        className="h-9 w-9 flex-none rounded-lg border border-black/10 bg-white object-contain p-1"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#222325] text-[11px] font-extrabold text-white">
      {initials(company)}
    </span>
  );
};

interface JobRowProps {
  company: string | null;
  logo: string | null;
  role: string | null;
  subtitle: string;
  platform: boolean;
  pending: boolean;
  disabled: boolean;
  onPick: () => void;
}

const JobRow: FC<JobRowProps> = ({ company, logo, role, subtitle, platform, pending, disabled, onPick }) => (
  <button
    type="button"
    onClick={onPick}
    disabled={disabled}
    aria-busy={pending || undefined}
    className={cn(
      "group flex w-full items-center gap-3 border-b border-black/10 px-6 py-3.5 text-left last:border-b-0 cursor-pointer transition-colors hover:bg-[#fbfbf7] disabled:cursor-default",
      disabled && !pending && "opacity-50",
    )}>
    <CompanyMark key={logo ?? ""} company={company} logo={logo} />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5">
        <span className="truncate text-sm font-bold text-primary group-hover:underline underline-offset-2">
          {jobTitle({ company, role })}
        </span>
        {platform && <LogoMini className="h-3 w-3 flex-none" />}
      </span>
      <span className="block truncate text-xs text-black/45">{subtitle}</span>
    </span>
    {pending ? (
      <Loader2 className="h-4 w-4 flex-none animate-spin text-black/60" />
    ) : (
      <ArrowRight className="h-4 w-4 flex-none text-black/25 transition-colors group-hover:text-black/60" />
    )}
  </button>
);

const SectionLabel: FC<{ children: ReactNode }> = ({ children }) => (
  <h3 className="border-b border-black/10 bg-[#fbfbf7] px-6 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55">
    {children}
  </h3>
);

const ListSkeleton: FC<{ rows: number }> = ({ rows }) => (
  <div aria-hidden>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center gap-3 border-b border-black/10 px-6 py-3.5">
        <span className="h-9 w-9 flex-none animate-pulse rounded-lg bg-[#f0f0ea]" />
        <span className="flex-1 space-y-1.5">
          <span className="block h-3 w-2/3 animate-pulse rounded bg-[#f0f0ea]" />
          <span className="block h-2.5 w-1/3 animate-pulse rounded bg-[#f0f0ea]" />
        </span>
      </div>
    ))}
  </div>
);

// An alert, like every other failure in the dialog: someone typing into the
// search box is not looking at the list, and would otherwise never learn that
// the search failed or that a Retry is there.
const ListNotice: FC<{ children: ReactNode; onRetry: () => void }> = ({ children, onRetry }) => (
  <p role="alert" className="flex items-center justify-between gap-3 border-b border-black/10 px-6 py-3 text-xs text-[#b23c26]">
    <span className="flex items-center gap-1.5">
      <CircleAlert className="h-3.5 w-3.5 flex-none" />
      {children}
    </span>
    <button type="button" onClick={onRetry} className="flex-none cursor-pointer font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
      Retry
    </button>
  </p>
);

/** The waiting state: the live stage, how long it has run, and a way out. */
const RunningNotice: FC<{ stage: string; seconds: number; onCancel: () => void }> = ({ stage, seconds, onCancel }) => (
  <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-black/12 bg-[#fbfbf7] px-3 py-2">
    <Loader2 className="h-3.5 w-3.5 flex-none animate-spin text-black/60" />
    <p className="min-w-0 flex-1 text-xs text-black/60">
      {/* Only the stage is announced; a live region around a ticking counter would read out every second. */}
      <span role="status" className="font-semibold text-primary">
        {stage}
      </span>
      <span aria-hidden className="ml-1.5 tabular-nums text-black/45">
        {seconds}s
      </span>
    </p>
    <button
      type="button"
      onClick={onCancel}
      className="flex-none cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-black/60 transition-colors hover:bg-black/[0.05] hover:text-primary">
      Cancel
    </button>
  </div>
);

const ErrorNotice: FC<{ message: string; children?: ReactNode }> = ({ message, children }) => (
  <div role="alert" className="mt-2.5 rounded-lg border border-[#b23c26]/25 bg-[#b23c26]/[0.04] px-3 py-2">
    <p className="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-[#b23c26]">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" />
      {message}
    </p>
    {children ? <div className="mt-2 flex flex-wrap gap-2 pl-5">{children}</div> : null}
  </div>
);

// ---------------------------------------------------------------------------
// The dialog
// ---------------------------------------------------------------------------

/**
 * Where focus goes once the dialog has closed.
 *
 * First choice: the element `pickJob` was called from, while it is still on
 * the page. Many screens replace that element the moment a pick succeeds,
 * though ("Pick a job" becomes the job; the win log's "Import a job" becomes
 * its Company and Role inputs). Then:
 *
 * - If something already has focus, the screen put it there, so it stays.
 * - If the picker was opened from inside another dialog (the win log), focus
 *   goes to that dialog. Left on <body>, the next Tab lands behind it, and its
 *   focus trap can only try to refocus the button that just unmounted, so focus
 *   escapes into the page it hides. The move waits a tick: Radix calls this
 *   while the picker's focus scope still holds the win log's paused, and a focus
 *   the paused scope never sees leaves its trap pointing at that dead button.
 * - Otherwise focus stays on <body>, where the browser left it. A plain screen
 *   has no element that stands in for the one that went.
 */
function restoreFocusAfterClose(returnFocus: HTMLElement | null) {
  if (returnFocus?.isConnected) {
    returnFocus.focus({ preventScroll: true });
    return;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && active.isConnected) return;
  // By now the picker's own content has left the DOM, so the last open dialog is the one underneath.
  const open = document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
  const underneath = open[open.length - 1];
  if (!underneath) return;
  window.setTimeout(() => {
    const now = document.activeElement;
    if (underneath.isConnected && (now === null || now === document.body)) underneath.focus({ preventScroll: true });
  }, 0);
}

const JobPickerModal: FC<JobPickerModalProps> = (props) => {
  const { sessionId, open, initialTab, returnFocus, onCancel } = props;
  const searchRef = useRef<HTMLInputElement | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel(sessionId);
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (initialTab === "paste" ? pasteRef.current : searchRef.current)?.focus();
          }}
          onCloseAutoFocus={(event) => {
            // Always decided here. Radix's own fallback focuses the
            // Dialog.Trigger, and without one that means <body>.
            event.preventDefault();
            restoreFocusAfterClose(returnFocus);
          }}
          // Transparent shell: the dialog body and the extension promo are two
          // separate cards inside it. A flex column capped to the viewport —
          // the shell itself never scrolls; if anything overflows, it scrolls
          // INSIDE the white card while the promo stays pinned below.
          className="fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100vh-40px)] w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Inside Content, so all of its state unmounts with the dialog (after
              the exit animation), and a running import is abandoned then. */}
          <PickerBody {...props} searchRef={searchRef} pasteRef={pasteRef} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default JobPickerModal;

interface PickerBodyProps extends JobPickerModalProps {
  searchRef: RefObject<HTMLInputElement | null>;
  pasteRef: RefObject<HTMLTextAreaElement | null>;
}

const PickerBody: FC<PickerBodyProps> = ({
  sessionId,
  parsed,
  title,
  initialTab,
  onStatusChange,
  onPicked,
  isEnrichRefused,
  onEnrichRefused,
  searchRef,
  pasteRef,
}) => {
  const uid = useId();
  const queryClient = useQueryClient();
  const plan = planForm(parsed);
  const [state, dispatch] = useReducer(pickerReducer, { initialTab, gate: plan.gate }, initialPickerState);
  const { phase } = state;

  const saveJob = useSaveJob({ toastErrors: false });
  const updateJob = useUpdateSavedJob({ toastErrors: false });
  const startImport = useStartJobImport({ toastErrors: false });

  // Bumped by every flow that awaits: a pick, an import, a save, an enrichment.
  // A result that comes back after the user moved on sees a different run and
  // drops itself, so a slow answer can never act on a dialog that has moved on.
  const runRef = useRef(0);
  // The import this dialog is still responsible for; abandoned if it closes first.
  const inflightRef = useRef<string | null>(null);

  // --- Lists ------------------------------------------------------------------
  const onPlatformTab = state.tab === "platform";
  const searchText = useDebouncedValue(state.query.trim());
  const savedJobs = useSavedJobsQuery(searchText, { enabled: onPlatformTab });
  const listings = usePlatformJobSearch(searchText, { enabled: onPlatformTab });

  // --- Time -------------------------------------------------------------------
  const elapsedMs = useElapsed(runningKey(phase));
  const waiting = elapsedMs >= WAIT_AFTER_MS;
  const seconds = Math.floor(elapsedMs / 1000);
  const status = pickerStatusOf(phase, waiting);

  useEffect(() => {
    onStatusChange(sessionId, status);
  }, [onStatusChange, sessionId, status]);

  useEffect(() => {
    const request = state.focus;
    if (!request) return;
    const target =
      request.target === "search"
        ? searchRef.current
        : request.target === "paste"
          ? pasteRef.current
          : document.getElementById(fieldId(uid, request.target));
    target?.focus();
  }, [state.focus, searchRef, pasteRef, uid]);

  useEffect(() => {
    const inflight = inflightRef;
    const runs = runRef;
    return () => {
      // A POST still out when the dialog goes (Escape, a route change, a pick
      // that replaces this one) has no id to abandon yet. Moving the run on
      // sends its late answer down the stale-run branch, which abandons the
      // import the moment its id arrives.
      runs.current += 1;
      const id = inflight.current;
      inflight.current = null;
      if (id) forgetJobImport(queryClient, id);
    };
  }, [queryClient]);

  // --- Delivering a job ------------------------------------------------------

  /**
   * The last step of every path to a job: a listing, a saved job, a save.
   * Required fields the job lacks send it to the form to be finished; derived
   * fields it could still get start one extraction; otherwise it resolves.
   */
  async function deliver(job: SavedJobItem, run: number) {
    const missing = unfilledRequiredFields(job, plan.gate);
    if (missing.length > 0) {
      dispatch({ type: "complete", job, missing });
      return;
    }
    if (fieldsNeedingExtraction(job, parsed, isEnrichRefused(job)).length === 0) {
      onPicked(sessionId, job);
      return;
    }
    dispatch({ type: "enrichStart", run, job });
    try {
      const started = await startImport.mutateAsync({ savedJobId: job.id });
      if (runRef.current !== run) {
        forgetJobImport(queryClient, started.importId);
        return;
      }
      inflightRef.current = started.importId;
      dispatch({ type: "enrichAccepted", run, importId: started.importId });
    } catch (error) {
      if (runRef.current !== run) return;
      dispatch({ type: "enrichFailed", run, job, message: apiMessage(error) });
    }
  }

  async function finishEnrichment(job: SavedJobItem, run: number, item: JobImportItem) {
    if (item.status !== "done") {
      // A refusal that will repeat is remembered past this dialog, and offers no
      // retry here: another try is another model call with the same answer.
      const lasting = isLastingEnrichRefusal(item);
      if (lasting) onEnrichRefused(job);
      dispatch({ type: "enrichFailed", run, job, message: enrichFailureMessage(item), retryable: !lasting });
      return;
    }
    try {
      // Re-read rather than reuse: the extraction wrote to the saved row, and
      // only a fresh GET carries what it found.
      const fresh = await queryClient.fetchQuery({ ...savedJobQuery(job.id), staleTime: 0 });
      if (runRef.current !== run) return;
      // Resolved without looping back into another extraction: this job has had its one.
      if (unfilledRequiredFields(fresh, plan.gate).length > 0) dispatch({ type: "complete", job: fresh, missing: unfilledRequiredFields(fresh, plan.gate) });
      else onPicked(sessionId, fresh);
    } catch (error) {
      if (runRef.current !== run) return;
      dispatch({ type: "enrichFailed", run, job, message: apiMessage(error) });
    }
  }

  function handleImportSettled(item: JobImportItem) {
    if (inflightRef.current === item.id) inflightRef.current = null;
    if (phase.kind === "importing" && phase.importId === item.id) {
      dispatch({ type: "importSettled", run: phase.run, item });
    } else if (phase.kind === "enriching" && phase.importId === item.id) {
      void finishEnrichment(phase.job, phase.run, item);
    }
  }

  function handleImportPollError(error: unknown, importId: string) {
    // The import itself may still be running, so it stays ours to abandon on
    // close; a retry for the same posting gets the same id back and resumes.
    if (phase.kind === "importing" && phase.importId === importId) {
      dispatch({ type: "importRequestFailed", run: phase.run, code: "request-failed", message: apiMessage(error) });
    } else if (phase.kind === "enriching" && phase.importId === importId) {
      dispatch({ type: "enrichFailed", run: phase.run, job: phase.job, message: apiMessage(error) });
    }
  }

  const watch = useJobImport(watchedImportId(phase), { onSettled: handleImportSettled, onError: handleImportPollError });

  // --- Derived ----------------------------------------------------------------
  const importing = phase.kind === "importing";
  const saving = phase.kind === "saving";
  const busy = importing || saving || phase.kind === "picking" || phase.kind === "enriching";
  const missingForSave = unfilledRequiredFields(state.values, plan.gate);
  const enrichView = phase.kind === "enriching" || phase.kind === "enrichError" ? phase : null;

  // --- The Remote Worldwide tab ---------------------------------------------

  async function pickListing(listing: PlatformJobSearchItem) {
    const run = ++runRef.current;
    const target = `listing:${listing.id}`;
    dispatch({ type: "pickStart", target });
    try {
      // Every pick upserts a saved job, so the id the caller gets means the same
      // thing on every screen and survives the listing being edited or deleted.
      const job = await saveJob.mutateAsync({ platformJobId: listing.id });
      if (runRef.current !== run) return;
      await deliver(job, run);
    } catch (error) {
      if (runRef.current !== run) return;
      dispatch({ type: "pickFailed", target, message: apiMessage(error) });
    }
  }

  async function pickSaved(item: SavedJobItem) {
    const run = ++runRef.current;
    const target = `saved:${item.id}`;
    dispatch({ type: "pickStart", target });
    try {
      // The list row can be a stale-time old; the detail read is what the caller gets.
      const job = await queryClient.fetchQuery(savedJobQuery(item.id));
      if (runRef.current !== run) return;
      await deliver(job, run);
    } catch (error) {
      if (runRef.current !== run) return;
      dispatch({ type: "pickFailed", target, message: apiMessage(error) });
    }
  }

  // --- The paste tab ---------------------------------------------------------

  function handleFill() {
    const input = state.raw.trim();
    if (input === "" || busy) return;
    const run = ++runRef.current;
    const link = linkFrom(input);
    dispatch({ type: "importStart", run, input: link ? "link" : "text", link });
    startImport.mutateAsync(link ? { url: link } : { text: input }).then(
      (started) => {
        if (runRef.current !== run) {
          forgetJobImport(queryClient, started.importId);
          return;
        }
        inflightRef.current = started.importId;
        dispatch({ type: "importAccepted", run, importId: started.importId });
      },
      (error: unknown) => {
        if (runRef.current !== run) return;
        dispatch({ type: "importRequestFailed", run, code: requestFailureCode(error, link !== null), message: apiMessage(error) });
      },
    );
  }

  function handleCancelImport() {
    if (phase.kind !== "importing") return;
    runRef.current += 1;
    watch.stop();
    const id = inflightRef.current ?? phase.importId;
    inflightRef.current = null;
    if (id) forgetJobImport(queryClient, id);
    dispatch({ type: "importCancelled", run: phase.run });
  }

  function recover(action: RecoveryAction) {
    switch (action) {
      case "edit-input": {
        const box = pasteRef.current;
        box?.focus();
        box?.select();
        return;
      }
      case "paste-text":
        dispatch({ type: "pasteText" });
        return;
      case "fill-in":
        dispatch({ type: "dismiss", focus: missingForSave[0] ?? "company" });
        return;
      case "retry":
        handleFill();
        return;
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (busy || missingForSave.length > 0) return;
    const run = ++runRef.current;
    const editing = state.editing;
    dispatch({ type: "saveStart" });
    try {
      let job: SavedJobItem;
      if (editing) {
        const changes = changesForUpdate(editing, state.values);
        job = Object.keys(changes).length > 0 ? await updateJob.mutateAsync({ id: editing.id, input: changes }) : editing;
      } else {
        // A 200 "Already in your jobs" lands here too: the existing row is the job.
        job = await saveJob.mutateAsync(saveInputFrom(state));
      }
      if (runRef.current !== run) return;
      await deliver(job, run);
    } catch (error) {
      if (runRef.current !== run) return;
      dispatch({ type: "saveFailed", message: apiMessage(error) });
    }
  }

  // --- Enrichment -------------------------------------------------------------

  function handleCancelEnrich() {
    if (phase.kind !== "enriching") return;
    watch.stop();
    const id = inflightRef.current ?? phase.importId;
    inflightRef.current = null;
    if (id) forgetJobImport(queryClient, id);
    dispatch({ type: "enrichFailed", run: phase.run, job: phase.job, message: "Stopped. Use the job without those details, or try again." });
    runRef.current += 1;
  }

  function handleRetryEnrich(job: SavedJobItem) {
    void deliver(job, ++runRef.current);
  }

  // --- Render -----------------------------------------------------------------

  const renderField = (field: JobField) => {
    const meta = JOB_FIELD_META[field];
    const id = fieldId(uid, field);
    const required = plan.required.includes(field);
    const value = state.values[field] ?? "";
    const mark = state.filled && state.filled.fields.includes(field) ? state.filled : null;
    const setValue = (next: string) => dispatch({ type: "field", field, value: next });

    return (
      <div key={field} className={meta.input === "textarea" ? "sm:col-span-2" : undefined}>
        <label className={cn(LABEL, "flex items-center gap-1.5")} htmlFor={id}>
          {meta.label}
          {mark && (
            <span className="rounded-full bg-[#e1f073] px-1.5 py-px text-[9.5px] font-bold normal-case tracking-normal text-[#222325]">
              {mark.origin === "link" ? "from link" : "from paste"}
            </span>
          )}
        </label>
        <div className="relative">
          {meta.input === "textarea" ? (
            <AutoGrowTextarea
              id={id}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              minRows={2}
              maxLength={DESCRIPTION_MAX_CHARS}
              placeholder={PLACEHOLDERS[field]}
              required={required}
              aria-required={required}
              className={cn(FIELD, "leading-relaxed")}
            />
          ) : (
            <input
              id={id}
              type="text"
              inputMode={meta.input === "url" ? "url" : undefined}
              spellCheck={meta.input === "url" ? false : undefined}
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={PLACEHOLDERS[field]}
              required={required}
              aria-required={required}
              className={FIELD}
            />
          )}
          {/* The brief highlight on a freshly filled field. Keyed by the fill, so
              a second import replays it; it fades out and stays out. */}
          {mark && (
            <span
              key={mark.flash}
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl bg-[#e1f073]/60 mix-blend-multiply animate-out fade-out-0 fill-mode-forwards duration-1000"
            />
          )}
          {/* Loading: a shimmer over the fields about to fill. They stay editable underneath. */}
          {importing && <span aria-hidden className="pointer-events-none absolute inset-0 animate-pulse rounded-xl bg-black/[0.05]" />}
        </div>
      </div>
    );
  };

  const savedItems = savedJobs.data ?? [];
  // A listing already in "Your jobs" appears once, as the saved row.
  const savedListingIds = new Set(savedItems.flatMap((job) => (job.platformJobId ? [job.platformJobId] : [])));
  const listingItems = (listings.data ?? []).filter((listing) => !savedListingIds.has(listing.id));
  const searching = state.query.trim() !== searchText || savedJobs.isFetching || listings.isFetching;
  const nothingFound =
    !savedJobs.isLoading &&
    !listings.isLoading &&
    !savedJobs.isError &&
    !listings.isError &&
    savedItems.length === 0 &&
    listingItems.length === 0;
  const pendingTarget = phase.kind === "picking" ? phase.target : null;
  const touched = phase.kind === "filled" || state.editing !== null || Object.values(state.values).some((v) => (v ?? "").trim() !== "");
  const failureCopy = phase.kind === "importError" ? importFailureCopy(phase) : null;
  const announcement = listAnnouncement({
    searching,
    failed: savedJobs.isError || listings.isError,
    nothingFound,
    count: savedItems.length + listingItems.length,
  });

  return (
    <>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325]">
        <div className="flex-none px-6 pt-5 pb-3.5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">{title ?? "Which job?"}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-black/50">
                Pick one from Remote Worldwide, or put a new one in.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer">
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {!enrichView && (
            <SlidingTabs className="mt-3" value={state.tab} onChange={(tab) => dispatch({ type: "tab", tab })} options={TAB_OPTIONS} />
          )}
        </div>

        {enrichView ? (
          // Shown whichever tab the job came from: it is already saved, and the
          // only thing left is the extra details this screen asked for.
          <div className="border-t border-black/10 px-6 pt-4 pb-5">
            <p className="truncate text-sm font-bold text-primary">{jobTitle(enrichView.job)}</p>
            {enrichView.kind === "enriching" ? (
              waiting ? (
                <RunningNotice stage={stageCopy(watch.status, "enrich")} seconds={seconds} onCancel={handleCancelEnrich} />
              ) : (
                <p role="status" className="mt-2.5 flex items-center gap-2 text-xs text-black/60">
                  <Loader2 className="h-3.5 w-3.5 flex-none animate-spin" />
                  Getting the details this screen needs…
                </p>
              )
            ) : (
              <ErrorNotice message={enrichView.message}>
                <button type="button" onClick={() => onPicked(sessionId, enrichView.job)} className={RECOVERY}>
                  Use it without them
                </button>
                {enrichView.retryable && (
                  <button type="button" onClick={() => handleRetryEnrich(enrichView.job)} className={RECOVERY}>
                    Try again
                  </button>
                )}
              </ErrorNotice>
            )}
          </div>
        ) : state.tab === "platform" ? (
          <>
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-black/14 bg-[#fbfbf7] px-3.5 py-2.5">
                {searching ? (
                  <Loader2 className="h-3.5 w-3.5 flex-none animate-spin text-black/40" />
                ) : (
                  <Search className="h-3.5 w-3.5 flex-none text-black/40" />
                )}
                <input
                  ref={searchRef}
                  value={state.query}
                  onChange={(e) => dispatch({ type: "query", query: e.target.value })}
                  placeholder="Role or company"
                  aria-label="Search your jobs and Remote Worldwide"
                  className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-primary outline-none placeholder:font-medium placeholder:text-black/35"
                />
              </div>
              {/* The list's state for screen readers, from a region that stays
                  mounted: the skeleton and the spinner say nothing (see listAnnouncement). */}
              <p role="status" className="sr-only">
                {announcement}
              </p>
              {phase.kind === "pickError" && <ErrorNotice message={`We couldn't open that job. ${phase.message}`} />}
            </div>

            <div className="min-h-0 max-h-[320px] overflow-y-auto border-t border-black/10" aria-busy={pendingTarget !== null || undefined}>
              {savedJobs.isLoading ? (
                <ListSkeleton rows={2} />
              ) : (
                savedItems.length > 0 && (
                  <>
                    <SectionLabel>Your jobs</SectionLabel>
                    {savedItems.map((job) => (
                      <JobRow
                        key={job.id}
                        company={job.company}
                        logo={job.companyLogo}
                        role={job.role}
                        subtitle={SOURCE_LABELS[job.source]}
                        platform={job.source === "platform"}
                        pending={pendingTarget === `saved:${job.id}`}
                        disabled={busy}
                        onPick={() => void pickSaved(job)}
                      />
                    ))}
                  </>
                )
              )}
              {savedJobs.isError && <ListNotice onRetry={() => void savedJobs.refetch()}>We couldn&apos;t load your jobs.</ListNotice>}

              {listings.isLoading ? (
                <ListSkeleton rows={3} />
              ) : (
                listingItems.length > 0 && (
                  <>
                    <SectionLabel>On Remote Worldwide</SectionLabel>
                    {listingItems.map((listing) => (
                      <JobRow
                        key={listing.id}
                        company={listing.company || null}
                        logo={listing.companyLogo}
                        role={listing.role || null}
                        subtitle={[listing.seniority, listing.regions.slice(0, 2).join(", ")].filter(Boolean).join(" · ") || "On Remote Worldwide"}
                        platform
                        pending={pendingTarget === `listing:${listing.id}`}
                        disabled={busy}
                        onPick={() => void pickListing(listing)}
                      />
                    ))}
                  </>
                )
              )}
              {listings.isError && <ListNotice onRetry={() => void listings.refetch()}>We couldn&apos;t search Remote Worldwide.</ListNotice>}

              {nothingFound && (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-black/50 leading-relaxed max-w-[300px] mx-auto">
                    Nothing matches that. Try the{" "}
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "tab", tab: "paste" })}
                      className="cursor-pointer font-bold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
                      Paste a job
                    </button>{" "}
                    tab to add it yourself.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleSave} noValidate className="min-h-0 overflow-y-auto border-t border-black/10 px-6 py-3.5">
            {state.editing && (
              <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-black/12 bg-[#fbfbf7] px-3 py-2">
                <p className="text-xs leading-relaxed text-black/65">
                  <b className="font-semibold text-primary">{jobTitle(state.editing)}</b> is missing details this screen needs. Fill them in to
                  use it.
                </p>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "tab", tab: "platform" })}
                  className="flex-none cursor-pointer text-xs font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
                  Pick another
                </button>
              </div>
            )}

            {/* Smart fill — an optional shortcut into the fields below. */}
            <div className="flex items-start gap-2 rounded-xl border-[1.5px] border-dashed border-black/20 bg-[#fbfbf7] p-2.5">
              <textarea
                ref={pasteRef}
                rows={2}
                value={state.raw}
                onChange={(e) => dispatch({ type: "raw", raw: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleFill();
                  }
                }}
                aria-label="Paste a link or a job posting"
                placeholder={
                  state.rawHint === "text"
                    ? "Paste the posting's text — open it, select everything, copy, and paste it here…"
                    : "Paste a link or the whole posting — we'll fill the fields for you…"
                }
                className="min-w-0 flex-1 resize-none bg-transparent px-1 py-0.5 text-sm leading-relaxed text-primary outline-none placeholder:text-black/40"
              />
              <button
                type="button"
                onClick={handleFill}
                disabled={!state.raw.trim() || busy}
                className="inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] bg-white px-3 py-2 text-xs font-bold text-[#222325] transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#222325] hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:pointer-events-none disabled:opacity-40">
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {importing ? "Reading" : "Fill fields"}
              </button>
            </div>

            {phase.kind === "importing" && waiting && (
              <RunningNotice stage={stageCopy(watch.status, phase.input)} seconds={seconds} onCancel={handleCancelImport} />
            )}
            {failureCopy && (
              <ErrorNotice message={failureCopy.message}>
                {failureCopy.recoveries.map((recovery) => (
                  <button key={recovery.action} type="button" onClick={() => recover(recovery.action)} className={RECOVERY}>
                    {recovery.label}
                  </button>
                ))}
              </ErrorNotice>
            )}
            {phase.kind === "filled" && (
              <p role="status" className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-black/12 bg-[#f7fbe4] px-3 py-2 text-xs text-black/70">
                <Check className="h-3.5 w-3.5 flex-none text-[#6c7a1e]" />
                {phase.origin === "link" ? "Filled from the link" : "Filled from your paste"} — check the fields, then save.
              </p>
            )}

            <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">{plan.required.map(renderField)}</div>

            {plan.optional.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "toggleMore" })}
                  aria-expanded={state.moreOpen}
                  className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-[#6c7a1e]">
                  More details
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", state.moreOpen && "rotate-180")} />
                </button>
                {state.moreOpen && <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2">{plan.optional.map(renderField)}</div>}
              </>
            )}

            {phase.kind === "saveError" && <ErrorNotice message={phase.message} />}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3">
              <p className="text-xs text-black/55">
                {touched && missingForSave.length > 0 ? (
                  <>
                    Still needed:{" "}
                    <b className="font-semibold text-primary">{missingForSave.map((field) => JOB_FIELD_META[field].label).join(", ")}</b>
                  </>
                ) : state.editing ? (
                  "Updates it in your jobs, so every screen sees the change."
                ) : (
                  "Saved to your jobs, so every screen can use it."
                )}
              </p>
              <button
                type="submit"
                disabled={missingForSave.length > 0 || busy}
                className="inline-flex flex-none items-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] bg-[#222325] px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#e1f073] hover:shadow-[2.5px_2.5px_0_0_#e1f073] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardPaste className="h-3.5 w-3.5" />}
                {saving ? "Saving" : "Save & use this job"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* The honest fix for pasting at all — only on the import path. */}
      {state.tab === "paste" && !enrichView && <ExtensionPromo />}
    </>
  );
};
