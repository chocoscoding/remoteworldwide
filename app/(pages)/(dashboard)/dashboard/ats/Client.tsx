"use client";

// ATS scorer — one flow, not three destinations.
//
// Pick a resume (stored, created, or uploaded) -> optionally attach a job ->
// results. "General score" and "Against a job" are outcomes of the same scan,
// which now runs against the real scorer in the AI service: requirements read
// out of the posting, evidence retrieved from the resume's own bullets, a
// weighted score, and a grounded write-up behind it.
//
// Two ids, and they are not the same id. The picker lists VAULT DOCUMENTS
// (files in My documents); the scorer names an INGESTED RESUME (a CV that has
// been parsed, chunked and embedded). `useScanResume` bridges them: it prefers
// a resume already ingested for that file and imports it on demand when there
// is none. That is why the first scan of a document says "Reading your
// resume" and later ones do not.
//
// A scan costs a credit, so nothing here scores speculatively. `generalScores`
// remembers only what was actually run, which is what the landing cards and
// the resumes table show in place of a number they have not earned.
//
// One report is not run here at all: the late-explanation email links to
// `?scan=<id>`, and that scan is read back from the service — free, and the
// stored numbers rather than new ones.

import { FC, Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FilePlus2, Loader2, X } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { useJobPicker } from "@/app/components/dashboard/jobs/JobPickerProvider";
import JobContextBanner from "@/app/components/dashboard/jobs/JobContextBanner";
import { backToJobHref, readJobContext } from "@/app/lib/dashboard/contextParams";
import { parseFieldSpec, toPickedJob, type PickedJob } from "@/app/lib/jobs/fields";
import type { SavedJobItem } from "@/app/lib/jobs/types";
import { useDocuments, type VaultDoc } from "@/app/components/dashboard/documents/DocumentsProvider";
import { docForScan, explanationNote, isScanGone } from "@/app/lib/ats/api";
import type { ScanRecord } from "@/app/lib/ats/types";
import { useIngestedResumesQuery, useScanQuery } from "@/hooks/queries/useAtsQueries";
import { useSavedJobQuery } from "@/hooks/queries/useJobQueries";
import { useScanResume, type ScanStatus } from "@/hooks/mutations/useScanResume";
import AtsLanding from "@/app/components/dashboard/ats/AtsLanding";
import AtsResults from "@/app/components/dashboard/ats/AtsResults";
import AtsResumesTable from "@/app/components/dashboard/ats/AtsResumesTable";

type AtsView = "score" | "resumes";

// Resumes live in DocumentsProvider now — upload here and My documents sees
// it, archive there and this screen's pickers drop it. The alias is local
// shorthand; the components under app/components/dashboard/ats use VaultDoc
// directly rather than importing a type from a route file.
export type ResumeEntry = VaultDoc;

// What a scan reads from a picked job: who it's for, and the posting to score
// against. One constant feeds both the pick and the type, so they cannot drift.
const ATS_JOB_SPEC = "company, role, description";
type AtsJob = PickedJob<typeof ATS_JOB_SPEC>;
const ATS_JOB_SPEC_PARSED = parseFieldSpec(ATS_JOB_SPEC);

/** A saved job named by a link (?job=), as the picker would have handed it back. Null without a description to score against. */
function atsJobFrom(saved: SavedJobItem): AtsJob | null {
  try {
    return toPickedJob<typeof ATS_JOB_SPEC>(saved, ATS_JOB_SPEC_PARSED, saved.extraction.sources);
  } catch {
    return null;
  }
}

/**
 * The file a linked scan scored, standing in once it has left My documents.
 * The report still reads; only scoring that file again needs the file, and
 * `startScan` finds no document behind this id, so it quietly does nothing.
 */
const standInResume = (record: ScanRecord): ResumeEntry => ({
  id: `scan:${record.scanId}`,
  name: record.fileName ?? "Your resume",
  kind: "resume",
  source: "uploaded",
  addedAt: 0,
  updatedLabel: "",
});

const AtsScreen: FC = () => {
  const { docs, loading: docsLoading, addUploads, toggleArchive } = useDocuments();
  const { pickJob } = useJobPicker();
  // The bridge's left-hand side. An empty list is not an error: it only means
  // every scan on this screen starts with an import.
  const { data: ingested } = useIngestedResumesQuery();
  const scan = useScanResume();

  const [view, setView] = useState<AtsView>("score");
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [job, setJob] = useState<AtsJob | null>(null);
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  /** General scores actually run this session, by document id. */
  const [generalScores, setGeneralScores] = useState<ReadonlyMap<string, number>>(new Map());

  // A link from a job's own screen (?job=<saved job id>) arrives with that job
  // chosen, as if it had been picked here: choose a resume, and the landing's
  // "Against this job" scores it without asking which. Chosen, not scored — a
  // scan is a credit, so it still waits for that click. Read from saved jobs
  // rather than the link's labels, and kept apart from `job`, which is the job
  // of the report on screen: Score another resume clears that one, and this one
  // stays chosen for the next. A job that has gone, or has no description to
  // score against, leaves the landing as it always is, on the picker.
  const params = useSearchParams();
  const context = readJobContext(params, "job");
  const [contextDismissed, setContextDismissed] = useState(false);
  const saved = useSavedJobQuery(contextDismissed ? null : context.savedJobId);
  const savedJob = !contextDismissed && saved.data && saved.data.id === context.savedJobId ? saved.data : null;
  const linkedJob = savedJob ? atsJobFrom(savedJob) : null;

  const resumes = docs.filter((d) => d.kind === "resume");
  const activeResumes = resumes.filter((r) => !r.archived);

  // A link from the late-explanation email (?scan=<scan id>) opens that scan's
  // report on the same screen a scan run here uses — on the resume it scored
  // and the saved job it was against, so Change job and General instead work
  // from it as they would from a fresh one. Read back, never re-run: free, and
  // the write-up shows as it stands (still being written, or the reason there
  // is none). Running any scan, or leaving the report, lets go of it. A scan
  // that will not open says so in one line over the screen as it always is.
  const scanLinkId = params.get("scan")?.trim() || null;
  const [scanLinkDismissed, setScanLinkDismissed] = useState(false);
  const scanLinkWanted = !scanLinkDismissed && scanLinkId !== null;
  const stored = useScanQuery(scanLinkWanted ? scanLinkId : null);
  const record = scanLinkWanted ? (stored.data ?? null) : null;
  const recordSaved = useSavedJobQuery(record?.jobId ?? null);
  // Only when there is nothing to show: a poll that fails under a report already on screen leaves it be.
  const scanLinkFailed = scanLinkWanted && stored.isError && !stored.data;
  // The report waits for the documents and the saved job it names, rather than
  // drawing once with a stand-in and again with the real thing.
  const openingScan = scanLinkWanted && (stored.isPending || (record !== null && (docsLoading || (record.jobId !== null && recordSaved.isPending))));

  const linkedReport = useMemo(() => {
    if (!record || openingScan) return null;
    const againstJob = recordSaved.data && recordSaved.data.id === record.jobId ? atsJobFrom(recordSaved.data) : null;
    return {
      record,
      resume: docForScan(record, docs) ?? standInResume(record),
      /** The saved job, for scoring again against it. Null for a general score, or a job no longer saved. */
      scanJob: againstJob,
      /** What the report is labelled with. A job since removed is still a job scan, not a general one. */
      job: againstJob ?? (record.verdicts.length > 0 ? { id: record.jobId ?? undefined, company: "A posting", role: "no longer saved", description: "" } : null),
      // "pending" is the existing writing-it-up state; the query reads the scan
      // again while it is, and the report fills in when the write-up lands.
      status: (record.explanationStatus === "pending" ? "explaining" : "done") as ScanStatus,
      unexplained: explanationNote(record),
      scannedAt: new Date(record.scannedAt),
    };
  }, [record, openingScan, recordSaved.data, docs]);

  /**
   * Runs one scan and shows it.
   *
   * Every path into results goes through here, so there is exactly one place
   * that spends a credit and exactly one set of state a new report resets.
   */
  const startScan = useCallback(
    async (docId: string, forJob: AtsJob | null) => {
      const doc = docs.find((d) => d.id === docId);
      if (!doc) return;

      // A report run here replaces one opened from a link, for good.
      setScanLinkDismissed(true);
      // Applied fixes belong to the report that suggested them.
      setFixedIds(new Set());
      setResumeId(docId);
      setJob(forJob);
      setView("score");

      const report = await scan.run({ doc, job: forJob, ingested: ingested ?? [] });

      // The general score is what the landing cards and the resumes table
      // show, so it is remembered per document. A job-specific score is about
      // a posting rather than about the resume, and belongs only to the report
      // on screen.
      if (report && !forJob) setGeneralScores((prev) => new Map(prev).set(docId, report.score));
    },
    [docs, ingested, scan],
  );

  function scoreGeneral(id: string) {
    void startScan(id, null);
  }

  function scoreVsJob(id: string) {
    void chooseJob(id);
  }

  /**
   * The landing's "Against a job": the job a link chose, or the picker when
   * there is none. The resumes table always asks, since its button names no
   * job and a scan it did not name would be a credit spent on a surprise.
   */
  function scoreVsLinkedJob(id: string) {
    if (linkedJob) void startScan(id, linkedJob);
    else scoreVsJob(id);
  }

  /**
   * Pick a job, then score against it. `forResumeId` is the resume waiting on
   * the pick, applied only once a job comes back, so cancelling the picker
   * leaves you where you were instead of dumping you into results. Null keeps
   * the resume already on screen (Change job).
   */
  async function chooseJob(forResumeId: string | null) {
    const result = await pickJob(ATS_JOB_SPEC);
    if (result.status !== "picked") return;
    const target = forResumeId ?? resumeId;
    if (!target) return;
    await startScan(target, result.job);
  }

  /** Uploads land in the shared documents store (forced kind "resume", since
   *  this screen only scores resumes) — so My documents shows them too. */
  async function handleUpload(file: File): Promise<ResumeEntry | null> {
    const [entry] = await addUploads([file], { kind: "resume" });
    return entry ?? null;
  }

  function toggleFix(id: string) {
    setFixedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function backToLanding() {
    setScanLinkDismissed(true);
    setResumeId(null);
    setJob(null);
    setFixedIds(new Set());
    scan.reset();
    setView("score");
  }

  const activeResume = resumes.find((r) => r.id === resumeId) ?? null;
  // Said while the linked job is waiting on the landing, and over its own report — not over a report on another job.
  const contextJob = linkedJob && (!activeResume || job?.id === linkedJob.id) ? linkedJob : null;

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">ATS scorer</h1>
          <span className="hidden truncate text-sm text-black/45 sm:inline">How applicant tracking systems read your resume</span>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <SlidingTabs
            value={view}
            onChange={setView}
            options={[
              { id: "score", label: "Score" },
              { id: "resumes", label: "My resumes" },
            ]}
          />
          {(activeResume || linkedReport) && view === "score" && (
            <StickerButton variant="primary" size="md" onClick={backToLanding}>
              <FilePlus2 className="h-4 w-4" />
              Score another resume
            </StickerButton>
          )}
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        {/* Dismissing lets go of the linked job, so the landing's "Against a
            job" asks again. A report already scored against it stays. */}
        {contextJob && (
          <JobContextBanner
            className="mb-5"
            action="Scoring your resume"
            role={contextJob.role}
            company={contextJob.company}
            backHref={backToJobHref(context)}
            onDismiss={() => setContextDismissed(true)}
          />
        )}

        {scanLinkFailed && (
          <div role="status" className="mb-5 flex items-center gap-3 rounded-[14px] border border-black/10 bg-white px-4 py-3">
            <p className="min-w-0 flex-1 text-sm text-black/60">
              {isScanGone(stored.error)
                ? "That scan isn't available any more."
                : "That scan couldn't be opened just now. Try the link again in a moment."}
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setScanLinkDismissed(true)}
              className="h-6 w-6 flex-none rounded-md text-primary/50 flex items-center justify-center transition-colors hover:bg-black/10 hover:text-primary cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {view === "resumes" ? (
          <AtsResumesTable
            resumes={resumes}
            scores={generalScores}
            onToggleArchive={toggleArchive}
            onGeneral={scoreGeneral}
            onVsJob={scoreVsJob}
          />
        ) : !activeResume && openingScan ? (
          <DashCard className="flex flex-col items-center gap-4 p-12 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-black/30" />
            <p className="text-[15px] font-bold text-primary">Opening your scan</p>
          </DashCard>
        ) : !activeResume && linkedReport ? (
          // A scan opened from a link. Changing anything runs a new scan, which
          // takes over the report exactly as it does from any other.
          <AtsResults
            resume={linkedReport.resume}
            report={linkedReport.record}
            status={linkedReport.status}
            failure={null}
            unexplained={linkedReport.unexplained}
            scannedAt={linkedReport.scannedAt}
            resumes={activeResumes.some((r) => r.id === linkedReport.resume.id) ? activeResumes : [linkedReport.resume, ...activeResumes]}
            job={linkedReport.job}
            fixedIds={fixedIds}
            onToggleFix={toggleFix}
            onChangeResume={(id) => void startScan(id, linkedReport.scanJob)}
            onChangeJob={() => void chooseJob(linkedReport.resume.id)}
            onRemoveJob={() => void startScan(linkedReport.resume.id, null)}
            onRetry={() => void startScan(linkedReport.resume.id, linkedReport.scanJob)}
            onExit={backToLanding}
          />
        ) : !activeResume ? (
          <AtsLanding
            resumes={activeResumes}
            scores={generalScores}
            job={linkedJob}
            onUpload={handleUpload}
            onScoreGeneral={scoreGeneral}
            onScoreVsJob={scoreVsLinkedJob}
          />
        ) : (
          <AtsResults
            resume={activeResume}
            report={scan.report}
            status={scan.status}
            failure={scan.failure}
            unexplained={scan.unexplained}
            scannedAt={scan.scannedAt}
            resumes={activeResumes}
            job={job}
            fixedIds={fixedIds}
            onToggleFix={toggleFix}
            onChangeResume={(id) => void startScan(id, job)}
            onChangeJob={() => void chooseJob(null)}
            onRemoveJob={() => void startScan(activeResume.id, null)}
            onRetry={() => void startScan(activeResume.id, job)}
            onExit={backToLanding}
          />
        )}
      </main>
    </div>
  );
};

/** The screen's frame, shown only if the page is ever prerendered without search params. */
const AtsFallback: FC = () => (
  <div className="min-h-screen bg-[#f6f6f6]">
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
      <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">ATS scorer</h1>
      <NotificationBell />
    </header>
  </div>
);

// useSearchParams needs a Suspense boundary for a prerendered page. This one
// renders per request (the dashboard layout reads the session), so the fallback
// should never show; the boundary keeps the screen correct if that changes.
const AtsClient: FC = () => (
  <Suspense fallback={<AtsFallback />}>
    <AtsScreen />
  </Suspense>
);

export default AtsClient;
