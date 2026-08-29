"use client";

import { FC, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickQuestionsForSession, type SessionInput } from "@/app/lib/dashboard/prep-engine";
import { formatsLabel, type PrepTrack, type QuestionBankEntry, type TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import type { SessionConfig } from "./PrepSetup";
import { useVoiceSession } from "@/app/components/dashboard/voice/useVoiceSession";
import VoiceOrb from "@/app/components/dashboard/voice/VoiceOrb";
import MicWaveform from "@/app/components/dashboard/voice/MicWaveform";

export interface PrepLiveProps {
  track: PrepTrack;
  config: SessionConfig;
  onEnd: (input: SessionInput) => void;
}

type Phase = "connecting" | "active" | "thinking" | "done";

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatClock(totalSeconds: number): string {
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
}

function aiTurn(id: string, q: QuestionBankEntry): TranscriptTurn {
  return { id, who: "ai", text: q.text, questionId: q.id };
}

const PrepLive: FC<PrepLiveProps> = ({ track, config, onEnd }) => {
  const [questions] = useState(() => pickQuestionsForSession(config.formats, config.lengthMinutes, `${track.id}-${config.formats.join(",")}-${config.lengthMinutes}`));
  const [phase, setPhase] = useState<Phase>("connecting");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [draft, setDraft] = useState("");

  const idSeq = useRef(0);
  const nextTurnId = () => `turn-${idSeq.current++}`;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Dictated speech lands in the same draft box as typing, so the two inputs
  // converge before submit and the rest of the flow stays identical.
  const handleTranscript = useCallback((text: string) => {
    setDraft((prev) => (prev ? `${prev.trimEnd()} ${text.trim()}` : text.trim()));
  }, []);

  const voice = useVoiceSession({ onTranscript: handleTranscript, voiceEnabled: voiceOn });
  const { speak, cancelSpeech, stopDictation, startDictation, micStatus, aiSpeaking, dictationSupported, interim, onLevel } = voice;

  const listening = micStatus === "listening";
  const currentQuestion = questions[questionIndex];
  const totalSeconds = config.lengthMinutes * 60;

  // Connecting -> first question.
  useEffect(() => {
    if (phase !== "connecting") return;
    const t = setTimeout(() => {
      setTranscript((prev) => [...prev, aiTurn(nextTurnId(), questions[0])]);
      setPhase("active");
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Thinking -> next question.
  useEffect(() => {
    if (phase !== "thinking") return;
    const t = setTimeout(() => {
      const next = questionIndex + 1;
      setTranscript((prev) => [...prev, aiTurn(nextTurnId(), questions[next])]);
      setQuestionIndex(next);
      setPhase("active");
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionIndex]);

  // Read each new question aloud as it arrives.
  useEffect(() => {
    if (phase !== "active" || !currentQuestion) return;
    speak(currentQuestion.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questionIndex]);

  // Elapsed timer — advanced by the interval callback, never Date.now() in render.
  useEffect(() => {
    if (phase === "connecting" || phase === "done") return;
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript, interim]);

  function buildInput(finalTranscript: TranscriptTurn[]): SessionInput {
    return { trackId: track.id, formats: config.formats, difficulty: config.difficulty, lengthMinutes: config.lengthMinutes, transcript: finalTranscript, elapsedSeconds };
  }

  function finish(finalTranscript: TranscriptTurn[]) {
    stopDictation();
    cancelSpeech();
    setPhase("done");
    onEnd(buildInput(finalTranscript));
  }

  function submitAnswer() {
    if (phase !== "active") return;
    const text = draft.trim();
    const withAnswer = text ? [...transcript, { id: nextTurnId(), who: "user" as const, text, questionId: questions[questionIndex].id }] : transcript;
    setTranscript(withAnswer);
    setDraft("");
    // The mic deliberately stays open between questions — hanging up after
    // every answer is what made this feel like texting rather than a call.
    if (questionIndex >= questions.length - 1) finish(withAnswer);
    else setPhase("thinking");
  }

  // Auto-send on a natural pause. Held in refs and driven off the mic level
  // subscription rather than state, because this runs every animation frame
  // and re-rendering the call screen at 60fps to watch for silence would be
  // absurd.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const submitRef = useRef<() => void>(() => {});
  useEffect(() => {
    submitRef.current = submitAnswer;
  });

  const spokeRef = useRef(false);
  const quietFramesRef = useRef(0);
  const [pausing, setPausing] = useState(false);

  useEffect(() => {
    spokeRef.current = false;
    quietFramesRef.current = 0;
    if (!listening || phase !== "active") return;

    let armed = false;
    const unsubscribe = onLevel((level) => {
      if (level > 0.12) {
        spokeRef.current = true;
        quietFramesRef.current = 0;
        if (armed) {
          armed = false;
          setPausing(false);
        }
        return;
      }
      if (!spokeRef.current || !draftRef.current.trim()) return;

      quietFramesRef.current += 1;
      // ~60fps: half a second of quiet shows the hint, two seconds sends.
      if (quietFramesRef.current > 30 && !armed) {
        armed = true;
        setPausing(true);
      }
      if (quietFramesRef.current > 120) {
        spokeRef.current = false;
        quietFramesRef.current = 0;
        armed = false;
        setPausing(false);
        submitRef.current();
      }
    });
    return () => {
      unsubscribe();
      if (armed) setPausing(false);
    };
  }, [listening, phase, onLevel]);

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    if (!next) cancelSpeech();
    else if (currentQuestion && phase === "active") speak(currentQuestion.text);
  }

  const micHint =
    micStatus === "denied"
      ? "Mic blocked — type your answer instead."
      : micStatus === "unsupported" || !dictationSupported
        ? "Live conversation needs Chrome or Edge. You can still type your answers here."
        : listening
          ? pausing
            ? "Sending when you stop…"
            : "Go ahead — talk over them if you want, they'll stop."
          : "Press Talk to start the conversation. Typing works too.";

  return (
    <div className="bg-[#222325] text-white min-h-screen flex flex-col">
      {/* Call bar */}
      <div className="flex items-center gap-3.5 px-6 py-3.5 border-b border-white/10 flex-wrap flex-none">
        <span className="text-xs font-bold bg-[#e1f073] text-[#222325] rounded-md px-2.5 py-1 flex-none">{formatsLabel(config.formats)}</span>
        <span className="text-xs text-white/50 flex-none tabular-nums">
          {phase === "connecting" ? "Connecting…" : `Question ${Math.min(questionIndex + 1, questions.length)} of ${questions.length}`}
        </span>
        <div className="flex-1 min-w-[100px] h-1 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full bg-[#e1f073] transition-[width] duration-300" style={{ width: `${(questionIndex / questions.length) * 100}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums flex-none">
          {formatClock(elapsedSeconds)} / {formatClock(totalSeconds)}
        </span>
        <div className="flex gap-2 flex-none">
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={voiceOn ? "Mute interviewer" : "Unmute interviewer"}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] cursor-pointer transition-colors",
              voiceOn ? "border-white/25 hover:border-white/50" : "border-white/15 text-white/40"
            )}>
            {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => finish(transcript)}
            className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] bg-white px-3 py-1.5 text-xs font-bold text-[#222325] cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#e1f073] hover:shadow-[2.5px_2.5px_0_0_#e1f073] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            <PhoneOff className="h-3.5 w-3.5" />
            End session
          </button>
        </div>
      </div>

      {phase === "connecting" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16">
          <VoiceOrb speaking={false} />
          <p className="text-[15px] font-bold">Connecting to your interviewer…</p>
          <p className="text-sm text-white/50">This is a practice session — keep this tab open.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Left — the conversation so far */}
          <div className="flex-1 min-w-0 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10">
            <p className="px-6 pt-5 pb-3 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/35 flex-none">Transcript</p>
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 pb-5 flex flex-col gap-4">
              {transcript.map((t, i) => {
                const isLive = aiSpeaking && t.who === "ai" && i === transcript.length - 1;
                return (
                <div key={t.id} className={cn("max-w-[78%]", t.who === "user" ? "self-end" : "self-start")}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-white/30 mb-1.5 flex items-center gap-1.5">
                    {t.who === "user" ? "You" : "Interviewer"}
                    {isLive && (
                      <span className="inline-flex items-center gap-1 text-[#e1f073]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#e1f073] animate-pulse" />
                        speaking
                      </span>
                    )}
                  </p>
                  <p
                    className={cn(
                      "text-sm leading-relaxed rounded-xl px-3.5 py-2.5",
                      t.who === "user" ? "bg-[#e1f073] text-[#222325] font-medium" : "bg-white/8 text-white/80"
                    )}>
                    {t.text}
                  </p>
                </div>
                );
              })}
              {interim && (
                <div className="max-w-[78%] self-end">
                  <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-white/30 mb-1.5">You · live</p>
                  <p className="text-sm leading-relaxed rounded-xl px-3.5 py-2.5 bg-[#e1f073]/25 text-white/70 italic">{interim}</p>
                </div>
              )}
              {phase === "thinking" && (
                <p className="text-xs text-white/35 italic inline-flex items-center gap-1.5 self-start">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking of a follow-up…
                </p>
              )}
            </div>
          </div>

          {/* Right — the interviewer, and the question on the table */}
          <div className="w-full lg:w-[42%] lg:max-w-[520px] flex-none flex flex-col items-center justify-center gap-7 px-8 py-10">
            <VoiceOrb speaking={aiSpeaking} label="Your interviewer" sublabel={formatsLabel(config.formats)} />

            {currentQuestion && (
              <div className="text-center">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#e1f073] mb-3">Asking</p>
                <p className="text-xl font-bold leading-snug text-balance">{currentQuestion.text}</p>
                <p className="text-xs text-white/40 mt-3">{currentQuestion.sub}</p>
              </div>
            )}

            <div className="w-full">
              <MicWaveform onLevel={onLevel} active={listening} />
              <p className={cn("text-center text-xs mt-2", pausing ? "text-white" : listening ? "text-[#e1f073]" : "text-white/35")}>
                {pausing ? "Sending when you stop…" : listening ? "Listening to you" : "Your mic is off"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Answer bar — typing and dictation side by side, neither nested in the other */}
      {(phase === "active" || phase === "thinking") && (
        <div className="border-t border-white/10 px-6 py-4 flex-none">
          <div className="flex items-end gap-3 max-w-[1100px] mx-auto">
            {/* The alternative, not the main event — so it sits left and stays quiet. */}
            <div className="flex-1 min-w-0">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={phase !== "active"}
                rows={2}
                placeholder={listening ? "Your words appear here as you speak…" : "…or type your answer"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitAnswer();
                  }
                }}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/40 disabled:opacity-40 resize-none"
              />
            </div>

            <button
              type="button"
              onClick={submitAnswer}
              disabled={phase !== "active" || !draft.trim()}
              className="flex-none inline-flex items-center gap-2 h-[52px] rounded-xl border border-white/20 px-4 text-sm font-bold text-white cursor-pointer hover:border-white/45 transition-colors disabled:opacity-25 disabled:pointer-events-none">
              <ArrowUp className="h-4 w-4" />
              Send
            </button>

            {/* The main event. */}
            <button
              type="button"
              onClick={listening ? stopDictation : startDictation}
              disabled={phase !== "active" || !dictationSupported || micStatus === "denied"}
              aria-pressed={listening}
              className={cn(
                "flex-none inline-flex items-center gap-2.5 h-[52px] rounded-xl border-[1.5px] border-[#222325] px-5 text-sm font-bold cursor-pointer transition-[transform,box-shadow,background-color] duration-100 ease-out disabled:opacity-35 disabled:pointer-events-none",
                "shadow-[2px_2px_0_0_#ffffff] hover:shadow-[2.5px_2.5px_0_0_#ffffff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
                listening ? "bg-white text-[#222325]" : "bg-[#e1f073] text-[#222325]"
              )}>
              {micStatus === "requesting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : listening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              {listening ? "Stop talking" : "Talk"}
              {listening && (
                <span className="flex items-center gap-[2px] ml-0.5" aria-hidden>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#222325] animate-pulse" />
                </span>
              )}
            </button>
          </div>
          <p className="text-xs text-white/35 mt-2.5 max-w-[1100px] mx-auto">{micHint}</p>
        </div>
      )}
    </div>
  );
};

export default PrepLive;
