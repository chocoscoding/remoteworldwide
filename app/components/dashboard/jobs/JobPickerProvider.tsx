"use client";

// The one way a dashboard screen asks "which job?".
//
//   const { pickJob } = useJobPicker();
//   const result = await pickJob("company, role, description, salary?");
//   if (result.status === "picked") result.job.description; // string
//
// It lives in the dashboard shell rather than in each screen, for three
// reasons. The win log (mounted by WinProvider) and the tracker's add flow
// (TrackerProvider) open the picker from inside their own providers, so this
// has to wrap both. Every pick upserts a saved job, so one picker means one
// place that does it. And the dashboard layout outlives navigation, so the
// picker has to notice a route change itself, or a screen's awaited pickJob
// would hang on a page that no longer exists.
//
// The promise never rejects for anything a user can cause: a failed crawl, a
// failed save, a closed dialog. The modal handles those and always offers a
// way forward, or the pick resolves `{ status: "cancelled" }`. It rejects only
// for a provider bug (`toPickedJob` refusing a job the modal should have
// held back), and throws synchronously only for a spec the compiler refused.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  parseFieldList,
  parseFieldSpec,
  toPickedJob,
  toPickedJobDynamic,
  type ParsedFieldSpec,
  type PickJob,
  type PickJobDynamic,
  type PickJobOptions,
  type PickResult,
  type PickResultDynamic,
  type PickerStatus,
  type PickerTab,
  type ValidSpec,
} from "@/app/lib/jobs/fields";
import type { SavedJobItem } from "@/app/lib/jobs/types";
import JobPickerModal from "./JobPickerModal";
import { enrichRefusalKey } from "./pickerReducer";

export interface JobPickerContextValue {
  pickJob: PickJob;
  pickJobDynamic: PickJobDynamic;
  /** The current pick's state: `idle` before the first, `closed` once one ends. */
  status: PickerStatus;
}

interface PickerSession {
  id: number;
  open: boolean;
  parsed: ParsedFieldSpec;
  title: string | undefined;
  initialTab: PickerTab;
  /** The route the pick was made on. Leaving it cancels the pick. */
  pathname: string;
  /** Where focus goes back to on close. No `Dialog.Trigger` is involved, so Radix alone would drop it on <body>. */
  returnFocus: HTMLElement | null;
}

interface PendingPick {
  sessionId: number;
  lastStatus: PickerStatus;
  /** The session's `returnFocus`, kept here so a pick that replaces this one can inherit it. */
  returnFocus: HTMLElement | null;
  onStatusChange: PickJobOptions["onStatusChange"];
  /** Settles the caller's promise; `null` resolves cancelled. */
  finish: (job: SavedJobItem | null) => void;
}

const JobPickerContext = createContext<JobPickerContextValue | null>(null);

export const JobPickerProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [session, setSession] = useState<PickerSession | null>(null);
  const [status, setStatus] = useState<PickerStatus>("idle");
  // The caller's resolver lives in a ref, not state: it never affects what
  // renders, and a pick must settle exactly once however many renders a close
  // takes.
  const pendingRef = useRef<PendingPick | null>(null);
  const sessionSeq = useRef(0);
  // Saved jobs whose enrichment came back `not-a-posting` in this session,
  // keyed by id and description (`enrichRefusalKey`). The backend records the
  // refusal on the job (`extraction.refusal`), but "Your jobs" is a cached list
  // that nothing refetches after a failed enrichment, so the copy the next pick
  // holds was read before the refusal. Without this, that pick would start an
  // import only to be handed the recorded refusal back. Held here because the
  // dialog is remade for every pick, and the next pick is the one that needs it.
  // Editing the description changes the key and clears the backend's record,
  // so the new text is tried.
  const enrichRefusals = useRef(new Set<string>());

  const report = useCallback((pending: PendingPick, next: PickerStatus) => {
    if (pending.lastStatus === next) return;
    pending.lastStatus = next;
    setStatus(next);
    pending.onStatusChange?.(next);
  }, []);

  const settle = useCallback(
    (sessionId: number, job: SavedJobItem | null) => {
      const pending = pendingRef.current;
      if (!pending || pending.sessionId !== sessionId) return;
      pendingRef.current = null;
      // Closed, not removed: Radix needs the root mounted to play the exit
      // animation and run onCloseAutoFocus. The next pick replaces the session.
      setSession((current) => (current && current.id === sessionId ? { ...current, open: false } : current));
      report(pending, "closed");
      pending.finish(job);
    },
    [report],
  );

  const begin = useCallback(
    (parsed: ParsedFieldSpec, opts: PickJobOptions | undefined, finish: PendingPick["finish"]) => {
      const previous = pendingRef.current;
      if (previous) {
        // A second pick while one is open replaces it. The first caller hears
        // "cancelled" instead of waiting on a dialog that is no longer there.
        pendingRef.current = null;
        report(previous, "closed");
        previous.finish(null);
      }

      const id = ++sessionSeq.current;
      // A pick that replaces an open one sends focus back where that pick would
      // have. By now focus sits inside the dialog being replaced, which unmounts
      // as soon as the new session's key takes its place, so reading it again
      // would hand the new dialog an element that is gone by the time it closes.
      const active = document.activeElement;
      const returnFocus = previous ? previous.returnFocus : active instanceof HTMLElement && active !== document.body ? active : null;
      const pending: PendingPick = { sessionId: id, lastStatus: "idle", returnFocus, onStatusChange: opts?.onStatusChange, finish };
      pendingRef.current = pending;
      setSession({
        id,
        open: true,
        parsed,
        title: opts?.title,
        initialTab: opts?.initialTab ?? "platform",
        pathname,
        returnFocus,
      });
      report(pending, "open");
    },
    [pathname, report],
  );

  const pickJob = useCallback(
    <S extends string>(fields: ValidSpec<S>, opts?: PickJobOptions): Promise<PickResult<S>> => {
      // Parsed before anything opens. A bad spec is a programmer error the
      // compiler already refused, so it throws here at the call site rather
      // than opening a dialog that could never keep the promise it made.
      const parsed = parseFieldSpec(fields);
      return new Promise<PickResult<S>>((resolve, reject) => {
        begin(parsed, opts, (job) => {
          if (!job) {
            resolve({ status: "cancelled" });
            return;
          }
          try {
            resolve({ status: "picked", job: toPickedJob<S>(job, parsed, job.extraction.sources) });
          } catch (error) {
            reject(error);
          }
        });
      });
    },
    [begin],
  );

  const pickJobDynamic = useCallback<PickJobDynamic>(
    (fields, opts) => {
      const parsed = parseFieldList(fields);
      return new Promise<PickResultDynamic>((resolve, reject) => {
        begin(parsed, opts, (job) => {
          if (!job) {
            resolve({ status: "cancelled" });
            return;
          }
          try {
            resolve({ status: "picked", job: toPickedJobDynamic(job, parsed, job.extraction.sources) });
          } catch (error) {
            reject(error);
          }
        });
      });
    },
    [begin],
  );

  // A route change ends the pick. Compared against the route the pick was made
  // on rather than "did the path change since last render": a screen that
  // opens the picker from its own mount effect runs that effect before this
  // one, and would otherwise be cancelled by the navigation that mounted it.
  useEffect(() => {
    if (session?.open && session.pathname !== pathname) settle(session.id, null);
  }, [pathname, session, settle]);

  // Leaving the dashboard altogether unmounts the shell. Nothing still open
  // may keep a caller waiting on a promise that can no longer settle.
  useEffect(() => {
    const pending = pendingRef;
    return () => {
      const open = pending.current;
      pending.current = null;
      open?.finish(null);
    };
  }, []);

  const handleStatus = useCallback(
    (sessionId: number, next: PickerStatus) => {
      const pending = pendingRef.current;
      if (pending && pending.sessionId === sessionId) report(pending, next);
    },
    [report],
  );
  const handleCancel = useCallback((sessionId: number) => settle(sessionId, null), [settle]);
  const handlePicked = useCallback((sessionId: number, job: SavedJobItem) => settle(sessionId, job), [settle]);
  const isEnrichRefused = useCallback((job: SavedJobItem) => enrichRefusals.current.has(enrichRefusalKey(job)), []);
  const handleEnrichRefused = useCallback((job: SavedJobItem) => {
    enrichRefusals.current.add(enrichRefusalKey(job));
  }, []);

  const value = useMemo<JobPickerContextValue>(() => ({ pickJob, pickJobDynamic, status }), [pickJob, pickJobDynamic, status]);

  return (
    <JobPickerContext.Provider value={value}>
      {children}
      {session && (
        <JobPickerModal
          // A new pick is a new dialog: fresh state, fresh focus handling.
          key={session.id}
          sessionId={session.id}
          open={session.open}
          parsed={session.parsed}
          title={session.title}
          initialTab={session.initialTab}
          returnFocus={session.returnFocus}
          onStatusChange={handleStatus}
          onCancel={handleCancel}
          onPicked={handlePicked}
          isEnrichRefused={isEnrichRefused}
          onEnrichRefused={handleEnrichRefused}
        />
      )}
    </JobPickerContext.Provider>
  );
};

export default JobPickerProvider;

export function useJobPicker(): JobPickerContextValue {
  const ctx = useContext(JobPickerContext);
  if (!ctx) throw new Error("useJobPicker must be used inside a JobPickerProvider (mounted by DashboardShell)");
  return ctx;
}
