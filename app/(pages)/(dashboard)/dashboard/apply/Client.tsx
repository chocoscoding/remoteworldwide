"use client";

// Apply to a job — from a posting to a tracked application in five steps.
//
//   1  The role          the job as it was read, and whether it's already tracked
//   2  Resume            which ingested resume goes with it, its ATS score, and
//                        the tailor / keyword tools
//   3  Cover letter      written from that resume and the posting, then edited
//   4  Warm intro        the referral screen's people search, for a saved job
//   5  Answers & track   the form's questions answered, then "Track as applied"
//
// Every step used to be one hardcoded application to one company, and Submit
// only flipped a flag. Each now runs on the real job and the real services, and
// nothing that costs a credit runs without a click (the copy on each button says
// what it costs).
//
// We do not submit applications. There is no integration that could, so the
// last step opens the employer's own form in a new tab and "Track as applied"
// records what went out: an application row carrying the resume id, the ATS
// score, the letter as edited and the answers. When the job already sits in the
// tracker's Saved column, that card moves to Applied instead of gaining a twin.
//
// Steps stay mounted once visited and are hidden rather than unmounted, so a
// letter half-edited in step 3 or a tool's proposal in step 2 is still there
// after a look back at step 1. What the last step records lives here.

import { FC, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import LogoMini from "@/app/components/svg/LogoMini";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { apiMessage } from "@/app/lib/api/core";
import { recordAnswerUses } from "@/app/lib/answers/api";
import { applicationInput, isObjectId, newClientId, updateApplication, wasApplied } from "@/app/lib/applications/api";
import { APPLICATION_LIMITS, type ApplicationAnswer, type UpdateApplicationInput } from "@/app/lib/applications/types";
import { qk } from "@/app/lib/query/keys";
import { useDuplicateApplication } from "@/hooks/queries/useApplicationsQuery";
import { useIngestedResumesQuery } from "@/hooks/queries/useAtsQueries";
import { createdApplicationId, useCreateApplication, useUpdateApplication } from "@/hooks/mutations/useApplicationMutations";
import StartApplication from "./StartApplication";
import type { PickedJob, StartedJob } from "./job";
import { useApplyScan } from "./useApplyScan";
import RoleStep from "./steps/RoleStep";
import ResumeStep from "./steps/ResumeStep";
import CoverStep from "./steps/CoverStep";
import IntroStep from "./steps/IntroStep";
import SubmitStep from "./steps/SubmitStep";

type StepNum = 1 | 2 | 3 | 4 | 5;

const STEPS: { n: StepNum; label: string }[] = [
  { n: 1, label: "The role" },
  { n: 2, label: "Resume" },
  { n: 3, label: "Cover letter" },
  { n: 4, label: "Warm intro" },
  { n: 5, label: "Answers & track" },
];

const ApplyClient: FC = () => {
  // Nothing is chosen until the front door hands a job over, so "apply to a
  // job" means any job.
  const [job, setJob] = useState<StartedJob | null>(null);

  // The application's client id is minted here, in the handler, never during a
  // render: it is the create's idempotency key.
  const start = (picked: PickedJob) => setJob({ ...picked, clientId: newClientId("app") });

  if (!job) {
    return (
      <div className="min-h-screen bg-[#f6f6f6]">
        <header className="sticky top-0 z-10 h-16 flex items-center gap-3 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Apply to a job</h1>
          <NotificationBell className="ml-auto" />
        </header>
        <main className="px-8 py-10 pb-14">
          <StartApplication onStart={start} />
        </main>
      </div>
    );
  }

  // Keyed on the application, so a second job starts from a clean wizard.
  return <ApplyWizard key={job.clientId} job={job} onChangeJob={() => setJob(null)} />;
};

const ApplyWizard: FC<{ job: StartedJob; onChangeJob: () => void }> = ({ job, onChangeJob }) => {
  const queryClient = useQueryClient();
  const { recordAction } = useActivity();
  const createApplication = useCreateApplication();
  const moveApplication = useUpdateApplication();
  const scan = useApplyScan();
  const resumes = useIngestedResumesQuery();
  const duplicate = useDuplicateApplication({ company: job.company, role: job.role, url: job.url ?? job.applyUrl ?? undefined });

  const [step, setStep] = useState<StepNum>(1);
  const [visited, setVisited] = useState<ReadonlySet<StepNum>>(() => new Set<StepNum>([1]));
  const [chosenResumeId, setChosenResumeId] = useState<string | null>(null);
  const [letter, setLetter] = useState("");
  const [letterSkipped, setLetterSkipped] = useState(false);
  const [tracked, setTracked] = useState(false);

  // Until one is picked, the newest resume that parsed cleanly — the one most
  // recently uploaded, which is the default everywhere else too.
  const resumeId = chosenResumeId ?? (resumes.data ?? []).find((row) => row.status === "ready")?.resumeId ?? null;
  const resumeName = resumes.data?.find((row) => row.resumeId === resumeId)?.fileName ?? null;
  // A score only counts for the resume it was run on.
  const atsScore = scan.resumeId === resumeId && scan.report ? Math.round(scan.report.score) : null;
  const sentLetter = letterSkipped ? null : letter.trim().slice(0, APPLICATION_LIMITS.coverLetterMax) || null;

  function go(next: StepNum) {
    setStep(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function leave() {
    // Letters and scores cost credits and live only on this screen.
    const unsaved = !tracked && (letter.trim() !== "" || scan.report !== null);
    if (unsaved && !window.confirm("Leave this application? The letter and score you've made here aren't kept.")) return;
    onChangeJob();
  }

  /**
   * Logs the answers sent against the application, so the Questions screen's
   * "By application" tab lists them. The route takes only a backend id, so a
   * new application's create is waited for first. A side record: the
   * application is tracked whether or not this lands, so a failure is dropped.
   */
  function logAnswerUses(applicationId: string | Promise<string | null>, answers: ApplicationAnswer[]) {
    if (answers.length === 0) return;
    void Promise.resolve(applicationId)
      .then((id) => (id ? recordAnswerUses({ applicationId: id, answers }) : null))
      .then((recorded) => {
        if (recorded) void queryClient.invalidateQueries({ queryKey: qk.answers.history() });
      })
      .catch(() => undefined);
  }

  /**
   * "Track as applied". A saved card for this job moves to Applied carrying what
   * was sent; anything else is a new application, marked as a repeat when an
   * earlier one was actually sent. Both write behind the screen, the tracker's
   * way: a failure comes back as a toast with Retry, and the client id makes a
   * retried create write once.
   */
  function track(answers: ApplicationAnswer[]) {
    if (tracked) return;
    const prior = duplicate.data ?? null;
    const sent = { atsScore, resumeId, coverLetter: sentLetter, answers };

    if (prior && prior.status === "saved") {
      const patch: UpdateApplicationInput = { status: "applied", ...sent };
      if (!moveApplication(prior.id, patch)) {
        // The board isn't cached, so there is no card to move first. Send it straight.
        updateApplication(prior.id, patch)
          .then(() => {
            void queryClient.invalidateQueries({ queryKey: qk.activity.applications() });
            void queryClient.invalidateQueries({ queryKey: qk.activity.summary() });
          })
          .catch((error: unknown) => {
            setTracked(false);
            toast.error(`${job.company} wasn't tracked`, { description: apiMessage(error) });
          });
      }
      recordAction("application", prior.id, `Applied to ${job.company}`);
      logAnswerUses(prior.id, answers);
    } else {
      createApplication({
        clientId: job.clientId,
        input: applicationInput({
          company: job.company,
          role: job.role,
          location: job.location,
          url: job.url ?? job.applyUrl,
          savedJobId: isObjectId(job.savedJobId) ? job.savedJobId : null,
          source: job.platform ? "internal" : "external",
          status: "applied",
          duplicateOf: prior && wasApplied(prior) ? prior.id : null,
          ...sent,
        }),
      });
      recordAction("application", job.clientId, `Applied to ${job.company}`);
      logAnswerUses(createdApplicationId(job.clientId), answers);
    }
    setTracked(true);
  }

  const renderStep = (n: StepNum): ReactNode => {
    switch (n) {
      case 1:
        return <RoleStep job={job} duplicate={duplicate.data} />;
      case 2:
        return <ResumeStep job={job} resumeId={resumeId} onResumeChange={setChosenResumeId} scan={scan} />;
      case 3:
        return (
          <CoverStep
            job={job}
            resumeId={resumeId}
            resumeName={resumeName}
            letter={letter}
            onLetterChange={setLetter}
            skipped={letterSkipped}
            onSkippedChange={setLetterSkipped}
            onPickResume={() => go(2)}
          />
        );
      case 4:
        return <IntroStep job={job} onSkip={() => go(5)} />;
      case 5:
        return (
          <SubmitStep
            job={job}
            resumeId={resumeId}
            resumeName={resumeName}
            atsScore={atsScore}
            letter={sentLetter}
            duplicate={duplicate.data}
            tracked={tracked}
            onTrack={track}
            onEditStep={go}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="h-16 flex items-center justify-between gap-4 px-8">
          <div className="flex items-center gap-3 min-w-0">
            <LogoMini className="h-6 w-6 flex-none" />
            <h1 className="text-[17px] font-bold text-primary truncate">
              {job.company} — {job.role}
            </h1>
            <span className="hidden lg:inline text-sm text-black/30">·</span>
            <span className="hidden lg:inline text-sm text-black/45 whitespace-nowrap">Step {step} of 5</span>
          </div>
          <div className="flex items-center gap-3 flex-none">
            <StickerButton variant="outline" size="md" onClick={leave}>
              Change job
            </StickerButton>
            <StickerButton variant="primary" size="md" disabled={step === 5} onClick={() => go(Math.min(5, step + 1) as StepNum)}>
              Continue
            </StickerButton>
            <NotificationBell />
          </div>
        </div>

        {/* Step tracker */}
        <div className="px-8 pb-4 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {STEPS.map(({ n, label }, idx) => {
              const isDone = n < step;
              const isActive = n === step;
              return (
                <div key={n} className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-current={isActive ? "step" : undefined}
                    onClick={() => go(n)}
                    className="flex items-center gap-2.5 group cursor-pointer">
                    <span
                      className={cn(
                        "h-8 w-8 flex-none rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                        isDone
                          ? "bg-primary text-secondary"
                          : isActive
                            ? "bg-primary text-white"
                            : "bg-[#f0f0ea] text-black/40 group-hover:bg-[#e7e7df]",
                      )}>
                      {isDone ? <Check className="h-4 w-4" /> : n}
                    </span>
                    <span
                      className={cn(
                        "text-sm whitespace-nowrap",
                        isActive ? "font-bold text-primary" : isDone ? "font-semibold text-black/60" : "font-medium text-black/40",
                      )}>
                      {label}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && <span className="h-px w-10 bg-black/10 flex-none" />}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="px-8 py-7 pb-10 max-w-[1100px] mx-auto">
        {STEPS.map(({ n }) =>
          visited.has(n) ? (
            <div key={n} hidden={step !== n}>
              {renderStep(n)}
            </div>
          ) : null,
        )}

        {/* Footer nav. The last step's action is its own "Track as applied". */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/10">
          {step > 1 ? (
            <StickerButton variant="outline" size="md" onClick={() => go((step - 1) as StepNum)}>
              Back a step
            </StickerButton>
          ) : (
            <span />
          )}
          {step < 5 && (
            <StickerButton variant="primary" size="lg" onClick={() => go((step + 1) as StepNum)}>
              Continue
            </StickerButton>
          )}
        </div>
      </main>
    </div>
  );
};

export default ApplyClient;
