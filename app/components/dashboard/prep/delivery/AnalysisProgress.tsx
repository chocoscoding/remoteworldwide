"use client";

import type { FC } from "react";
import { AlertTriangle, Check, Clock, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import type { AnalysisStep, PrepSessionMode, PrepSessionStatus, StepState } from "@/app/lib/voice/types";
import { BUTTON_SOLID } from "../prep-styles";

/**
 * Where a saved session's report is up to, while the page polls for it.
 *
 * The pipeline has six steps; the user sees four stages in their own words.
 * A typed session skips the audio steps (the service marks them `skipped`)
 * and sees two. After a final failure the user may retry a few times, and the
 * card says how many are left.
 */
export interface AnalysisProgressProps {
  status: PrepSessionStatus;
  steps: Record<AnalysisStep, StepState>;
  /** 0-100. */
  progress: number;
  /** The service's short, user-facing reason after a failure. */
  error: string | null;
  retriesLeft: number;
  onRetry: () => void;
  /** A retry request is in flight. */
  retrying?: boolean;
  /** Defaults to what the steps say: all three audio steps skipped means typed. */
  mode?: PrepSessionMode;
  className?: string;
}

interface Stage {
  label: string;
  steps: AnalysisStep[];
}

const VOICE_STAGES: Stage[] = [
  { label: "Saving your recording", steps: ["assemble"] },
  { label: "Transcribing what you said", steps: ["transcribe"] },
  { label: "Measuring your delivery", steps: ["prosody", "flags"] },
  { label: "Writing the report", steps: ["report", "charge"] },
];

const TEXT_STAGES: Stage[] = [
  { label: "Reading your answers", steps: ["flags"] },
  { label: "Writing the report", steps: ["report", "charge"] },
];

type StageState = "done" | "running" | "waiting" | "failed" | "pending";

const finished = (s: StepState) => s.status === "done" || s.status === "skipped";

function stageStates(stages: Stage[], steps: AnalysisProgressProps["steps"], status: PrepSessionStatus): StageState[] {
  const raw = stages.map((stage): StageState => {
    const states = stage.steps.map((id) => steps[id]);
    if (states.some((s) => s.status === "failed")) return "failed";
    if (states.every(finished)) return "done";
    if (states.some((s) => s.status === "running")) return "running";
    return "pending";
  });
  // Between two steps nothing is `running` for a moment; the first stage not
  // done is still the one being worked on. Queued or parked, it is waiting.
  const next = raw.findIndex((s) => s !== "done");
  if (next >= 0 && raw[next] === "pending" && !raw.includes("running") && !raw.includes("failed")) {
    raw[next] = status === "processing" || status === "uploading" || status === "open" ? "running" : "waiting";
  }
  return raw;
}

const HEADLINES: Record<PrepSessionStatus, string> = {
  open: "Saving your recording",
  uploading: "Saving your recording",
  queued: "Your report is next in line",
  processing: "Building your report",
  delayed: "Your report is waiting its turn",
  ready: "Your report is ready",
  failed: "We couldn't finish your report",
  deleting: "Deleting this session",
};

function subline(status: PrepSessionStatus, mode: PrepSessionMode): string {
  switch (status) {
    case "open":
    case "uploading":
      return "Waiting for the last pieces of your recording to arrive. This page updates by itself.";
    case "queued":
    case "processing":
      return mode === "voice"
        ? "This usually takes a minute or two. You can leave this page; the report will be here when you come back."
        : "This usually takes under a minute. You can leave this page; the report will be here when you come back.";
    case "delayed":
      return "We're busy right now and will pick this up again within about half an hour. You don't need to keep this page open.";
    case "deleting":
      return "The recording, transcript and report are being removed.";
    default:
      return "";
  }
}

const AnalysisProgress: FC<AnalysisProgressProps> = ({ status, steps, progress, error, retriesLeft, onRetry, retrying = false, mode, className }) => {
  const resolvedMode: PrepSessionMode = mode ?? (steps.assemble.status === "skipped" && steps.transcribe.status === "skipped" && steps.prosody.status === "skipped" ? "text" : "voice");
  const stages = resolvedMode === "voice" ? VOICE_STAGES : TEXT_STAGES;
  const states = stageStates(stages, steps, status);
  const failed = status === "failed";
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const current = stages[states.findIndex((s) => s === "running" || s === "waiting" || s === "failed")];

  return (
    <section aria-label="Report progress" className={cn("rounded-2xl border bg-white p-6", failed ? "border-[#c0392b]/25" : "border-black/10", className)}>
      <div role="status" aria-live="polite">
        <p className={cn("text-[15px] font-bold", failed ? "text-[#b23c26]" : "text-primary")}>{HEADLINES[status]}</p>
        <p className="mt-1 max-w-[520px] text-sm leading-relaxed text-black/55">
          {failed ? (error ?? "Something went wrong while we analysed this session.") : subline(status, resolvedMode)}
        </p>
        {current && !failed && <span className="sr-only">Now: {current.label}.</span>}
      </div>

      <ol className="mt-4 flex flex-col gap-2.5">
        {stages.map((stage, i) => {
          const state = states[i];
          return (
            <li key={stage.label} className={cn("flex items-center gap-2.5 text-sm font-semibold", state === "pending" ? "text-black/40" : "text-primary")}>
              <StageIcon state={state} />
              <span className={cn(state === "failed" && "text-[#b23c26]")}>{stage.label}</span>
              {state === "waiting" && <span className="text-xs font-medium text-black/45">· waiting to start</span>}
              <span className="sr-only">
                {state === "done" ? ", done" : state === "running" ? ", in progress" : state === "failed" ? ", failed" : state === "waiting" ? "" : ", not started"}
              </span>
            </li>
          );
        })}
      </ol>

      {!failed && (
        <div role="progressbar" aria-label="Report progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-4">
          <ProgressBar value={pct} height="h-1.5" />
        </div>
      )}

      {failed && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          {retriesLeft > 0 ? (
            <>
              <button type="button" onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined} className={cn(BUTTON_SOLID, "disabled:cursor-default disabled:opacity-60")}>
                {retrying ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw aria-hidden className="h-3.5 w-3.5" />}
                Try again
              </button>
              <span className="text-xs text-black/45">
                {retriesLeft === 1 ? "1 retry left" : `${retriesLeft} retries left`} for this session
              </span>
            </>
          ) : (
            <span className="text-xs leading-relaxed text-black/55">You&apos;ve used every retry for this session. Your transcript is still here.</span>
          )}
        </div>
      )}
    </section>
  );
};

const StageIcon: FC<{ state: StageState }> = ({ state }) => {
  const base = "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full";
  switch (state) {
    case "done":
      return (
        <span aria-hidden className={cn(base, "bg-secondary text-[#222325]")}>
          <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
        </span>
      );
    case "running":
      return (
        <span aria-hidden className={cn(base, "border-2 border-[#222325]")}>
          <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={3} />
        </span>
      );
    case "waiting":
      return (
        <span aria-hidden className={cn(base, "border-2 border-[#222325]")}>
          <Clock className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      );
    case "failed":
      return (
        <span aria-hidden className={cn(base, "bg-[#fdeae6] text-[#b23c26]")}>
          <AlertTriangle className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      );
    default:
      return <span aria-hidden className={cn(base, "border-2 border-black/15")} />;
  }
};

export default AnalysisProgress;
