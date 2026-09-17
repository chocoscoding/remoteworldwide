"use client";

// Ask about a job.
//
// The user picks a job through the dashboard's one picker. The screen opens
// that job's thread in the AI service, and every question is answered from the
// posting's real text and the user's real resume. Answers live on the thread,
// so a job opened again shows what was already asked, and asking the same thing
// again is free.
//
// Nothing is asked on the user's behalf. The old screen seeded a "fit" answer
// the moment a job was picked. Now that each new answer costs a credit, doing
// that would spend someone's balance without a click.
//
// The picked job rides in the URL as ?job=<savedJobId>, so leaving for billing
// or the resume tailor and coming back (or reloading) lands on the same job and
// its answers instead of the empty state.

import { FC, ReactNode, Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, Clock, CreditCard, ExternalLink, Loader2, MapPin, Mic, Repeat2, RotateCcw, SendHorizontal, X } from "lucide-react";
import { Lottie } from "lottie-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton, { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import { useJobPicker } from "@/app/components/dashboard/jobs/JobPickerProvider";
import { useVoiceSession } from "@/app/components/dashboard/voice/useVoiceSession";
import { JD_QUICK_QUESTIONS } from "@/app/lib/dashboard/mock-data";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { BILLING_HREF, MAX_JOB_QUESTION_CHARS, askAnnouncement, describeAskFailure, isQuickQuestionId, type AskFailure } from "@/app/lib/jobs/ask";
import { parseFieldSpec, toPickedJob, type PickedJob } from "@/app/lib/jobs/fields";
import type {
  AskJobInput,
  EmploymentType,
  JdQuickQuestionId,
  JobAnswer,
  JobSource,
  JobThreadEntry,
  RemoteType,
  SavedJobItem,
} from "@/app/lib/jobs/types";
import { qk } from "@/app/lib/query/keys";
import { useAskJob } from "@/hooks/mutations/useAskJob";
import { useSavedJobQuery } from "@/hooks/queries/useJobQueries";
import { useJobThread } from "@/hooks/queries/useJobThread";

// ---------------------------------------------------------------------------
// What this screen asks the picker for. Company, role and description are
// required because the answers are grounded in the posting's text. Everything
// else is shown on the job card when the job has it and left out when it doesn't.
// ---------------------------------------------------------------------------

const JOB_SPEC =
  "company, role, description, summary?, salary?, location?, remoteType?, employmentType?, requirements?, url?, applyUrl?, companyLogo?";
type AskedJob = PickedJob<typeof JOB_SPEC>;
const JOB_SPEC_PARSED = parseFieldSpec(JOB_SPEC);

/** The search param naming the picked saved job. */
const JOB_PARAM = "job";

/** Live dictation under the composer shows its newest words, on one line. */
const INTERIM_TAIL_CHARS = 90;

/**
 * A saved job read back from ?job=, as the screen's picked job. Null when it no
 * longer has what the screen requires (a description edited away), which the
 * picker would never have handed back.
 */
function askedJobFrom(saved: SavedJobItem): AskedJob | null {
  try {
    return toPickedJob<typeof JOB_SPEC>(saved, JOB_SPEC_PARSED, saved.extraction.sources);
  } catch {
    return null;
  }
}

/** This page's URL with ?job= pointed at `id`, or dropped. Every other param is kept. */
function hrefWithJob(pathname: string, params: { toString(): string }, id: string | null): string {
  const next = new URLSearchParams(params.toString());
  if (id === null) next.delete(JOB_PARAM);
  else next.set(JOB_PARAM, id);
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** The chips, narrowed to the ids the AI service accepts as `questionId`. */
const QUICK_QUESTIONS = JD_QUICK_QUESTIONS.flatMap((q) => (isQuickQuestionId(q.id) ? [{ id: q.id, label: q.label }] : []));

const SOURCE_LABEL: Record<JobSource, string> = {
  platform: "On Remote Worldwide",
  link: "Saved from a link",
  paste: "Pasted job",
  manual: "Added by you",
};

const REMOTE_LABEL: Record<RemoteType, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

// Links styled as sticker buttons rather than a <button> nested inside an <a>,
// which is invalid HTML and gives keyboard users two tab stops for one action.
const OUTLINE_LINK = cn(stickerButtonVariants({ variant: "outline", size: "sm" }), "hover:shadow-[3px_3px_0_0_#e1f073]");
const PRIMARY_LINK_SM = cn(stickerButtonVariants({ variant: "primary", size: "sm" }), "hover:shadow-[3px_3px_0_0_#e1f073]");
const PRIMARY_LINK_MD = cn(stickerButtonVariants({ variant: "primary", size: "md" }), "hover:shadow-[4px_4px_0_0_#e1f073]");

/**
 * A URL from a posting, or null. The backend already refuses other schemes,
 * but these values were typed by a user or lifted from a page. This is where
 * one becomes a clickable href or an image source, so it is checked again here
 * rather than trusting a rule enforced two services away.
 */
function safeUrl(value: string | null, { allowMailto = false } = {}): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    return allowMailto && url.protocol === "mailto:" ? url.href : null;
  } catch {
    return null;
  }
}

/** "Lagos · Hybrid", without writing "Remote · Remote" when the location already says it. */
function whereLine(location: string | null, remoteType: RemoteType | null): string | null {
  const remote = remoteType ? REMOTE_LABEL[remoteType] : null;
  const place = location?.trim() || null;
  if (place && remote && place.toLowerCase() === remote.toLowerCase()) return place;
  return [place, remote].filter(Boolean).join(" · ") || null;
}

// ---------------------------------------------------------------------------
// The transcript shows the thread's stored entries first, then the asks made
// during this visit.
//
// An ask stays in local state only until the thread holds its answer. A new,
// charged answer is written into the thread's cache as it lands, so its local
// copy steps aside and the stored entry takes its place. Two kinds of answered
// ask stay local. One is a repeat: the thread already shows it further up, but
// the user just asked again and should see it answered. The other is an answer
// the service never stores, the "upload a resume" reply to "Am I a fit?".
// Pending and failed asks only ever exist locally.
// ---------------------------------------------------------------------------

type AskState =
  | { status: "pending" }
  | { status: "answered"; entry: JobThreadEntry; charged: boolean; repeat: boolean }
  | { status: "failed"; failure: AskFailure };

interface LocalAsk {
  key: string;
  input: AskJobInput;
  /** The user's bubble text until the service returns its own wording of the question. */
  question: string;
  state: AskState;
}

const CoachAvatar: FC = () => (
  <div
    aria-hidden
    className="h-8 w-8 flex-none rounded-full bg-secondary text-primary font-extrabold text-[11px] flex items-center justify-center mt-0.5">
    RW
  </div>
);

const QuestionBubble: FC<{ text: string }> = ({ text }) => (
  <div className="flex justify-end">
    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-white px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line break-words">
      {text}
    </div>
  </div>
);

const AnswerBubble: FC<{ answer: JobAnswer; note: string | null }> = ({ answer, note }) => (
  <div className="flex items-start gap-2.5">
    <CoachAvatar />
    <div className="max-w-[85%] flex flex-col gap-3">
      <div className="rounded-2xl rounded-tl-sm bg-[#f6f6f6] px-4 py-3">
        <p className="text-sm text-black/80 leading-relaxed">{answer.verdict}</p>
      </div>

      {answer.missing.trim() !== "" && (
        <div className="flex items-start gap-2 rounded-xl bg-[#fbfbf7] border border-black/8 px-3.5 py-3">
          <AlertTriangle className="h-4 w-4 flex-none text-black/40 mt-0.5" aria-hidden />
          <div>
            <p className="text-[10.5px] font-bold text-black/45 uppercase tracking-[0.08em] mb-1">What&apos;s missing</p>
            <p className="text-sm text-black/65 leading-relaxed">{answer.missing}</p>
          </div>
        </div>
      )}

      {answer.tips.length > 0 && (
        <div>
          <p className="text-[10.5px] font-bold text-black/45 uppercase tracking-[0.08em] mb-1.5">What I&apos;d do</p>
          <ol className="flex flex-col gap-1.5">
            {answer.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-black/75 leading-relaxed">
                <span className="h-5 w-5 flex-none rounded-full bg-[#f0f0ea] text-[11px] font-bold text-primary flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ol>
        </div>
      )}

      {answer.evidence.length > 0 && (
        <div>
          <p className="text-[10.5px] font-bold text-black/45 uppercase tracking-[0.08em] mb-1.5">From your resume</p>
          <ul className="flex flex-col gap-2">
            {answer.evidence.map((item, i) => (
              <li key={i} className="border-l-2 border-secondary pl-3 text-sm text-black/70 leading-relaxed">
                {item.text}
                {item.role && <span className="block text-[11px] font-medium text-black/40 mt-0.5">{item.role}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard/resume" className={OUTLINE_LINK}>
          Tailor resume
        </Link>
        <Link href="/dashboard/referrals" className={OUTLINE_LINK}>
          Find a referral
        </Link>
        {note && <span className="text-[11px] font-medium text-black/40">{note}</span>}
      </div>
    </div>
  </div>
);

// Announced through the transcript's status region rather than here: a region
// inserted along with its text is often not read, and this one disappears the
// moment the answer arrives.
const ThinkingBubble: FC = () => (
  <div className="flex items-start gap-2.5">
    <CoachAvatar />
    <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm bg-[#f6f6f6] px-4 py-3 text-sm text-black/55">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Thinking…
    </div>
  </div>
);

const FailureBubble: FC<{ failure: AskFailure; onRetry: () => void; retryDisabled: boolean }> = ({ failure, onRetry, retryDisabled }) => {
  const retry = failure.retryable ? (
    <StickerButton variant="outline" size="sm" onClick={onRetry} disabled={retryDisabled}>
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
      Try again
    </StickerButton>
  ) : null;

  if (failure.kind === "credits") {
    return (
      <div className="flex items-start gap-2.5" role="alert">
        <CoachAvatar />
        <div className="max-w-[85%] rounded-xl border-[1.5px] border-[#222325] bg-white px-4 py-3.5 shadow-[3px_3px_0_0_#e1f073]">
          <div className="flex items-start gap-2.5">
            <CreditCard className="h-4 w-4 flex-none text-primary mt-0.5" aria-hidden />
            <div>
              <p className="text-sm font-bold text-primary">You&apos;re out of credits</p>
              <p className="mt-1 text-sm text-black/60 leading-relaxed">{failure.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {/* A new tab, so this question and its Try again are still here once the top-up is done. */}
                <Link href={BILLING_HREF} target="_blank" rel="noopener noreferrer" className={PRIMARY_LINK_SM}>
                  Get credits
                </Link>
                {retry}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5" role="alert">
      <CoachAvatar />
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[#b23c26]/20 bg-[#fdf4f2] px-4 py-3">
        <div className="flex items-start gap-2">
          {failure.kind === "limited" ? (
            <Clock className="h-4 w-4 flex-none text-[#b23c26] mt-0.5" aria-hidden />
          ) : (
            <AlertTriangle className="h-4 w-4 flex-none text-[#b23c26] mt-0.5" aria-hidden />
          )}
          <p className="text-sm text-[#b23c26] leading-relaxed">{failure.message}</p>
        </div>
        {retry && <div className="mt-2.5">{retry}</div>}
      </div>
    </div>
  );
};

/** A posting's logo, or nothing. A broken image looks worse than no image. */
const CompanyLogo: FC<{ src: string; company: string }> = ({ src, company }) => {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    // A plain <img>, as in Avatar.tsx: logos come from whatever host a posting
    // names, and next/image would need every one of them in remotePatterns.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${company} logo`}
      onError={() => setBroken(true)}
      className="h-11 w-11 flex-none rounded-xl border border-black/10 bg-white object-contain p-1"
    />
  );
};

const JobCard: FC<{ job: AskedJob }> = ({ job }) => {
  const logo = safeUrl(job.companyLogo);
  const applyHref = safeUrl(job.applyUrl, { allowMailto: true });
  const postingHref = safeUrl(job.url);
  const link = applyHref
    ? { href: applyHref, label: applyHref.startsWith("mailto:") ? "Apply by email" : "Apply", mail: applyHref.startsWith("mailto:") }
    : postingHref
      ? { href: postingHref, label: "View the posting", mail: false }
      : null;
  const where = whereLine(job.location, job.remoteType);

  return (
    <DashCard className="p-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="mb-4 flex items-start justify-between gap-3">
        <Pill variant="neutral">{SOURCE_LABEL[job.source]}</Pill>
        {logo && <CompanyLogo key={logo} src={logo} company={job.company} />}
      </div>
      <p className="text-lg font-bold text-primary leading-snug">{job.role}</p>
      <p className="text-sm text-black/50 font-medium">{job.company}</p>

      {(job.salary || where || job.employmentType) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {job.salary && <Pill variant="positive">{job.salary}</Pill>}
          {where && (
            <Pill variant="neutral" className="gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {where}
            </Pill>
          )}
          {job.employmentType && <Pill variant="neutral">{EMPLOYMENT_LABEL[job.employmentType]}</Pill>}
        </div>
      )}

      {job.summary && <p className="mt-5 text-sm text-black/70 leading-relaxed">{job.summary}</p>}

      {job.requirements.length > 0 && (
        <div className="mt-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-2">What they want</p>
          <ul className="flex flex-col gap-1.5">
            {job.requirements.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-black/70 leading-relaxed">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-primary/40" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {link && (
        <div className="mt-5">
          <a
            href={link.href}
            target={link.mail ? undefined : "_blank"}
            rel={link.mail ? undefined : "noopener noreferrer"}
            className={PRIMARY_LINK_MD}>
            {link.label}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      )}

      <p className="mt-6 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-2">Full description</p>
      <p className="text-sm text-black/70 leading-relaxed whitespace-pre-line break-words">{job.description}</p>
    </DashCard>
  );
};

const JdqaScreen: FC = () => {
  const { pickJob } = useJobPicker();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [asks, setAsks] = useState<LocalAsk[]>([]);
  const [composerValue, setComposerValue] = useState("");

  // No job, no questions — this screen has nothing to say until one is picked,
  // so the picker is the default state rather than a job being assumed.
  //
  // The job is named in the URL as well as held here. A job picked on this
  // visit is used as the picker returned it; any other id in the URL (a reload,
  // Back from billing, a shared link) is read from saved jobs.
  const urlJobId = searchParams.get(JOB_PARAM) || null;
  const [picked, setPicked] = useState<AskedJob | null>(null);
  // The id this screen last wrote to the URL, until the URL shows it. Next
  // applies a history write in a transition, so for a render the URL still
  // names the previous job, and reading it then would flash (and fetch) that job.
  const [written, setWritten] = useState<{ id: string | null } | null>(null);
  if (written && written.id === urlJobId) setWritten(null);
  const jobId = written ? written.id : urlJobId;

  const pickedJob = picked && picked.id === jobId ? picked : null;
  const saved = useSavedJobQuery(jobId !== null && !pickedJob ? jobId : null);
  const savedJob = !pickedJob && saved.data && saved.data.id === jobId ? saved.data : null;
  const restoredJob = savedJob ? askedJobFrom(savedJob) : null;
  const job = pickedJob ?? restoredJob;
  // Deleted since the URL was made (404), or edited until it has no description
  // to answer from. Either way there is nothing to restore, so the URL stops
  // naming it and the screen asks which job instead.
  const jobGone =
    jobId !== null &&
    !pickedJob &&
    ((saved.error instanceof BackendError && saved.error.status === 404) || (savedJob !== null && restoredJob === null));
  const restoreFailed = jobId !== null && !job && !jobGone && saved.isError;
  const restoring = jobId !== null && !job && !jobGone && !saved.isError;

  // Every job starts its own conversation, however the job changed: a pick,
  // Clear, or the URL naming another one. Carrying answers about a different
  // posting across would be worse than useless.
  const [conversationFor, setConversationFor] = useState(jobId);
  if (conversationFor !== jobId) {
    setConversationFor(jobId);
    setAsks([]);
    setComposerValue("");
  }

  useEffect(() => {
    if (jobGone) window.history.replaceState(null, "", hrefWithJob(pathname, searchParams, null));
  }, [jobGone, pathname, searchParams]);

  const askSeq = useRef(0);
  // Bumped whenever the job changes, so an answer still in flight for the
  // previous job cannot land in the next one's transcript.
  const jobEpoch = useRef(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const thread = useJobThread(job?.id ?? null);
  const askJob = useAskJob();

  const threadItem = thread.data;
  // Asks go out only against a settled thread. While a reopen is in flight
  // (after a pick, or after a 409 from an edited posting), the cached thread is
  // the one being replaced, and asking on it would only earn another 409.
  const ready = threadItem !== undefined && !thread.isFetching;
  // One ask at a time. The service could take more, but they would all draw on
  // the same hourly allowance, and a transcript that answers out of order reads
  // as confused.
  const busy = asks.some((ask) => ask.state.status === "pending");

  const storedIds = new Set(threadItem?.entries.map((entry) => entry.id));
  const answeredIds = new Set<JdQuickQuestionId>(threadItem?.answeredQuestionIds);
  const chargedIds = new Set(asks.flatMap((ask) => (ask.state.status === "answered" && ask.state.charged ? [ask.state.entry.id] : [])));
  const localAsks = asks.filter((ask) => !(ask.state.status === "answered" && !ask.state.repeat && storedIds.has(ask.state.entry.id)));

  // Keep the newest exchange in view: a new ask, an answer replacing its
  // thinking bubble, or a thread opening onto earlier answers.
  const exchangeCount = (threadItem?.entries.length ?? 0) + localAsks.length;
  const lastStatus = asks.length > 0 ? asks[asks.length - 1].state.status : "none";
  const latest = asks.length > 0 ? asks[asks.length - 1].state : null;
  const announcement = askAnnouncement(
    latest === null || latest.status !== "answered"
      ? latest
      : { status: "answered", verdict: latest.entry.answer.verdict, charged: latest.charged, repeat: latest.repeat },
  );
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [exchangeCount, lastStatus]);

  // Dictation into the composer, in the browser. Spoken words land in the box
  // like typing, cut to the composer's limit.
  // The job a dictation was started for. Its last words can arrive just after
  // the job changes, and they are dropped rather than landing in the next job's box.
  const dictationEpoch = useRef(0);
  const handleTranscript = useCallback((text: string) => {
    if (dictationEpoch.current !== jobEpoch.current) return;
    setComposerValue((prev) => (prev ? `${prev.trimEnd()} ${text.trim()}` : text.trim()).slice(0, MAX_JOB_QUESTION_CHARS));
  }, []);
  const voice = useVoiceSession({
    onTranscript: handleTranscript,
    voiceEnabled: false,
  });
  const { micStatus, dictationSupported, interim, stopDictation } = voice;
  const listening = micStatus === "listening";
  // A start still waiting on the mic prompt: the mic button calls it off, and so does sending.
  const requesting = micStatus === "requesting";
  const startDictation = () => {
    dictationEpoch.current = jobEpoch.current;
    voice.startDictation();
  };

  function resetConversation() {
    // Dictation ends with the job it was for.
    stopDictation();
    jobEpoch.current += 1;
    setAsks([]);
    setComposerValue("");
  }

  async function chooseJob() {
    try {
      const result = await pickJob(JOB_SPEC);
      if (result.status !== "picked") return;
      resetConversation();
      setPicked(result.job);
      setWritten({ id: result.job.id });
      // Replaced, not pushed, so Back leaves the screen rather than stepping
      // through every job picked on it. Native history, which Next keeps
      // useSearchParams in step with, rather than router.replace, which would
      // fetch the page again for a change only this component reads.
      window.history.replaceState(null, "", hrefWithJob(pathname, searchParams, result.job.id));
      // Picking a job again can follow an edit made inside the picker, and the
      // service keys a thread on the posting's text. A cached thread for this
      // job may belong to the old text, so it is opened afresh.
      void queryClient.invalidateQueries({ queryKey: qk.jobThreads.forSavedJob(result.job.id) });
    } catch (error) {
      // A pick rejects only on a picker bug (see JobPickerProvider); say so rather than fail silently.
      toast.error(apiMessage(error));
    }
  }

  function clearJob() {
    resetConversation();
    setPicked(null);
    setWritten({ id: null });
    window.history.replaceState(null, "", hrefWithJob(pathname, searchParams, null));
  }

  function settle(key: string, state: AskState) {
    setAsks((prev) => prev.map((ask) => (ask.key === key ? { ...ask, state } : ask)));
  }

  async function send(input: AskJobInput, question: string, retryKey?: string) {
    if (!job || !threadItem || !ready || busy) return;
    const epoch = jobEpoch.current;
    const key = retryKey ?? `ask-${++askSeq.current}`;
    if (retryKey) settle(key, { status: "pending" });
    else setAsks((prev) => [...prev, { key, input, question, state: { status: "pending" } }]);

    try {
      const result = await askJob.mutateAsync({ savedJobId: job.id, threadId: threadItem.id, input });
      if (epoch !== jobEpoch.current) return;
      // Checked against the thread as it stood when the question went out. By
      // now `useAskJob` has already appended a newly charged answer to the cache.
      const repeat = threadItem.entries.some((entry) => entry.id === result.entry.id);
      settle(key, { status: "answered", entry: result.entry, charged: result.charged, repeat });
    } catch (error) {
      if (epoch !== jobEpoch.current) return;
      settle(key, { status: "failed", failure: describeAskFailure(error) });
    }
  }

  const askQuick = (id: JdQuickQuestionId, label: string) => {
    if (answeredIds.has(id)) return;
    void send({ questionId: id }, label);
  };

  const submitComposer = () => {
    const text = composerValue.trim();
    if (!text || !ready || busy) return;
    // As in the coach, sending ends dictation, so the next thing said doesn't start filling the box again unasked.
    if (listening || requesting) stopDictation();
    setComposerValue("");
    void send({ question: text }, text);
  };

  let transcript: ReactNode;
  if (!threadItem && thread.isError) {
    transcript = (
      <div className="m-auto flex max-w-[340px] flex-col items-center text-center" role="alert">
        <AlertTriangle className="h-5 w-5 text-[#b23c26]" aria-hidden />
        <p className="mt-2 text-sm text-[#b23c26] leading-relaxed">{apiMessage(thread.error)}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <StickerButton variant="outline" size="sm" onClick={() => void thread.refetch()} disabled={thread.isFetching}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </StickerButton>
          <StickerButton variant="outline" size="sm" onClick={() => void chooseJob()}>
            Pick another job
          </StickerButton>
        </div>
      </div>
    );
  } else if (!threadItem) {
    transcript = (
      <div className="m-auto inline-flex items-center gap-2 text-sm text-black/50" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Opening your conversation…
      </div>
    );
  } else {
    transcript = (
      <>
        {/* A failed reopen with a thread still cached: keep the answers readable and say why asking may not work. */}
        {thread.isError && (
          <div className="flex items-start gap-2 rounded-xl border border-[#b23c26]/20 bg-[#fdf4f2] px-3.5 py-3" role="alert">
            <AlertTriangle className="h-4 w-4 flex-none text-[#b23c26] mt-0.5" aria-hidden />
            <p className="flex-1 text-sm text-[#b23c26] leading-relaxed">{apiMessage(thread.error)}</p>
            <StickerButton variant="outline" size="sm" onClick={() => void thread.refetch()} disabled={thread.isFetching}>
              Try again
            </StickerButton>
          </div>
        )}

        {threadItem.entries.length === 0 && localAsks.length === 0 && (
          <div className="m-auto max-w-[340px] text-center">
            <p className="text-sm font-semibold text-primary">Ask your first question</p>
            <p className="mt-1 text-sm text-black/50 leading-relaxed">
              Pick a quick question above or type your own below. Answers are saved here, so you can come back to them.
            </p>
          </div>
        )}

        {threadItem.entries.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-5">
            <QuestionBubble text={entry.question} />
            <AnswerBubble answer={entry.answer} note={chargedIds.has(entry.id) ? "1 credit used" : null} />
          </div>
        ))}

        {localAsks.map((ask) => (
          <div key={ask.key} className="flex flex-col gap-5">
            <QuestionBubble text={ask.state.status === "answered" ? ask.state.entry.question : ask.question} />
            {ask.state.status === "pending" ? (
              <ThinkingBubble />
            ) : ask.state.status === "answered" ? (
              <AnswerBubble
                answer={ask.state.entry.answer}
                note={ask.state.repeat ? "Asked before · no credit used" : ask.state.charged ? "1 credit used" : null}
              />
            ) : (
              <FailureBubble
                failure={ask.state.failure}
                onRetry={() => void send(ask.input, ask.question, ask.key)}
                retryDisabled={!ready || busy}
              />
            )}
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Ask about a job</h1>
        </div>
        {job && (
          <div className="flex flex-none items-center gap-2">
            <StickerButton variant="outline" size="md" onClick={() => void chooseJob()}>
              <Repeat2 className="h-4 w-4" />
              Change job
            </StickerButton>
            <button
              type="button"
              onClick={clearJob}
              aria-label="Clear this job"
              title="Clear this job"
              className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg border-[1.5px] border-[#222325] bg-white text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#222325] hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1240px] mx-auto">
        {!job && restoring ? (
          <div className="flex min-h-[420px] items-center justify-center" role="status">
            <span className="inline-flex items-center gap-2 text-sm text-black/50">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading your job…
            </span>
          </div>
        ) : !job && restoreFailed ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center" role="alert">
            <AlertTriangle className="h-5 w-5 text-[#b23c26]" aria-hidden />
            <p className="mt-2 max-w-[340px] text-sm text-[#b23c26] leading-relaxed">{apiMessage(saved.error)}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <StickerButton variant="outline" size="sm" onClick={() => void saved.refetch()} disabled={saved.isFetching}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Try again
              </StickerButton>
              <StickerButton variant="outline" size="sm" onClick={() => void chooseJob()}>
                Pick another job
              </StickerButton>
            </div>
          </div>
        ) : !job ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
            <span className="flex h-48 w-48 items-center justify-center rounded-full">
              <Lottie
                src={`/Lottie/neobrutalism/Help_Support-2_lottie.json`}
                autoplay
                loop
                className=""
                speed={0.63}
                style={{ width: 340, height: 340 }}
              />
            </span>
            <h2 className="mt-2 text-xl font-bold text-primary">Which job are we talking about?</h2>
            <p className="mt-2 max-w-[420px] text-sm leading-relaxed text-black/50">
              Pick a role from Remote Worldwide, or paste one in. Whatever you paste is saved to your jobs, so you can come back to it
              later.
            </p>
            <StickerButton variant="primary" size="md" className="mt-3" onClick={() => void chooseJob()}>
              Pick a job
            </StickerButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5 items-start">
            {/* Left: the job, in full */}
            <JobCard job={job} />

            {/* Right: Q&A chat */}
            <DashCard className="p-0 flex flex-col overflow-hidden">
              {/* Quick-question chips */}
              <div className="p-5 border-b border-black/8">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-bold text-primary">Quick questions</p>
                  <p className="text-[11px] font-medium text-black/45">1 credit per new answer · repeats are free</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUESTIONS.map((q) => {
                    const answered = answeredIds.has(q.id);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => askQuick(q.id, q.label)}
                        disabled={answered || !ready || busy}
                        title={answered ? "Answered below" : undefined}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-default",
                          answered
                            ? "bg-[#f0f0ea] text-black/35"
                            : "border border-black/12 bg-white text-primary hover:border-primary disabled:opacity-50 disabled:hover:border-black/12",
                        )}>
                        {answered && <Check className="h-3 w-3" />}
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transcript */}
              <div ref={transcriptRef} className="overflow-y-auto max-h-[520px] min-h-[360px] px-5 py-5 flex flex-col gap-5">
                {transcript}
              </div>
              {/* What the latest ask is doing, for screen readers, from one region
                  that stays mounted. Without it the answer that replaces the
                  thinking bubble lands in silence. Failures are alerts in their
                  own bubbles, so they add nothing here. */}
              <p role="status" className="sr-only">
                {announcement}
              </p>

              {/* Composer */}
              <form
                className="p-4 border-t border-black/8 flex items-center gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitComposer();
                }}>
                <input
                  value={composerValue}
                  onChange={(e) => setComposerValue(e.target.value)}
                  maxLength={MAX_JOB_QUESTION_CHARS}
                  aria-label="Ask anything about this role"
                  placeholder={listening ? "Listening…" : "Ask anything about this role…"}
                  className="flex-1 rounded-full border border-black/12 bg-[#f6f6f6] px-4 py-2.5 text-sm text-primary placeholder:text-black/40 focus:outline-none focus:border-primary/40"
                />
                {/* The coach composer's mic, with its states. Dictated words land in the box like typing. */}
                <button
                  type="button"
                  onClick={listening || requesting ? stopDictation : startDictation}
                  disabled={!dictationSupported || micStatus === "denied"}
                  aria-pressed={listening}
                  aria-label={listening ? "Stop dictating" : requesting ? "Cancel dictation" : "Dictate your question"}
                  title={
                    micStatus === "denied"
                      ? "Mic blocked — type instead"
                      : !dictationSupported
                        ? "Dictation isn't available in this browser"
                        : listening
                          ? "Stop dictating"
                          : requesting
                            ? "Cancel dictation"
                            : micStatus === "unavailable"
                              ? "Dictation isn't available right now — type instead"
                              : "Dictate"
                  }
                  className={cn(
                    "inline-flex h-8 w-8 flex-none items-center justify-center rounded-md cursor-pointer transition-colors disabled:opacity-30 disabled:pointer-events-none",
                    listening ? "bg-[#222325] text-[#e1f073]" : "text-black/45 hover:bg-black/5 hover:text-primary",
                  )}>
                  {micStatus === "requesting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                </button>
                <button
                  type="submit"
                  aria-label="Send question"
                  disabled={!composerValue.trim() || !ready || busy}
                  className="h-10 w-10 flex-none rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-default">
                  <SendHorizontal className="h-4 w-4" />
                </button>
              </form>
              {/* Words not final yet, while dictating. The input's placeholder
                  can show them only while the box is empty, and after the first
                  pause it never is. */}
              {listening && interim && (
                <p data-interim className="-mt-2 truncate px-6 pb-3 text-[11px] font-medium italic text-black/55">
                  {interim.length > INTERIM_TAIL_CHARS ? `…${interim.slice(-INTERIM_TAIL_CHARS).trimStart()}` : interim}
                </p>
              )}
            </DashCard>
          </div>
        )}
      </main>
    </div>
  );
};

/** The screen's frame, shown only if the page is ever prerendered without search params. */
const JdqaFallback: FC = () => (
  <div className="min-h-screen bg-[#f6f6f6]">
    <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
      <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Ask about a job</h1>
    </header>
  </div>
);

// useSearchParams renders everything up to the nearest Suspense boundary on
// the client when a page is prerendered, and `next build` fails a prerendered
// page that has none. This page renders per request today (the dashboard
// layout reads the session), so the fallback should never show; the boundary
// keeps the screen correct if that ever changes.
const JdqaClient: FC = () => (
  <Suspense fallback={<JdqaFallback />}>
    <JdqaScreen />
  </Suspense>
);

export default JdqaClient;
