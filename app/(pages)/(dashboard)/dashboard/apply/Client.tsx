"use client";

// Apply to a job — from a posting to a tracked application in five steps.
//
//   1  The role          the job as it was read, and whether it's already tracked
//   2  Resume            the resume it goes with (and its one tailored draft),
//                        its ATS score, and the tools that close the gaps
//   3  Cover letter      written from that resume and the posting, then edited
//   4  Warm intro        the referral screen's people search, for a saved job
//   5  Answers & track   the form's questions answered, then "Track as applied"
//
// Progress is saved (owner, 2026-10-03). Every application being prepared is a
// session on the backend (`app/lib/apply/sessions.ts`), named in the address as
// `?session=<id>`, so a refresh — or coming back days later — lands on the same
// step with everything made so far: the resume picks and the draft, the score,
// every letter draft, the answers. Starting a job that has an unfinished
// session asks whether to continue it; one started from a pasted description
// has no link to be recognised by, so it never asks (the one compromise the
// owner accepted). "Track as applied" finishes the session, and applying to the
// same job again starts fresh.
//
// We do not submit applications. There is no integration that could, so the
// last step opens the employer's own form in a new tab and "Track as applied"
// records what went out: an application row carrying the resume id, the ATS
// score, the letter as edited and the answers. When the job already sits in the
// tracker's Saved column, that card moves to Applied instead of gaining a twin.
//
// Steps stay mounted once visited and are hidden rather than unmounted. Step 2
// mounts from the start, so the resume is found and scored as soon as the job
// is in (owner: the score "should always run once you update the job").

import { FC, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { Bone, LinesSkeleton, Loading, RowsSkeleton } from "@/app/components/dashboard/ui/Skeleton";
import LogoMini from "@/app/components/svg/LogoMini";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { recordAnswerUses } from "@/app/lib/answers/api";
import { applicationInput, isObjectId, isTrackedSamePosting, newClientId, updateApplication, wasApplied } from "@/app/lib/applications/api";
import { APPLICATION_LIMITS, type ApplicationAnswer, type UpdateApplicationInput } from "@/app/lib/applications/types";
import {
  createApplySession,
  deleteApplySession,
  finishApplySession,
  getApplySession,
  listResumableSessions,
  matchApplySession,
  saveApplySession,
  type ApplySessionItem,
  type ApplySessionStatus,
  type ApplySessionSummary,
} from "@/app/lib/apply/sessions";
import {
  APPLY_STEP_LABELS,
  APPLY_STEPS,
  readApplyState,
  readStep,
  readVisited,
  sendingResumeId,
  type ApplyState,
  type ApplyStepNum,
} from "@/app/lib/apply/state";
import { qk } from "@/app/lib/query/keys";
import { keepDraftResume } from "@/app/lib/resume/api";
import { useDuplicateApplication } from "@/hooks/queries/useApplicationsQuery";
import { useIngestedResumeQuery } from "@/hooks/queries/useAtsQueries";
import { createdApplicationId, useCreateApplication, useUpdateApplication } from "@/hooks/mutations/useApplicationMutations";
import StartApplication from "./StartApplication";
import type { PickedJob, StartedJob } from "./job";
import { useApplyScan } from "./useApplyScan";
import ContinueList from "./parts/ContinueList";
import ContinuePrompt from "./parts/ContinuePrompt";
import RoleStep from "./steps/RoleStep";
import ResumeStep from "./steps/ResumeStep";
import CoverStep from "./steps/CoverStep";
import IntroStep from "./steps/IntroStep";
import SubmitStep from "./steps/SubmitStep";

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Quiet after the last change before it is saved. Saves count against the backend's general
 * per-user limit (1000 requests a quarter hour), so typing saves at its pauses, not per key;
 * leaving the page saves at once.
 */
const SAVE_DEBOUNCE_MS = 1500;

const ApplyClient: FC = () => (
  <Suspense
    fallback={
      <FrontFrame>
        <FrontDoorSkeleton />
      </FrontFrame>
    }>
    <ApplyScreen />
  </Suspense>
);

/** The front door, or the application the address names. */
const ApplyScreen: FC = () => {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("session");
  const sessionId = raw && OBJECT_ID.test(raw) ? raw : null;
  const open = useCallback((id: string) => router.push(`/dashboard/apply?session=${encodeURIComponent(id)}`), [router]);
  const leave = useCallback(() => router.push("/dashboard/apply"), [router]);

  if (!sessionId) return <FrontDoor onOpen={open} />;
  // Keyed on the session, so another one starts from a clean wizard.
  return <SessionLoader key={sessionId} id={sessionId} onLeave={leave} />;
};

const FrontFrame: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#f6f6f6]">
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
      <h1 className="whitespace-nowrap text-[17px] font-bold text-primary">Apply to a job</h1>
      <NotificationBell className="ml-auto" />
    </header>
    <main className="px-8 py-10 pb-14">{children}</main>
  </div>
);

/** The front door's shape while the page reads its address: skeletons, not a spinner (owner, 2026-10-03). */
const FrontDoorSkeleton: FC = () => (
  <Loading label="Loading" className="mx-auto flex max-w-[720px] flex-col gap-4">
    <Bone className="h-7 w-72 max-w-full" />
    <Bone className="h-3 w-96 max-w-full" />
    <div className="mt-2 flex flex-wrap gap-2">
      {["w-24", "w-36", "w-28", "w-40"].map((width) => (
        <Bone key={width} className={cn("h-9 rounded-md", width)} />
      ))}
    </div>
    <div className="rounded-2xl border border-black/10 bg-white p-6">
      <LinesSkeleton lines={1} className="max-w-sm" />
      <Bone className="mt-4 h-10 w-full rounded-lg" />
    </div>
  </Loading>
);

/** An application's shape while it opens: the steps, the resume card and the score card. */
const WizardSkeleton: FC = () => (
  <Loading label="Opening your application" className="mx-auto flex max-w-[1100px] flex-col gap-5">
    <div className="flex flex-wrap items-center gap-3">
      {[0, 1, 2, 3, 4].map((step) => (
        <Bone key={step} className="h-8 w-32 rounded-full" />
      ))}
    </div>
    <div className="rounded-2xl border border-black/10 bg-white p-6">
      <Bone className="h-4 w-56 max-w-full" />
      <Bone className="mt-2 h-3 w-96 max-w-full" />
      <RowsSkeleton rows={2} className="mt-4" />
    </div>
    <div className="flex flex-col gap-5 rounded-2xl border border-black/10 bg-white p-6 sm:flex-row sm:items-start sm:gap-7">
      <Bone className="h-32 w-32 flex-none rounded-full" />
      <div className="flex flex-1 flex-col gap-3 pt-1">
        <Bone className="h-7 w-28 rounded-full" />
        <LinesSkeleton lines={3} className="max-w-xl" />
      </div>
    </div>
  </Loading>
);

const FrontDoor: FC<{ onOpen: (id: string) => void }> = ({ onOpen }) => {
  const queryClient = useQueryClient();
  const resumable = useQuery({
    queryKey: qk.apply.resumable(),
    queryFn: ({ signal }) => listResumableSessions(signal),
    staleTime: 0,
  });
  const [prompt, setPrompt] = useState<{ existing: ApplySessionSummary; picked: PickedJob; clientId: string } | null>(null);
  const [starting, setStarting] = useState(false);

  async function create(picked: PickedJob, clientId: string, discard?: string) {
    setStarting(true);
    try {
      const session = await createApplySession({ job: picked, clientId, ...(discard ? { discard } : {}) });
      // Handed straight to the screen it opens, so it doesn't read back what it was just given.
      queryClient.setQueryData(qk.apply.session(session.id), session);
      void queryClient.invalidateQueries({ queryKey: qk.apply.resumable() });
      setPrompt(null);
      onOpen(session.id);
    } catch (error) {
      toast.error("That application couldn't be started", { description: apiMessage(error) });
    } finally {
      setStarting(false);
    }
  }

  async function start(picked: PickedJob) {
    // The application's client id is minted here, in the handler, never during a render: it is the
    // create's idempotency key.
    const clientId = newClientId("app");
    const link = picked.url ?? picked.applyUrl;
    if (link) {
      setStarting(true);
      const existing = await matchApplySession(link).catch(() => null);
      setStarting(false);
      if (existing) {
        setPrompt({ existing, picked, clientId });
        return;
      }
    }
    await create(picked, clientId);
  }

  async function dismiss(id: string) {
    queryClient.setQueryData<ApplySessionSummary[]>(qk.apply.resumable(), (rows) => rows?.filter((row) => row.id !== id));
    try {
      await deleteApplySession(id);
    } catch (error) {
      toast.error(apiMessage(error));
      void resumable.refetch();
    }
  }

  return (
    <FrontFrame>
      <div className="mx-auto max-w-[720px]">
        <ContinueList sessions={resumable.data ?? []} onOpen={onOpen} onDismiss={(id) => void dismiss(id)} />
        {starting && !prompt && (
          <Loading label="Starting your application" className="mb-4">
            <RowsSkeleton rows={1} />
          </Loading>
        )}
      </div>
      <StartApplication onStart={(picked) => void start(picked)} />
      <ContinuePrompt
        existing={prompt?.existing ?? null}
        starting={starting}
        onContinue={() => {
          if (!prompt) return;
          const id = prompt.existing.id;
          setPrompt(null);
          onOpen(id);
        }}
        onStartNew={() => prompt && void create(prompt.picked, prompt.clientId, prompt.existing.id)}
        onCancel={() => setPrompt(null)}
      />
    </FrontFrame>
  );
};

const SessionLoader: FC<{ id: string; onLeave: () => void }> = ({ id, onLeave }) => {
  const session = useQuery({
    queryKey: qk.apply.session(id),
    queryFn: ({ signal }) => getApplySession(id, signal),
    // Read once: from here on the wizard is ahead of the server, and a refetch would put older
    // words back under someone's cursor.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (count, error) => !(error instanceof BackendError && error.status === 404) && count < 2,
  });

  if (session.isPending) {
    return (
      <FrontFrame>
        <WizardSkeleton />
      </FrontFrame>
    );
  }
  if (session.isError) {
    const missing = session.error instanceof BackendError && session.error.status === 404;
    return (
      <FrontFrame>
        <div className="mx-auto flex max-w-[720px] flex-col items-start gap-3">
          <p className="text-sm text-black/60">
            {missing ? "That application couldn't be found. It may have been removed." : apiMessage(session.error)}
          </p>
          <StickerButton variant="outline" size="md" onClick={missing ? onLeave : () => void session.refetch()}>
            {missing ? "Start an application" : "Try again"}
          </StickerButton>
        </div>
      </FrontFrame>
    );
  }
  return <ApplyWizard session={session.data} onLeave={onLeave} />;
};

type SaveStatus = "saved" | "saving" | "error";

const ApplyWizard: FC<{ session: ApplySessionItem; onLeave: () => void }> = ({ session, onLeave }) => {
  const queryClient = useQueryClient();
  const { recordAction } = useActivity();
  const createApplication = useCreateApplication();
  const moveApplication = useUpdateApplication();
  const scan = useApplyScan();
  const job = useMemo<StartedJob>(() => ({ ...session.job, clientId: session.clientId }), [session]);
  const duplicate = useDuplicateApplication({ company: job.company, role: job.role, url: job.url ?? job.applyUrl ?? undefined });
  // The same posting, already sent this week: most often the extension logged the ATS form's submit
  // for this RWW listing. `dataUpdatedAt` is the clock, as the tracker's is: none is read in render.
  const alreadyTracked = isTrackedSamePosting(duplicate.data, duplicate.dataUpdatedAt);

  const [step, setStep] = useState<ApplyStepNum>(() => readStep(session.step));
  const [visited, setVisited] = useState<ReadonlySet<ApplyStepNum>>(
    () => new Set<ApplyStepNum>([...readVisited(session.visited, readStep(session.step)), 2]),
  );
  const [state, setState] = useState<ApplyState>(() => readApplyState(session.state));
  const [status, setStatus] = useState<ApplySessionStatus>(session.status);
  const [closedElsewhere, setClosedElsewhere] = useState(false);
  const editable = status === "active" && !state.tracked && !closedElsewhere;
  const update = useCallback((recipe: (current: ApplyState) => ApplyState) => setState((prev) => recipe(prev)), []);

  // ---- Autosave ---------------------------------------------------------------------------------
  // The step, the visited steps and the whole state go up together, a moment after the last change,
  // one save at a time and in order; leaving the page sends the last word.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const latest = useRef({ step, visited, state });
  useEffect(() => {
    latest.current = { step, visited, state };
  });
  const dirty = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const save = useCallback(
    (keepalive = false): Promise<unknown> => {
      const turn = queue.current.then(async () => {
        if (!dirty.current) return;
        dirty.current = false;
        const now = latest.current;
        if (!keepalive) setSaveStatus("saving");
        try {
          await saveApplySession(
            session.id,
            { step: now.step, visited: [...now.visited], state: now.state as unknown as Record<string, unknown> },
            { keepalive },
          );
          if (!keepalive) setSaveStatus("saved");
        } catch (error) {
          // Finished or set aside elsewhere (another tab, "start a new one"): nothing more is saved here.
          if (error instanceof BackendError && error.status === 409) {
            setClosedElsewhere(true);
            setSaveStatus("saved");
            return;
          }
          dirty.current = true;
          if (!keepalive) setSaveStatus("error");
        }
      });
      queue.current = turn;
      return turn;
    },
    [session.id],
  );

  const seeded = useRef(false);
  useEffect(() => {
    // What the session was opened with is what the server already holds.
    if (!seeded.current) {
      seeded.current = true;
      return;
    }
    if (status !== "active" || closedElsewhere) return;
    dirty.current = true;
    const timer = window.setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [step, visited, state, status, closedElsewhere, save]);

  useEffect(() => {
    const onPageHide = () => void save(true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      void save(true);
    };
  }, [save]);

  // ---- What goes out ------------------------------------------------------------------------------
  const resumeId = sendingResumeId(state.resume);
  const sending = useIngestedResumeQuery(resumeId);
  const resumeName = state.resume.sendDraft && state.resume.draftId ? state.resume.draftName : state.resume.baseName;
  // A score only counts for the resume — and the version of it — it was run on.
  const atsScore =
    state.scan && state.scan.resumeId === resumeId && state.scan.version === (sending.data?.version ?? null)
      ? Math.round(state.scan.report.score)
      : null;
  const sentLetter = state.cover.skipped ? null : state.cover.letter.trim().slice(0, APPLICATION_LIMITS.coverLetterMax) || null;

  function go(next: ApplyStepNum) {
    setStep(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  // ---- Finishing --------------------------------------------------------------------------------
  // Once "Track as applied" has run: the state that says so is saved, then the session is closed with
  // the application it became. In an effect, so the save reads the state the click produced.
  const applicationIdRef = useRef<Promise<string | null> | string | null>(null);
  const finishing = useRef(false);
  useEffect(() => {
    if (!state.tracked || status !== "active" || finishing.current) return;
    finishing.current = true;
    dirty.current = true;
    void save()
      .then(() => Promise.resolve(applicationIdRef.current).catch(() => null))
      .then((applicationId) => finishApplySession(session.id, applicationId ?? null))
      .then(() => {
        setStatus("finished");
        void queryClient.invalidateQueries({ queryKey: qk.apply.resumable() });
      })
      .catch(() => {
        // Tracked either way; the session stays open and is finished on the next try.
        finishing.current = false;
      });
  }, [state.tracked, status, save, session.id, queryClient]);

  /**
   * "Track as applied". The same posting already sent this week is this very
   * application — nothing new is made, and only what that card lacks (the
   * resume, its score) is added to it: its answers and letter came from the
   * form that went out, the truer record. A saved card for this job moves to
   * Applied carrying what was sent; anything else is a new application, marked
   * as a repeat when an earlier one was actually sent. All write behind the
   * screen, the tracker's way: a failure comes back as a toast with Retry, and
   * the client id makes a retried create write once.
   *
   * A tailored draft that went out is kept: it joins the resume lists under the
   * name it was sent with.
   */
  function track(answers: ApplicationAnswer[]) {
    if (state.tracked || !editable) return;
    const prior = duplicate.data ?? null;
    const sent = { atsScore, resumeId, coverLetter: sentLetter, answers };

    if (state.resume.sendDraft && state.resume.draftId) {
      const draftId = state.resume.draftId;
      const name = state.resume.draftName ?? `Resume for ${job.company}`;
      void keepDraftResume(draftId, name)
        .then(() => queryClient.invalidateQueries({ queryKey: qk.ats.ingested() }))
        .catch(() =>
          toast.warning("The tailored resume wasn't added to your resumes", { description: "It's still recorded on the application." }),
        );
    }

    if (alreadyTracked && prior) {
      const fill: UpdateApplicationInput = {};
      if (prior.resumeId === null && resumeId) fill.resumeId = resumeId;
      if (prior.atsScore === null && atsScore !== null) fill.atsScore = atsScore;
      if (Object.keys(fill).length > 0 && !moveApplication(prior.id, fill)) {
        // A side record, as the answer log is: the application is tracked either way.
        updateApplication(prior.id, fill)
          .then(() => void queryClient.invalidateQueries({ queryKey: qk.activity.applications() }))
          .catch(() => undefined);
      }
      toast.success(`${job.company} is already on your tracker`, { description: "Logged when you sent it, so it isn't added twice." });
      applicationIdRef.current = prior.id;
      update((s) => ({ ...s, tracked: true }));
      return;
    }

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
            update((s) => ({ ...s, tracked: false }));
            toast.error(`${job.company} wasn't tracked`, { description: apiMessage(error) });
          });
      }
      recordAction("application", prior.id, `Applied to ${job.company}`);
      logAnswerUses(prior.id, answers);
      applicationIdRef.current = prior.id;
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
      const created = createdApplicationId(job.clientId);
      logAnswerUses(created, answers);
      applicationIdRef.current = created;
    }
    update((s) => ({ ...s, tracked: true }));
  }

  const renderStep = (n: ApplyStepNum): ReactNode => {
    switch (n) {
      case 1:
        return <RoleStep job={job} duplicate={duplicate.data} alreadyTracked={alreadyTracked} />;
      case 2:
        return <ResumeStep job={job} state={state} update={update} editable={editable} scan={scan} />;
      case 3:
        return (
          <CoverStep
            job={job}
            resumeId={resumeId}
            resumeName={resumeName}
            cover={state.cover}
            onCoverChange={(recipe) => update((s) => ({ ...s, cover: recipe(s.cover) }))}
            editable={editable}
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
            alreadyTracked={alreadyTracked}
            tracked={state.tracked}
            onTrack={track}
            onEditStep={go}
            questions={state.questions}
            onQuestionsChange={(recipe) => update((s) => ({ ...s, questions: recipe(s.questions) }))}
          />
        );
    }
  };

  const banner =
    status === "discarded"
      ? "You started a new application for this job, so this one was set aside. It's here to look at; nothing changes."
      : closedElsewhere
        ? "This application was finished or set aside in another tab, so changes here aren't saved."
        : status === "finished" && !state.tracked
          ? "This application is finished."
          : null;

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-black/10 bg-white/85 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between gap-4 px-8">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMini className="h-6 w-6 flex-none" />
            <h1 className="truncate text-[17px] font-bold text-primary">
              {job.role} at {job.company}
            </h1>
            <span className="hidden text-sm text-black/30 lg:inline">·</span>
            <span className="hidden whitespace-nowrap text-sm text-black/45 lg:inline">Step {step} of 5</span>
            <SaveNote
              status={status === "active" && !closedElsewhere ? saveStatus : null}
              onRetry={() => {
                dirty.current = true;
                void save();
              }}
            />
          </div>
          <div className="flex flex-none items-center gap-3">
            <StickerButton variant="outline" size="md" onClick={onLeave}>
              Change job
            </StickerButton>
            <StickerButton variant="primary" size="md" disabled={step === 5} onClick={() => go(Math.min(5, step + 1) as ApplyStepNum)}>
              Continue
            </StickerButton>
            <NotificationBell />
          </div>
        </div>

        {/* Step tracker */}
        <div className="overflow-x-auto px-8 pb-4">
          <div className="flex min-w-max items-center gap-2">
            {APPLY_STEPS.map((n, idx) => {
              const isDone = n < step;
              const isActive = n === step;
              return (
                <div key={n} className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-current={isActive ? "step" : undefined}
                    onClick={() => go(n)}
                    className="group flex cursor-pointer items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold transition-colors",
                        isDone
                          ? "bg-primary/90 text-secondary"
                          : isActive
                            ? "bg-primary/90 text-white"
                            : "bg-[#f0f0ea] text-black/40 group-hover:bg-[#e7e7df]",
                      )}>
                      {isDone ? <Check className="h-3 w-3" /> : n}
                    </span>
                    <span
                      className={cn(
                        "whitespace-nowrap text-sm",
                        isActive ? "font-bold text-primary" : isDone ? "font-semibold text-black/60" : "font-medium text-black/40",
                      )}>
                      {APPLY_STEP_LABELS[n]}
                    </span>
                  </button>
                  {idx < APPLY_STEPS.length - 1 && <span className="h-px w-10 flex-none bg-black/10" />}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* The whole width the dashboard gives it (owner, 2026-10-03). */}
      <main className="px-8 py-7 pb-10">
        {banner && <p className="mb-5 rounded-xl border border-black/12 bg-white px-4 py-3 text-sm text-black/65">{banner}</p>}
        {APPLY_STEPS.map((n) =>
          visited.has(n) ? (
            <div key={n} hidden={step !== n}>
              {renderStep(n)}
            </div>
          ) : null,
        )}

        {/* Footer nav. The last step's action is its own "Track as applied". */}
        <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-6">
          {step > 1 ? (
            <StickerButton variant="outline" size="md" onClick={() => go((step - 1) as ApplyStepNum)}>
              Back a step
            </StickerButton>
          ) : (
            <span />
          )}
          {step < 5 && (
            <StickerButton variant="primary" size="lg" onClick={() => go((step + 1) as ApplyStepNum)}>
              Continue
            </StickerButton>
          )}
        </div>
      </main>
    </div>
  );
};

/** Whether the latest changes are on the server: quiet when they are, a retry when they aren't. */
const SaveNote: FC<{ status: SaveStatus | null; onRetry: () => void }> = ({ status, onRetry }) => {
  if (status === null) return null;
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="hidden cursor-pointer whitespace-nowrap text-xs font-semibold text-[#b23c26] underline decoration-dotted underline-offset-2 lg:inline">
        Not saved. Retry
      </button>
    );
  }
  return <span className="hidden whitespace-nowrap text-xs text-black/40 lg:inline">{status === "saving" ? "Saving…" : "Saved"}</span>;
};

export default ApplyClient;
