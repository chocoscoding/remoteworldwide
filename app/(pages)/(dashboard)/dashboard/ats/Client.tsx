"use client";

// ATS scorer — one flow, not three destinations.
//
// Pick a resume (stored, created, or uploaded) -> optionally attach a job ->
// results. "General score" and "Against a job" used to be separate top-level
// modes with a hardcoded 79 in both; they're now outcomes of the same scan,
// computed live by scoreApplication() — the seam a real scorer replaces.

import { FC, useRef, useState } from "react";
import { FilePlus2 } from "lucide-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import JobPickerDialog from "@/app/components/dashboard/jobs/JobPickerDialog";
import { PLATFORM_JOBS, createPastedJob, type JobOption } from "@/app/lib/dashboard/job-options";
import { ATS_RESUMES } from "@/app/lib/dashboard/mock-data";
import AtsLanding from "./_components/AtsLanding";
import AtsResults from "./_components/AtsResults";
import AtsResumesTable from "./_components/AtsResumesTable";

type AtsView = "score" | "resumes";

export interface ResumeEntry {
  id: string;
  name: string;
  updatedLabel: string;
  source: "created" | "uploaded";
  archived?: boolean;
  /** A stored match score + which job it was against, where mock data has one. */
  jdScore?: number | null;
  jdLabel?: string;
}

const UPDATED_LABELS: Record<string, string> = {
  "res-master": "Updated 2 days ago",
  "res-linear": "Tailored today",
  "res-deel": "Updated 6 days ago",
  "res-2023": "Not maintained",
};

const JD_LABELS: Record<string, string> = { "res-linear": "Linear", "res-deel": "Deel" };

const SEED_RESUMES: ResumeEntry[] = ATS_RESUMES.map((r) => ({
  id: r.id,
  name: r.name,
  updatedLabel: UPDATED_LABELS[r.id] ?? "Updated recently",
  source: "created",
  archived: r.archived,
  jdScore: r.jdScore,
  jdLabel: JD_LABELS[r.id],
}));

const AtsClient: FC = () => {
  const [view, setView] = useState<AtsView>("score");
  const [resumes, setResumes] = useState<ResumeEntry[]>(SEED_RESUMES);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [job, setJob] = useState<JobOption | null>(null);
  const [jobs, setJobs] = useState<JobOption[]>(PLATFORM_JOBS);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Resume waiting on a job pick — kept apart from resumeId so cancelling the
  // picker leaves you where you were instead of dumping you into results.
  const [pendingResumeId, setPendingResumeId] = useState<string | null>(null);
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [queuedKeywordIds, setQueuedKeywordIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set(SEED_RESUMES.filter((r) => r.archived).map((r) => r.id)));

  const uploadSeq = useRef(0);

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

  /** The file's contents are not parsed — this registers the upload as a
   *  scoreable entry, named from the filename. A real parser is the seam. */
  function handleUpload(file: File): ResumeEntry {
    const entry: ResumeEntry = {
      id: `res-upload-${++uploadSeq.current}`,
      name: file.name.replace(/\.(pdf|docx?|txt|md)$/i, ""),
      updatedLabel: "Uploaded just now",
      source: "uploaded",
    };
    setResumes((prev) => [...prev, entry]);
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

  function toggleArchive(id: string) {
    setArchivedIds((prev) => {
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
            archivedIds={archivedIds}
            onToggleArchive={toggleArchive}
            onGeneral={scoreGeneral}
            onVsJob={scoreVsJob}
          />
        ) : !activeResume ? (
          <AtsLanding resumes={resumes.filter((r) => !archivedIds.has(r.id))} onUpload={handleUpload} onScoreGeneral={scoreGeneral} onScoreVsJob={scoreVsJob} />
        ) : (
          <AtsResults
            resume={activeResume}
            resumes={resumes.filter((r) => !archivedIds.has(r.id))}
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
