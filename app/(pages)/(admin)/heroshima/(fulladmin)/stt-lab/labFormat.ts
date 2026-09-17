// Readouts for the STT lab. Numbers are shown the way the bake-off report
// shows them, so a lab run and a bake-off row can be compared at a glance.

import type { LabProvider, LabRun, LiveSttProvider } from "@/app/lib/voice/types";

export const LAB_PROVIDER_ORDER: readonly LabProvider[] = ["aws-transcribe", "web-speech", "aws-transcribe-batch"];

export const PROVIDER_LABELS: Record<LabProvider, { name: string; detail: string }> = {
  "aws-transcribe": { name: "AWS streaming", detail: "Live captions through the voice gateway" },
  "web-speech": { name: "Web Speech", detail: "The browser's own recognizer" },
  "aws-transcribe-batch": { name: "AWS batch", detail: "What every report transcript uses" },
};

export const LIVE_PROVIDER_LABELS: Record<LiveSttProvider, string> = {
  "aws-transcribe": "AWS streaming",
  "web-speech": "Web Speech",
};

const DASH = "–";

export function formatPct(value: number | null, digits = 1): string {
  return value === null ? DASH : `${(value * 100).toFixed(digits)}%`;
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return DASH;
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  return ms < 10_000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms / 1000)} s`;
}

export function formatUsd(value: number | null): string {
  if (value === null) return DASH;
  return value === 0 ? "free" : `$${value < 0.01 ? value.toFixed(4) : value.toFixed(3)}`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return DASH;
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWhen(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return DASH;
  return at.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** The engine with the lowest normalized WER, when at least two were scored; null otherwise or on a tie. */
export function bestProvider(run: LabRun): LabProvider | null {
  const scored = run.results.filter((result) => result.normalizedWer !== null);
  if (scored.length < 2) return null;
  const sorted = [...scored].sort((a, b) => (a.normalizedWer as number) - (b.normalizedWer as number));
  return sorted[0].normalizedWer === sorted[1].normalizedWer ? null : sorted[0].provider;
}
