"use client";

// ATS scorer — one flow, not three destinations.
//
// Pick a resume (stored, created, or uploaded) -> optionally attach a job ->
// results. "General score" and "Against a job" used to be separate top-level
// modes with a hardcoded 79 in both; they're now outcomes of the same scan,
// computed live by scoreApplication() — the seam a real scorer replaces.

import { FC, useState } from "react";
import { FilePlus2 } from "lucide-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import JobPickerDialog from "@/app/components/dashboard/jobs/JobPickerDialog";
import { PLATFORM_JOBS, createPastedJob, type JobOption } from "@/app/lib/dashboard/job-options";
import { useDocuments, type VaultDoc } from "@/app/components/dashboard/documents/DocumentsProvider";
import AtsLanding from "@/app/components/dashboard/ats/AtsLanding";
import AtsResults from "@/app/components/dashboard/ats/AtsResults";
import AtsResumesTable from "@/app/components/dashboard/ats/AtsResumesTable";

type AtsView = "score" | "resumes";

// Resumes live in DocumentsProvider now — upload here and My documents sees
// it, archive there and this screen's pickers drop it. The alias is local
// shorthand; the components under app/components/dashboard/ats use VaultDoc
// directly rather than importing a type from a route file.
export type ResumeEntry = VaultDoc;

const AtsClient: FC = () => {
  const { docs, addUploads, toggleArchive } = useDocuments();

  const [view, setView] = useState<AtsView>("score");
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [job, setJob] = useState<JobOption | null>(null);
  const [jobs, setJobs] = useState<JobOption[]>(PLATFORM_JOBS);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Resume waiting on a job pick — kept apart from resumeId so cancelling the
  // picker leaves you where you were instead of dumping you into results.
  const [pendingResumeId, setPendingResumeId] = useState<string | null>(null);
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [queuedKeywordIds, setQueuedKeywordIds] = useState<Set<string>>(new Set());

  const resumes = docs.filter((d) => d.kind === "resume");
  const activeResumes = resumes.filter((r) => !r.archived);

  // A new resume or a new job is a new scan — applied fixes belong to the old report.
  function resetReport() {
    setFixedIds(new Set());
    setQueuedKeywordIds(new Set());
  }

  function scoreGeneral(id: string) {
    setResumeId(id);
    setJob(null);
    resetReport();
    setView("score");
  }

  function scoreVsJob(id: string) {
    setPendingResumeId(id);
    setPickerOpen(true);
  }

  function handleJobChosen(next: JobOption) {
    setJob(next);
    if (pendingResumeId) setResumeId(pendingResumeId);
    setPendingResumeId(null);
    resetReport();
    setPickerOpen(false);
    setView("score");
  }

  /** Uploads land in the shared documents store (forced kind "resume", since
   *  this screen only scores resumes) — so My documents shows them too. */
  function handleUpload(file: File): ResumeEntry {
    const [entry] = addUploads([file], { kind: "resume" });
    return entry;
  }

  function toggleFix(id: string) {
    setFixedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleKeyword(id: string) {
    setQueuedKeywordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function backToLanding() {
    setResumeId(null);
    setJob(null);
    resetReport();
    setView("score");
  }

  const activeResume = resumes.find((r) => r.id === resumeId) ?? null;

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
          {activeResume && view === "score" && (
            <StickerButton variant="primary" size="md" onClick={backToLanding}>
              <FilePlus2 className="h-4 w-4" />
              Score another resume
            </StickerButton>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        {view === "resumes" ? (
          <AtsResumesTable
            resumes={resumes}
            onToggleArchive={toggleArchive}
            onGeneral={scoreGeneral}
            onVsJob={scoreVsJob}
          />
        ) : !activeResume ? (
          <AtsLanding resumes={activeResumes} onUpload={handleUpload} onScoreGeneral={scoreGeneral} onScoreVsJob={scoreVsJob} />
        ) : (
          <AtsResults
            resume={activeResume}
            resumes={activeResumes}
            job={job}
            fixedIds={fixedIds}
            queuedKeywordIds={queuedKeywordIds}
            onToggleFix={toggleFix}
            onToggleKeyword={toggleKeyword}
            onChangeResume={(id) => {
              setResumeId(id);
              resetReport();
            }}
            onChangeJob={() => {
              setPendingResumeId(null);
              setPickerOpen(true);
            }}
            onRemoveJob={() => {
              setJob(null);
              resetReport();
            }}
            onExit={backToLanding}
          />
        )}
      </main>

      <JobPickerDialog
        open={pickerOpen}
        onOpenChange={(v) => {
          setPickerOpen(v);
          if (!v) setPendingResumeId(null);
        }}
        jobs={jobs}
        onPick={handleJobChosen}
        onCreate={(input) => {
          const created = createPastedJob(input);
          setJobs((prev) => [created, ...prev]);
          handleJobChosen(created);
        }}
      />
    </div>
  );
};

export default AtsClient;
