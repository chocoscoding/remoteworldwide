"use client";

import { CheckCircle2, LoaderCircle, Mic, XCircle } from "lucide-react";
import type { LabRun, LabRunStatus } from "@/app/lib/voice/types";
import { formatDuration } from "@/app/lib/voice/format";
import { formatPct, formatWhen, LAB_PROVIDER_ORDER, PROVIDER_LABELS } from "./labFormat";

const STATUS: Record<LabRunStatus, { label: string; className: string; Icon: typeof Mic }> = {
  recording: { label: "Not finished", className: "bg-gray-100 text-gray-600", Icon: Mic },
  processing: { label: "Transcribing", className: "bg-amber-50 text-amber-800", Icon: LoaderCircle },
  ready: { label: "Scored", className: "bg-green-50 text-green-700", Icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-red-50 text-red-700", Icon: XCircle },
};

interface LabRunsTableProps {
  runs: LabRun[] | null;
  error: string | null;
  selectedId: string | null;
  onSelect: (run: LabRun) => void;
}

/** Your latest runs (kept 30 days), each engine's normalized WER in a column; a run's time opens its scorecard. */
export default function LabRunsTable({ runs, error, selectedId, onSelect }: LabRunsTableProps) {
  return (
    <section className="rounded-2xl border border-primary/10 bg-white">
      <header className="border-b border-primary/10 px-5 py-4">
        <h2 className="text-lg font-bold text-primary">Your runs</h2>
        <p className="text-xs text-gray-500">The latest 50, kept for 30 days. The audio is kept only for clips saved to the bake-off set.</p>
      </header>
      {error ? (
        <p className="px-5 py-6 text-sm text-red-700">{error}</p>
      ) : runs === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-5 w-5 animate-spin text-gray-400" aria-label="Loading runs" />
        </div>
      ) : runs.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-500">No runs yet. Record a clip above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-gray-500">
                <th scope="col" className="px-5 py-2 font-medium">When</th>
                <th scope="col" className="px-3 py-2 font-medium">Length</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                {LAB_PROVIDER_ORDER.map((provider) => (
                  <th key={provider} scope="col" className="px-3 py-2 text-right font-medium">
                    {PROVIDER_LABELS[provider].name}
                  </th>
                ))}
                <th scope="col" className="px-5 py-2 text-right font-medium">Saved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {runs.map((run) => {
                const status = STATUS[run.status];
                const selected = run.id === selectedId;
                return (
                  <tr key={run.id} className={`transition-colors hover:bg-primary2/60 ${selected ? "bg-primary2" : ""}`}>
                    <td className="px-5 py-2.5">
                      <button type="button" onClick={() => onSelect(run)} aria-pressed={selected} className="text-left font-medium text-primary underline-offset-2 hover:underline">
                        {formatWhen(run.createdAt)}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{run.durationMs > 0 ? formatDuration(run.durationMs) : "–"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                        <status.Icon className={`h-3 w-3 ${run.status === "processing" ? "animate-spin" : ""}`} aria-hidden />
                        {status.label}
                      </span>
                    </td>
                    {LAB_PROVIDER_ORDER.map((provider) => {
                      const result = run.results.find((entry) => entry.provider === provider);
                      return (
                        <td key={provider} className="px-3 py-2.5 text-right font-mono tabular-nums text-primary">
                          {result ? formatPct(result.normalizedWer) : "–"}
                        </td>
                      );
                    })}
                    <td className="px-5 py-2.5 text-right text-gray-600">{run.audioKept ? "Yes" : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
