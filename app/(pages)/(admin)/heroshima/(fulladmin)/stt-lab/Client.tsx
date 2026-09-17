"use client";

// The admin speech-to-text lab.
//
// Web Speech cannot run in Node, so this is where it gets compared: one clip
// recorded here is captioned live by AWS streaming (through the voice gateway,
// on the run's `lab` ticket) and by the browser's SpeechRecognition side by
// side, then transcribed by AWS batch; with a pasted reference each engine
// gets a WER. Runs are kept 30 days; the audio only when "Save to bake-off
// set" is ticked, in the format `npm run bakeoff` reads.
//
// Data is plain local state, the pattern the other full-admin pages use: the
// lab is one admin's bench, nothing else on the site shares these runs, so no
// query keys are involved (and none are added to keys.ts). Access is the
// (fulladmin) layout's ADMIN check here and `requireAdmin` in the AI service.

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, LoaderCircle, RotateCcw, Square, Trash2 } from "lucide-react";
import { apiMessage } from "@/app/lib/api/core";
import { formatClock } from "@/app/lib/voice/format";
import { getLabRun, getLabStats, listLabRuns } from "@/app/lib/voice/labApi";
import type { LabRun, LabStats } from "@/app/lib/voice/types";
import ChannelPane from "./ChannelPane";
import LabRunsTable from "./LabRunsTable";
import LabScorecard from "./LabScorecard";
import LabStatsPanel from "./LabStatsPanel";
import LevelMeter from "./LevelMeter";
import type { LabPhase } from "./labCapture";
import { formatBytes, PROVIDER_LABELS } from "./labFormat";
import { useLabCapture } from "./useLabCapture";
import { WEB_SPEECH_LANGUAGES } from "./webSpeech";

/** How often runs still transcribing in the list are looked at again (the one being recorded polls itself). */
const LIST_POLL_MS = 5_000;

const PHASE_LABEL: Record<LabPhase, string> = {
  idle: "Ready",
  starting: "Opening the microphone",
  recording: "Recording",
  stopping: "Collecting the last captions",
  uploading: "Uploading the clip",
  processing: "AWS batch is transcribing",
  done: "Scored",
  failed: "Stopped",
};

export default function SttLabClient() {
  const { snapshot, engine } = useLabCapture();
  const [reference, setReference] = useState("");
  const [keepAudio, setKeepAudio] = useState(false);
  const [speechLang, setSpeechLang] = useState<string>(WEB_SPEECH_LANGUAGES[0]);
  const [runs, setRuns] = useState<LabRun[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [stats, setStats] = useState<LabStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Read when the clip stops, which can happen on its own at the length limit.
  const finishOptions = useRef({ reference, keepAudio });
  useEffect(() => {
    finishOptions.current = { reference, keepAudio };
  }, [reference, keepAudio]);

  const showRuns = useCallback((signal?: AbortSignal) => {
    const settle = <T,>(apply: (value: T) => void) => (value: T) => {
      if (!signal?.aborted) apply(value);
    };
    return listLabRuns(signal).then(
      settle((list) => {
        setRuns(list.runs);
        setRunsError(null);
      }),
      settle((error: unknown) => setRunsError(apiMessage(error))),
    );
  }, []);

  // State is set only in the promise callbacks: react-hooks rejects a setState
  // reachable synchronously from an effect body.
  useEffect(() => {
    const controller = new AbortController();
    void showRuns(controller.signal);
    void getLabStats(controller.signal).then(
      (loaded) => {
        if (!controller.signal.aborted) setStats(loaded);
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setStatsError(apiMessage(error));
      },
    );
    return () => controller.abort();
  }, [showRuns]);

  // Runs left transcribing (say, by a reload mid-run) only move on when read.
  const activeRunId = snapshot.run?.id ?? null;
  useEffect(() => {
    const pending = (runs ?? []).filter((run) => run.status === "processing" && run.id !== activeRunId);
    if (pending.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const updated = await Promise.all(pending.map((run) => getLabRun(run.id).catch(() => run)));
      if (cancelled) return;
      setRuns((current) => current?.map((run) => updated.find((entry) => entry.id === run.id) ?? run) ?? null);
    }, LIST_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runs, activeRunId]);

  const { phase } = snapshot;
  const recording = phase === "recording";
  const busy = phase === "starting" || phase === "stopping" || phase === "uploading" || phase === "processing";
  const canStart = phase === "idle" || phase === "done" || phase === "failed";

  const start = () => {
    setSelectedId(null);
    void engine.start({ speechLang, getFinishOptions: () => finishOptions.current, onSettled: () => void showRuns() });
  };

  const shown: LabRun | null = selectedId ? (runs?.find((run) => run.id === selectedId) ?? null) : snapshot.run;
  const progress = snapshot.maxMs ? Math.min(1, snapshot.elapsedMs / snapshot.maxMs) : 0;

  return (
    <div className="min-h-screen w-full bg-primary2 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-gray-500">Admin · Speech to text</p>
          <h1 className="text-3xl font-bold tracking-tight text-primary">STT lab</h1>
          <p className="max-w-3xl text-sm text-gray-600">
            Record a clip and watch AWS streaming and the browser&apos;s Web Speech caption it side by side; AWS batch, which writes every report transcript, runs
            when you stop. Paste what you will say first to get a word error rate for each engine. Clips use the lab&apos;s daily minutes, and a clip with live
            AWS captions uses them twice (stream and batch).
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* The recording deck */}
          <section aria-label="Recording deck" className="flex flex-col gap-4 rounded-2xl bg-primary p-4 text-primary2 shadow-[0_24px_48px_-24px_rgba(34,35,37,0.6)] md:p-5">
            <div className="flex flex-wrap items-center gap-4">
              {canStart ? (
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-primary transition hover:bg-secondary2 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                >
                  <Circle className="h-3.5 w-3.5 fill-red-500 text-red-500" aria-hidden />
                  {phase === "idle" ? "Start recording" : "Record another clip"}
                </button>
              ) : recording ? (
                <>
                  <button
                    type="button"
                    onClick={() => void engine.stop()}
                    className="inline-flex items-center gap-2 rounded-full bg-primary2 px-5 py-2.5 text-sm font-bold text-primary transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                  >
                    <Square className="h-3.5 w-3.5 fill-primary" aria-hidden />
                    Stop and score
                  </button>
                  <button
                    type="button"
                    onClick={() => engine.cancel()}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-primary2/60 transition hover:text-primary2 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Discard
                  </button>
                </>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-primary2/20 px-5 py-2.5 text-sm font-semibold text-primary2/80">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  {PHASE_LABEL[phase]}
                  {phase === "uploading" && snapshot.clipBytes !== null ? ` (${formatBytes(snapshot.clipBytes)})` : ""}
                </span>
              )}

              <div className="ml-auto flex items-baseline gap-2 font-mono tabular-nums" aria-live="off">
                <span className={`text-3xl font-semibold ${recording ? "text-secondary" : "text-primary2"}`}>{formatClock(snapshot.elapsedMs)}</span>
                <span className="text-sm text-primary2/50">/ {snapshot.maxMs ? formatClock(snapshot.maxMs) : "10:00"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-px w-full bg-primary2/10">
                <div className="h-px bg-secondary transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-wider text-primary2/50">Mic</span>
                <LevelMeter subscribe={engine.onLevel} />
              </div>
              <p className="font-mono text-[11px] text-primary2/50" role="status">
                {PHASE_LABEL[phase]}
                {snapshot.minutesLeft !== null ? ` · ${snapshot.minutesLeft} lab minutes left today` : ""}
              </p>
            </div>

            {/* A failed run's own error shows on its scorecard below. */}
            {snapshot.error && phase === "failed" && !snapshot.run && (
              <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {snapshot.error}
              </p>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <ChannelPane channel={1} name={PROVIDER_LABELS["aws-transcribe"].name} detail={PROVIDER_LABELS["aws-transcribe"].detail} state={snapshot.stream} recording={recording} />
              <ChannelPane channel={2} name={PROVIDER_LABELS["web-speech"].name} detail={`${PROVIDER_LABELS["web-speech"].detail} · ${speechLang}`} state={snapshot.webSpeech} recording={recording} />
            </div>
          </section>

          {/* What goes with the clip */}
          <aside className="flex flex-col gap-4 rounded-2xl border border-primary/10 bg-white p-4 md:p-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="stt-lab-reference" className="text-sm font-semibold text-primary">
                Reference transcript
              </label>
              <textarea
                id="stt-lab-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                maxLength={20_000}
                rows={9}
                placeholder="What you will say, word for word — include every um and uh."
                className="w-full resize-y rounded-lg border border-primary/15 bg-primary2/50 px-3 py-2 text-sm text-primary placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-xs text-gray-500">Sent when the clip stops. Without one there is no WER, only latency and cost.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="stt-lab-lang" className="text-sm font-semibold text-primary">
                Web Speech language
              </label>
              <select
                id="stt-lab-lang"
                value={speechLang}
                disabled={!canStart}
                onChange={(event) => setSpeechLang(event.target.value)}
                className="rounded-lg border border-primary/15 bg-white px-3 py-2 text-sm text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              >
                {WEB_SPEECH_LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">AWS uses the service&apos;s TRANSCRIBE_LANGUAGE.</p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-primary/10 bg-primary2/50 p-3">
              <input
                type="checkbox"
                checked={keepAudio}
                disabled={busy}
                onChange={(event) => setKeepAudio(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm">
                <span className="font-semibold text-primary">Save to bake-off set</span>
                <span className="block text-xs text-gray-500">Keeps the audio and reference in S3 under bakeoff/lab/ for `npm run bakeoff`. Otherwise the clip is deleted once scored.</span>
              </span>
            </label>

            {(phase === "done" || phase === "failed") && (
              <button
                type="button"
                onClick={() => engine.reset()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Clear the deck
              </button>
            )}
          </aside>
        </div>

        {shown ? (
          <div className="flex flex-col gap-2">
            {selectedId && (
              <button type="button" onClick={() => setSelectedId(null)} className="self-start text-xs font-semibold text-gray-600 underline-offset-2 hover:underline">
                ← Back to the current clip
              </button>
            )}
            <LabScorecard run={shown} />
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-primary/15 px-5 py-8 text-center text-sm text-gray-500">
            Stop a clip to see the three engines scored here, or open one of your runs below.
          </p>
        )}

        <LabRunsTable runs={runs} error={runsError} selectedId={selectedId} onSelect={(run) => setSelectedId(run.id)} />
        <LabStatsPanel stats={stats} error={statsError} />
      </div>
    </div>
  );
}
