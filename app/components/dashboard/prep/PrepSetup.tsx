"use client";

import { FC, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, DollarSign, FileText, Info, Loader2, MessageCircle, Presentation, Sparkles, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import { FORMAT_META, QUESTIONS_FOR_LENGTH, SESSION_LENGTHS, formatsLabel, type Difficulty, type PrepTrack, type SessionFormat, type SessionLength } from "@/app/lib/dashboard/prep-data";
import { pickSessionQuestions, usableLikelyQuestions } from "@/app/lib/prep/sessionQuestions";
import { SOURCE_LABELS } from "@/app/lib/prep/trackResume";
import { RESUME_ACCEPT } from "@/app/lib/resume/mime";
import { useBilling } from "@/app/(pages)/(dashboard)/dashboard/settings/BillingProvider";
import { usePrepVoiceConfig } from "@/hooks/queries/usePrepVoiceConfig";
import { useLikelyQuestions } from "@/hooks/queries/usePrepTrackQueries";
import Chip from "./Chip";
import ResumePickerDialog from "./ResumePickerDialog";
import { useTrackResume } from "./useTrackResume";
import { BUTTON_SOLID } from "./prep-styles";

const FORMAT_ICON: Record<SessionFormat, LucideIcon> = { behavioural: MessageCircle, portfolio: Presentation, salary: DollarSign };

const DIFFICULTIES: { id: Difficulty; label: string; note: string }[] = [
  { id: "warm-up", label: "Warm-up", note: "Friendly pacing, no follow-up pressure — good for a first pass at a new format." },
  { id: "standard", label: "Standard", note: "Matches a typical first or second round." },
  { id: "tough", label: "Tough", note: "Pushier follow-ups and pointed pressure — closer to a final round or a panel that likes to dig." },
];

/**
 * Sessions per track per rolling week. Saved sessions now outlive a reload, so
 * a lifetime count would block a track for good; counting the last seven days
 * keeps "come back after acting on your open actions" true.
 */
export const MAX_SESSIONS_PER_TRACK = 6;
const SESSION_CAP_WINDOW_MS = 7 * 24 * 60 * 60_000;

export interface SessionConfig {
  /** One or more formats — a session can drill several in one run. */
  formats: SessionFormat[];
  difficulty: Difficulty;
  lengthMinutes: SessionLength;
  /**
   * A voice session the balance only partly pays for: the minutes it covers.
   * The service caps the recording there itself; this picks the question set
   * that fits and lets the screen say so.
   */
  capMinutes?: number;
}

// ---------------------------------------------------------------------------
// Voice pricing, ported from the AI service so this screen quotes exactly what
// the service will decide. Keep in step with remoteworldwideai
// src/lib/voiceCredits.ts (creditsFor) and src/lib/sessionCap.ts
// (affordableMinutesFor, questionPresetFor). The numbers in the rule come from
// the voice config; the defaults below are only for before it arrives.
// ---------------------------------------------------------------------------

export interface VoiceCreditRule {
  base: number;
  includedMinutes: number;
  perExtraMinute: number;
}

export const DEFAULT_VOICE_CREDIT_RULE: VoiceCreditRule = { base: 5, includedMinutes: 10, perExtraMinute: 1 };
/** `VOICE_INTERVIEW_MAX_MINUTES`' default. */
const DEFAULT_VOICE_MAX_MINUTES = 40;
const MINUTE_MS = 60_000;

/** `base + ceil(max(0, ms - included·60 000) / 60 000) · perExtra`: 10:00 costs 5, 10:00.001 costs 6. */
export function creditsFor(durationMs: number, rule: VoiceCreditRule = DEFAULT_VOICE_CREDIT_RULE): number {
  const ms = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0;
  const extraMs = Math.max(0, ms - rule.includedMinutes * MINUTE_MS);
  return rule.base + Math.ceil(extraMs / MINUTE_MS) * rule.perExtraMinute;
}

/** The longest whole-minute session a balance pays for; Infinity when the balance is unknown. */
export function affordableMinutesFor(balance: number | null, rule: VoiceCreditRule = DEFAULT_VOICE_CREDIT_RULE): number {
  if (balance === null) return Infinity;
  if (!(balance >= rule.base)) return 0;
  if (rule.perExtraMinute <= 0) return Infinity;
  return rule.includedMinutes + Math.floor((balance - rule.base) / rule.perExtraMinute);
}

/** The largest preset length that fits in `capMinutes`, never below the shortest. */
export function questionPresetFor(capMinutes: number): SessionLength {
  let chosen: SessionLength = SESSION_LENGTHS[0];
  for (const preset of SESSION_LENGTHS) if (preset <= capMinutes) chosen = preset;
  return chosen;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export interface PrepSetupProps {
  track: PrepTrack;
  initialFormats?: SessionFormat[];
  onBack: () => void;
  /** The track's Questions tab, where likely questions are written. The track's Overview when not given. */
  onOpenQuestions?: () => void;
  onStart: (config: SessionConfig) => void;
}

const PrepSetup: FC<PrepSetupProps> = ({ track, initialFormats, onBack, onOpenQuestions, onStart }) => {
  const [formats, setFormats] = useState<SessionFormat[]>(initialFormats?.length ? initialFormats : ["behavioural"]);

  // Never let the last one be unticked — a session with no format has no
  // questions to ask, so the control refuses rather than erroring later.
  function toggleFormat(f: SessionFormat) {
    setFormats((prev) => (prev.includes(f) ? (prev.length === 1 ? prev : prev.filter((x) => x !== f)) : [...prev, f]));
  }
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [lengthMinutes, setLengthMinutes] = useState<SessionLength>(15);

  // Read once per mount: the cap is a weekly pace, so a stale "now" is harmless.
  const [now] = useState(() => Date.now());
  const recentSessions = track.sessions.filter((session) => {
    const at = Date.parse(session.completedAt);
    return Number.isNaN(at) || now - at < SESSION_CAP_WINDOW_MS;
  }).length;
  const blocked = recentSessions >= MAX_SESSIONS_PER_TRACK;
  const difficultyNote = DIFFICULTIES.find((d) => d.id === difficulty)?.note ?? "";

  // Every session is a voice interview, priced from the service's own rule.
  // The balance is the billing overview the sidebar meter reads, so the two
  // never disagree.
  const voiceConfig = usePrepVoiceConfig();
  const { subscription } = useBilling();

  const voiceSettings = voiceConfig.data;
  const voiceOffered = voiceSettings?.interviewsEnabled === true;
  const rule = voiceSettings?.credits ?? DEFAULT_VOICE_CREDIT_RULE;
  const maxMinutes = voiceSettings?.maxMinutes ?? DEFAULT_VOICE_MAX_MINUTES;
  const balance = typeof subscription?.creditBalance === "number" && Number.isFinite(subscription.creditBalance) ? subscription.creditBalance : null;
  const voiceCost = creditsFor(lengthMinutes * MINUTE_MS, rule);
  // A known balance under the base price: no voice session at all (the service would answer 402).
  const lowBalance = voiceOffered && balance !== null && balance < rule.base;
  // A known balance that covers the base but not the chosen length: offer the longest session it covers.
  const offerMinutes = voiceOffered && !lowBalance && balance !== null && voiceCost > balance ? Math.max(0, Math.min(affordableMinutesFor(balance, rule), maxMinutes)) : null;
  const voiceMinutes = offerMinutes ?? lengthMinutes;
  const voiceQuestionLength = offerMinutes !== null ? questionPresetFor(offerMinutes) : lengthMinutes;
  // The live screen sends the consent version from this config, and the cap above needs its rule.
  const configLoading = voiceConfig.isPending;

  // Which questions this session will ask: the track's likely questions, or
  // the general bank when it has none in these formats. The same pick the live
  // screen makes, from the same cached read, so the count said here is the
  // count asked. Only read: a set costs a credit and is written on the track.
  const saved = track.saved;
  const hasPosting = Boolean(saved && (saved.savedJobId || saved.hasJobDescription));
  const likely = useLikelyQuestions(saved ? track.id : null);
  const likelySet = likely.data?.set ?? null;
  const plan = pickSessionQuestions({
    formats,
    lengthMinutes: voiceQuestionLength,
    seed: `${track.id}-${formats.join(",")}-${voiceQuestionLength}`,
    likely: likelySet?.questions,
  });
  const questionTotal = plan.length;
  const tailoredCount = plan.filter((q) => q.tailored).length;
  const generalCount = questionTotal - tailoredCount;
  // Formats the set has questions in that this session leaves out: ticking one asks more of the job's own.
  const usable = usableLikelyQuestions(likelySet?.questions);
  const moreIn = (Object.keys(FORMAT_META) as SessionFormat[])
    .filter((f) => !formats.includes(f) && usable.some((q) => q.format === f))
    .map((f) => FORMAT_META[f].label)
    .join(" or ");

  // Said plainly, because it decides what the interview is about. Writing a
  // set is the track's (a credit, from a click), so this only points there.
  const generalLead = <b className="font-bold text-primary">These will be general practice questions</b>;
  // Straight to the Questions tab: that is where a set is written, and the Overview only previews it.
  const toTrack = (
    <button type="button" onClick={onOpenQuestions ?? onBack} className="font-bold text-primary underline underline-offset-2 cursor-pointer">
      Go to the track
    </button>
  );
  let questionsNote: ReactNode = null;
  if (!saved) {
    // No saved track, so no set to write for it: the bank, as it always was.
  } else if (likely.isPending) {
    questionsNote = "Checking for questions written for this job…";
  } else if (likely.isError && !likely.data) {
    // A failed refetch keeps the set it had, and the live screen asks that; only a first read failing leaves nothing.
    questionsNote = "This job's likely questions couldn't be loaded just now, so this session may ask general practice questions instead.";
  } else if (!likelySet) {
    questionsNote = hasPosting ? (
      <>
        {generalLead}, not ones written for this job. Write likely questions on the track ({plural(likely.data?.cost ?? 1, "credit")}) and the
        interview asks those instead: questions from this posting&apos;s requirements and your resume. {toTrack}
      </>
    ) : (
      <>
        {generalLead}, not ones written for this job. Add the job posting to the track and write likely questions from it, and the interview
        asks those instead. {toTrack}
      </>
    );
  } else if (tailoredCount === 0) {
    questionsNote = (
      <>
        {generalLead}: none of this job&apos;s likely questions are {formatsLabel(formats)} ones.{moreIn ? ` Add ${moreIn} to be asked them.` : ""}
      </>
    );
  } else {
    questionsNote = (
      <>
        {generalCount > 0 ? (
          <>
            <b className="font-bold text-primary">
              {tailoredCount} of {questionTotal} questions are written for this job
            </b>
            , from its posting. The other {generalCount}{" "}
            {generalCount === 1 ? "is a general practice question" : "are general practice questions"}, asked last
            {moreIn ? ` — add ${moreIn} to be asked more of this job's own` : ""}.
          </>
        ) : (
          <>
            <b className="font-bold text-primary">All {questionTotal} questions are written for this job</b>, from its posting&apos;s requirements
            {likelySet.grounding.resume ? " and your resume" : ""}.
          </>
        )}
        {/* Still this job's questions: used as they are, with the change said. */}
        {likely.data?.stale && " They were written before the posting or your resume last changed; you can write a fresh set on the track."}
      </>
    );
  }

  // The resume this job was sent. A saved track needs one in effect before a
  // session starts, since it is what the job's questions are written from; a
  // stand-in track with nothing saved behind it has no job to have sent one
  // to, so it starts as it always did.
  const resume = useTrackResume(saved);
  const [pickerOpen, setPickerOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const resumeGate = saved ? resume.gate : "ready";
  const resumeBlocked = resumeGate === "pick" || resumeGate === "upload" || resumeGate === "checking";
  const resumeBusy = resume.busy !== null;
  const resumeLabel = resume.source.kind === "none" ? null : SOURCE_LABELS[resume.source.kind];

  function openPicker() {
    resume.clearError();
    setPickerOpen(true);
  }

  async function uploadResume(file: File | undefined) {
    if (uploadRef.current) uploadRef.current.value = "";
    // Someone's first resume becomes their master, and with it this track's
    // default, so setup can go on; a later one is made this track's own.
    if (file) await resume.upload(file, "default");
  }

  async function startSession() {
    if (blocked || configLoading || resumeBlocked || resumeBusy) return;
    // A master document default is parsed and stored on the track here, once,
    // so this session's questions and every later read use that parse rather
    // than parsing the file again. A failure stays on this screen, said.
    if (resumeGate === "store-master" && !(await resume.storeDefault())) return;
    onStart({
      formats,
      difficulty,
      lengthMinutes: voiceQuestionLength,
      ...(offerMinutes !== null ? { capMinutes: offerMinutes } : {}),
    });
  }

  return (
    <div className="max-w-[720px] mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-primary cursor-pointer w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          {track.company} — {track.role}
        </button>
      </div>

      <div>
        <p className="text-2xl font-bold text-primary mb-1.5">Set up the session</p>
        <p className="text-sm text-black/55">
          {track.company} · {track.role} · {track.roundLabel}
        </p>
      </div>

      {saved && (
        <DashCard className="p-6">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <p className="text-[14.5px] font-bold text-primary">Resume you submitted</p>
            {(resumeGate === "ready" || resumeGate === "store-master") && (
              <button
                type="button"
                onClick={openPicker}
                disabled={resumeBusy}
                className="text-xs font-bold text-black/50 hover:text-primary cursor-pointer disabled:opacity-50">
                Change
              </button>
            )}
          </div>
          {resumeGate === "ready" || resumeGate === "store-master" ? (
            <div className="flex items-start gap-2.5">
              <FileText className="h-4 w-4 flex-none text-black/40 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-bold text-primary">
                  <span className="truncate">{resume.name ?? (resume.naming ? "Reading…" : "A resume on file")}</span>
                  {resume.isMaster && resume.source.kind !== "master" && <Chip tone="green">Master</Chip>}
                </p>
                <p className="text-xs text-black/45 mt-0.5">{resumeLabel}</p>
              </div>
            </div>
          ) : resumeGate === "checking" ? (
            <p className="text-sm text-black/50" role="status">
              Checking your resumes…
            </p>
          ) : resumeGate === "upload" ? (
            // No resume anywhere: the upload is here, not a trip to My documents and back.
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-black/60 leading-relaxed">
                <b className="font-bold text-primary">Add your resume to start.</b> Upload the one you sent {track.company}: this job&apos;s questions are
                written from it. It&apos;s saved to My documents as your master resume.
              </p>
              <input ref={uploadRef} type="file" accept={RESUME_ACCEPT} className="hidden" onChange={(e) => void uploadResume(e.target.files?.[0])} />
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                disabled={resumeBusy}
                className={cn(BUTTON_SOLID, "disabled:opacity-50 disabled:pointer-events-none")}>
                {resume.busy === "upload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {resume.busy === "upload" ? "Uploading…" : "Upload your resume"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-black/60 leading-relaxed">
                <b className="font-bold text-primary">Pick your resume to start.</b>{" "}
                {resume.missing
                  ? `The one picked for this job is no longer on file. Choose the one you sent ${track.company}.`
                  : `Choose the one you sent ${track.company}: this job's questions are written from it.`}
              </p>
              <button type="button" onClick={openPicker} className={BUTTON_SOLID}>
                Pick a resume
              </button>
            </div>
          )}
          {resume.error && !pickerOpen && (
            <p role="alert" className="mt-3 text-xs font-semibold text-red-700">
              {resume.error}
            </p>
          )}
          <ResumePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} company={track.company} resume={resume} />
        </DashCard>
      )}

      <DashCard className="p-6">
        <p className="text-[14.5px] font-bold text-primary mb-3.5">Format</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(Object.keys(FORMAT_META) as SessionFormat[]).map((f) => {
            const Icon = FORMAT_ICON[f];
            const selected = formats.includes(f);
            const isLast = selected && formats.length === 1;
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFormat(f)}
                aria-pressed={selected}
                title={isLast ? "A session needs at least one format" : undefined}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3.5 text-left transition-colors cursor-pointer",
                  selected ? "border-primary bg-[#fbfbf7]" : "border-black/10 hover:border-black/25",
                  isLast && "cursor-default"
                )}>
                <span className="mt-0.5 group">
                  <NeoCheckbox checked={selected} size="sm" interactive={!isLast} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-black/45 flex-none" />
                    <span className="text-sm font-bold text-primary">{FORMAT_META[f].label}</span>
                  </span>
                  <span className="block text-xs text-black/45 mt-1">{FORMAT_META[f].sub}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-black/45 mt-3">
          Pick as many as you want — questions alternate between them.
        </p>
      </DashCard>

      <DashCard className="p-6">
        <p className="text-[14.5px] font-bold text-primary mb-3.5">Difficulty</p>
        <div className="flex gap-2 flex-wrap">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDifficulty(d.id)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer transition-colors border-[1.5px]",
                difficulty === d.id ? "bg-[#222325] text-white border-[#222325]" : "border-black/14 text-black/60 hover:border-black/30"
              )}>
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-black/50 leading-relaxed mt-3">{difficultyNote}</p>
      </DashCard>

      <DashCard className="p-6">
        <div className="flex items-baseline justify-between mb-3.5">
          <p className="text-[14.5px] font-bold text-primary">Length</p>
          <span className="text-xs text-black/50">{QUESTIONS_FOR_LENGTH[lengthMinutes]} questions</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {SESSION_LENGTHS.map((len) => (
            <button
              key={len}
              type="button"
              onClick={() => setLengthMinutes(len)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer transition-colors border-[1.5px]",
                lengthMinutes === len ? "bg-[#222325] text-white border-[#222325]" : "border-black/14 text-black/60 hover:border-black/30"
              )}>
              {len} min
            </button>
          ))}
        </div>
      </DashCard>

      {/* Where the questions come from: the live interview used to ask a
          general bank written for design and engineering roles whatever the
          job, while the track's own likely questions went unused. */}
      {questionsNote && (
        <DashCard className="p-5 flex gap-3 items-start bg-[#fbfbf7]">
          <Sparkles className="h-4 w-4 text-black/40 flex-none mt-0.5" />
          <p className="text-xs text-black/60 leading-relaxed" aria-live="polite">
            {questionsNote}
          </p>
        </DashCard>
      )}

      {/* Who hears the candidate's voice, for the session that will actually
          run. It said "records… ElevenLabs… kept" whatever the mode, while
          with recorded interviews off (the AI service's
          VOICE_INTERVIEWS_ENABLED) nothing is recorded or kept, and the one
          service that does hear the audio — the browser's own speech
          recognition, Google's in Chrome — went unnamed. */}
      <DashCard className="p-5 flex gap-3 items-start bg-[#fbfbf7]">
        <Info className="h-4 w-4 text-black/40 flex-none mt-0.5" />
        <p className="text-xs text-black/60 leading-relaxed">
          {configLoading ? (
            "Checking how this session will handle your voice…"
          ) : voiceOffered ? (
            <>
              A voice session records your answers: after the interview the recording is transcribed by ElevenLabs (Scribe) to build your
              delivery report and measured by our own service for delivery, and it is kept until you delete the session or your account.
              {voiceSettings?.liveProvider === "web-speech" &&
                " The live captions during the interview come from your browser's own speech service (in Chrome, that's Google's)."}
            </>
          ) : (
            <>
              This session isn&apos;t recorded, and nothing you say is saved. Where your browser can, its own speech recognition turns what
              you say into text as you go (in Chrome, that&apos;s Google&apos;s speech service).
            </>
          )}
        </p>
      </DashCard>

      <div className="bg-[#222325] text-white rounded-2xl p-6 flex items-center gap-5 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <p className="text-[14.5px] font-bold mb-1">
            {blocked ? "Session limit reached for this track" : `${formatsLabel(formats)} · ${difficulty} · ${voiceMinutes} min`}
          </p>
          {!blocked && resumeBlocked && (
            // Said down here too, beside the button it holds back.
            <p className="text-xs font-bold text-[#e1f073] mb-1">
              {resumeGate === "checking" ? "Checking your resumes…" : resumeGate === "upload" ? "Add your resume above to start." : "Pick your resume above to start."}
            </p>
          )}
          <p className="text-xs text-white/60 leading-relaxed">
            {blocked
              ? `You've run ${MAX_SESSIONS_PER_TRACK} sessions for ${track.company} this week. Try a different track, or come back after acting on your open actions.`
              : !configLoading && !voiceOffered
                ? // Recorded interviews are off (the AI service's VOICE_INTERVIEWS_ENABLED),
                  // so the live screen runs unsaved: no report, so no scorecard to promise.
                  `${questionTotal} questions, answered out loud. Practice only for now — this run won't be saved or scored.`
                : `${questionTotal} questions, spoken answers, a scorecard and delivery coaching at the end.${
                  !voiceOffered
                    ? ""
                    : offerMinutes !== null
                      ? // The recording stops at what the balance covers, so there are no extra minutes to price.
                        ` At most ${plural(creditsFor(offerMinutes * MINUTE_MS, rule), "credit")}: recording stops at ${offerMinutes}:00.`
                      : ` ${plural(voiceCost, "credit")} for ${lengthMinutes} minutes, +${rule.perExtraMinute} per extra minute.`
                }`}
          </p>
        </div>
        {blocked ? (
          <span className="text-sm font-bold bg-white/10 text-white/40 rounded-lg px-5 py-3 flex-none whitespace-nowrap">Start session</span>
        ) : (
          <button
            type="button"
            onClick={() => void startSession()}
            disabled={configLoading || resumeBlocked || resumeBusy}
            aria-busy={configLoading || resumeBusy}
            className="inline-flex items-center gap-2 text-sm font-bold bg-secondary text-primary rounded-lg px-5 py-3 flex-none whitespace-nowrap cursor-pointer transition-shadow hover:shadow-[3px_3px_0_0_rgba(255,255,255,.25)] disabled:opacity-40 disabled:pointer-events-none">
            {(configLoading || resumeBusy) && <Loader2 className="h-4 w-4 animate-spin" />}
            {resumeBusy && resumeGate === "store-master"
              ? "Reading your resume…"
              : offerMinutes !== null
                ? `Start ${offerMinutes}-minute session`
                : "Start session"}
          </button>
        )}
      </div>
    </div>
  );
};

export default PrepSetup;
