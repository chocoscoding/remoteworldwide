"use client";

import { FC, useState } from "react";
import Link from "next/link";
import { ArrowLeft, DollarSign, Info, Keyboard, MessageCircle, Mic, Presentation } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import { FORMAT_META, QUESTIONS_FOR_LENGTH, SESSION_LENGTHS, formatsLabel, type Difficulty, type PrepTrack, type SessionFormat, type SessionLength } from "@/app/lib/dashboard/prep-data";
import { useBilling } from "@/app/(pages)/(dashboard)/dashboard/settings/BillingProvider";
import { usePrepVoiceConfig } from "@/hooks/queries/usePrepVoiceConfig";
import { PREP_BILLING_HREF } from "@/app/lib/voice/api";
import type { PrepSessionMode } from "@/app/lib/voice/types";
import PreviewToggle from "./PreviewToggle";
import RecordingConsent, { handConsentToLive } from "./RecordingConsent";

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
  /** How the answers are given. Absent means typed, as every session was before voice interviews. */
  mode?: PrepSessionMode;
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
  onStart: (config: SessionConfig) => void;
}

const PrepSetup: FC<PrepSetupProps> = ({ track, initialFormats, onBack, onStart }) => {
  const [formats, setFormats] = useState<SessionFormat[]>(initialFormats?.length ? initialFormats : ["behavioural"]);

  // Never let the last one be unticked — a session with no format has no
  // questions to ask, so the control refuses rather than erroring later.
  function toggleFormat(f: SessionFormat) {
    setFormats((prev) => (prev.includes(f) ? (prev.length === 1 ? prev : prev.filter((x) => x !== f)) : [...prev, f]));
  }
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [lengthMinutes, setLengthMinutes] = useState<SessionLength>(15);
  const [preview, setPreview] = useState<"default" | "blocked">("default");

  // Read once per mount: the cap is a weekly pace, so a stale "now" is harmless.
  const [now] = useState(() => Date.now());
  const recentSessions = track.sessions.filter((session) => {
    const at = Date.parse(session.completedAt);
    return Number.isNaN(at) || now - at < SESSION_CAP_WINDOW_MS;
  }).length;
  const blocked = preview === "blocked" || recentSessions >= MAX_SESSIONS_PER_TRACK;
  const difficultyNote = DIFFICULTIES.find((d) => d.id === difficulty)?.note ?? "";

  // How the answers are given. Voice is offered only when the service has it
  // switched on, and priced from its own rule. The balance is the billing
  // overview the sidebar meter reads, so the two never disagree.
  const voiceConfig = usePrepVoiceConfig();
  const { subscription } = useBilling();
  const [modeChoice, setModeChoice] = useState<PrepSessionMode | null>(null);
  // Unticked every time: consent is given per session.
  const [consent, setConsent] = useState(false);

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
  const voiceAvailable = voiceOffered && !lowBalance;
  const mode: PrepSessionMode = voiceAvailable && modeChoice !== "text" ? "voice" : "text";
  const voiceMinutes = offerMinutes ?? lengthMinutes;
  const voiceQuestionLength = offerMinutes !== null ? questionPresetFor(offerMinutes) : lengthMinutes;
  const canStartVoice = voiceAvailable && consent && voiceSettings !== undefined && !blocked;
  const textSession = voiceSettings?.textSession;

  function startSession(which: PrepSessionMode) {
    if (blocked) return;
    if (which === "voice") {
      if (!canStartVoice || !voiceSettings) return;
      handConsentToLive(track.id, voiceSettings.consentVersion);
      onStart({
        formats,
        difficulty,
        lengthMinutes: voiceQuestionLength,
        mode: "voice",
        ...(offerMinutes !== null ? { capMinutes: offerMinutes } : {}),
      });
      return;
    }
    onStart({ formats, difficulty, lengthMinutes, mode: "text" });
  }

  return (
    <div className="max-w-[720px] mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-primary cursor-pointer w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          {track.company} — {track.role}
        </button>
        <PreviewToggle
          value={preview}
          onChange={setPreview}
          options={[
            { id: "default", label: "Default" },
            { id: "blocked", label: "Blocked" },
          ]}
        />
      </div>

      <div>
        <p className="text-2xl font-bold text-primary mb-1.5">Set up the session</p>
        <p className="text-sm text-black/55">
          {track.company} · {track.role} · {track.roundLabel}
        </p>
      </div>

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

      <DashCard className="p-6">
        <div className="flex items-baseline justify-between gap-3 mb-3.5 flex-wrap">
          <p className="text-[14.5px] font-bold text-primary">How you&apos;ll answer</p>
          {voiceOffered && balance !== null && <span className="text-xs text-black/50 tabular-nums">Balance: {plural(balance, "credit")}</span>}
        </div>
        <div role="radiogroup" aria-label="How you'll answer" className={cn("grid grid-cols-1 gap-2.5", voiceOffered && "sm:grid-cols-2")}>
          {voiceOffered && (
            <div className={cn("rounded-xl border p-4 flex flex-col gap-3 transition-colors", mode === "voice" ? "border-primary bg-[#fbfbf7]" : "border-black/10")}>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "voice"}
                disabled={lowBalance}
                onClick={() => setModeChoice("voice")}
                className="flex items-start gap-2.5 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                <span className="mt-0.5 h-4 w-4 flex-none rounded-full border-2 border-[#222325] flex items-center justify-center">
                  {mode === "voice" && <span className="h-2 w-2 rounded-full bg-[#222325]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5 text-black/45 flex-none" />
                    <span className="text-sm font-bold text-primary">Voice session</span>
                  </span>
                  <span className="block text-xs text-black/45 mt-1 leading-relaxed">
                    Answer out loud, like the real thing. Along with the scorecard you get coaching on your pace, pauses, filler words, pitch
                    variation and energy, and every moment can be replayed.
                  </span>
                </span>
              </button>

              <div className={cn("text-xs leading-relaxed", lowBalance ? "text-black/35" : "text-black/60")}>
                <p>
                  <b className="font-bold text-primary tabular-nums">{plural(voiceCost, "credit")}</b> for {lengthMinutes} minutes.
                </p>
                <p className="text-black/45 mt-0.5">
                  {plural(rule.base, "credit")} cover up to {rule.includedMinutes} minutes, then +{rule.perExtraMinute} for each extra minute started,
                  counted over the whole recording and charged once your report is ready.
                </p>
              </div>

              {lowBalance && balance !== null && (
                <div className="rounded-lg border border-[#b23c26]/25 bg-[#b23c26]/5 p-3 text-xs leading-relaxed text-black/70">
                  You have {plural(balance, "credit")} — a voice session needs at least {rule.base}.{" "}
                  <Link href={PREP_BILLING_HREF} className="font-bold text-primary underline underline-offset-2">
                    Top up
                  </Link>{" "}
                  or run a typed session instead.
                </div>
              )}

              {offerMinutes !== null && balance !== null && (
                <div className="rounded-lg border border-black/10 bg-white p-3">
                  <p className="text-xs font-bold text-primary">
                    You have {plural(balance, "credit")} — enough for a {offerMinutes}-minute session.
                  </p>
                  <p className="text-xs text-black/50 mt-1 leading-relaxed">
                    {QUESTIONS_FOR_LENGTH[voiceQuestionLength]} questions. Recording stops at {offerMinutes}:00, with a warning a minute before.
                  </p>
                  <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => startSession("voice")}
                      disabled={!canStartVoice}
                      title={canStartVoice ? undefined : "Tick the recording consent first"}
                      className="rounded-lg border-[1.5px] border-[#222325] bg-secondary px-3 py-1.5 text-xs font-bold text-primary cursor-pointer shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none">
                      Start a {offerMinutes}-minute session
                    </button>
                    <Link href={PREP_BILLING_HREF} className="text-xs font-bold text-primary underline underline-offset-2">
                      Top up
                    </Link>
                  </div>
                </div>
              )}

              {!lowBalance && (
                <RecordingConsent
                  checked={consent}
                  onChange={(next) => {
                    setConsent(next);
                    if (next) setModeChoice("voice");
                  }}
                />
              )}
            </div>
          )}

          <div className={cn("rounded-xl border p-4 flex flex-col gap-3 transition-colors", mode === "text" ? "border-primary bg-[#fbfbf7]" : "border-black/10", lowBalance && "ring-2 ring-secondary")}>
            <button type="button" role="radio" aria-checked={mode === "text"} onClick={() => setModeChoice("text")} className="flex items-start gap-2.5 text-left cursor-pointer">
              <span className="mt-0.5 h-4 w-4 flex-none rounded-full border-2 border-[#222325] flex items-center justify-center">
                {mode === "text" && <span className="h-2 w-2 rounded-full bg-[#222325]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <Keyboard className="h-3.5 w-3.5 text-black/45 flex-none" />
                  <span className="text-sm font-bold text-primary">Typed session</span>
                  {lowBalance && <span className="text-[10px] font-bold uppercase tracking-[0.06em] bg-secondary text-primary rounded px-1.5 py-0.5">Available now</span>}
                </span>
                <span className="block text-xs text-black/45 mt-1 leading-relaxed">
                  Type your answers, or dictate them through your browser&apos;s speech service. We record no audio; your answers are saved as text
                  with the scorecard.
                </span>
              </span>
            </button>
            {textSession && (
              <p className="text-xs text-black/60">
                <b className="font-bold text-primary">{textSession.credits === 0 ? "Free" : plural(textSession.credits, "credit")}</b>
                {` · up to ${textSession.perDay} a day`}
              </p>
            )}
          </div>
        </div>
      </DashCard>

      <DashCard className="p-5 flex gap-3 items-start bg-[#fbfbf7]">
        <Info className="h-4 w-4 text-black/40 flex-none mt-0.5" />
        <p className="text-xs text-black/60 leading-relaxed">
          {voiceOffered && (
            <>
              A voice session records your answers: the audio is sent to AWS to be transcribed and to our own service to measure your delivery,
              and the recording is kept until you delete the session or your account.{" "}
            </>
          )}
          In a typed session we record no audio. Pressing <b className="font-bold text-primary">Talk</b> sends your speech to your
          browser&apos;s own speech service to turn it into text (in Chrome, that&apos;s Google&apos;s), and your answers are saved as text.
        </p>
      </DashCard>

      <div className="bg-[#222325] text-white rounded-2xl p-6 flex items-center gap-5 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <p className="text-[14.5px] font-bold mb-1">
            {blocked
              ? "Session limit reached for this track"
              : `${formatsLabel(formats)} · ${difficulty} · ${mode === "voice" ? `${voiceMinutes} min · voice` : `${lengthMinutes} min`}`}
          </p>
          <p className="text-xs text-white/60 leading-relaxed">
            {blocked
              ? `You've run ${MAX_SESSIONS_PER_TRACK} sessions for ${track.company} this week. Try a different track, or come back after acting on your open actions.`
              : mode === "voice"
                ? `${QUESTIONS_FOR_LENGTH[voiceQuestionLength]} questions, spoken answers, a scorecard and delivery coaching at the end. ${
                    offerMinutes !== null
                      ? // The recording stops at what the balance covers, so there are no extra minutes to price.
                        `At most ${plural(creditsFor(offerMinutes * MINUTE_MS, rule), "credit")}: recording stops at ${offerMinutes}:00.`
                      : `${plural(voiceCost, "credit")} for ${lengthMinutes} minutes, +${rule.perExtraMinute} per extra minute.`
                  }`
                : `${QUESTIONS_FOR_LENGTH[lengthMinutes]} questions, typed answers, a scorecard at the end.`}
          </p>
          {!blocked && mode === "voice" && !consent && <p className="text-xs font-bold text-secondary mt-1.5">Tick the recording consent above to start.</p>}
        </div>
        {blocked ? (
          <span className="text-sm font-bold bg-white/10 text-white/40 rounded-lg px-5 py-3 flex-none whitespace-nowrap">Start session</span>
        ) : (
          <button
            type="button"
            onClick={() => startSession(mode)}
            disabled={mode === "voice" && !canStartVoice}
            className="text-sm font-bold bg-secondary text-primary rounded-lg px-5 py-3 flex-none whitespace-nowrap cursor-pointer transition-shadow hover:shadow-[3px_3px_0_0_rgba(255,255,255,.25)] disabled:opacity-40 disabled:pointer-events-none">
            {mode === "voice" ? (offerMinutes !== null ? `Start ${offerMinutes}-minute session` : "Start voice session") : "Start session"}
          </button>
        )}
      </div>
    </div>
  );
};

export default PrepSetup;
