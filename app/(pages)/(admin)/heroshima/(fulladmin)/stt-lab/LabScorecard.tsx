"use client";

import type { LabProviderResult, LabRun } from "@/app/lib/voice/types";
import { formatDuration } from "@/app/lib/voice/format";
import { bestProvider, formatLatency, formatPct, formatUsd, formatWhen, LAB_PROVIDER_ORDER, PROVIDER_LABELS } from "./labFormat";

/**
 * WER as a thin bar on a recessive track, capped at 100% (WER can pass 1 when
 * an engine adds words; the number beside it says so). One hue: the length is
 * the data, and the row label names the engine.
 */
function WerBar({ value }: { value: number | null }) {
  if (value === null) return <span className="font-mono text-sm text-gray-400">–</span>;
  const width = `${Math.min(1, Math.max(0, value)) * 100}%`;
  return (
    <div className="flex min-w-[9rem] items-center gap-3" title={`Normalized WER ${formatPct(value)}`}>
      <div className="h-1.5 flex-1 rounded-full bg-primary/10">
        <div className="h-full rounded-full bg-primary" style={{ width }} />
      </div>
      <span className="w-14 text-right font-mono text-sm tabular-nums text-primary">{formatPct(value)}</span>
    </div>
  );
}

interface LabScorecardProps {
  run: LabRun;
}

/**
 * One clip's engines side by side: the scores as a table (so nothing rests on
 * the bars alone), then each transcript against the reference.
 */
export default function LabScorecard({ run }: LabScorecardProps) {
  const best = bestProvider(run);
  const byProvider = new Map(run.results.map((result) => [result.provider, result]));
  const rows = LAB_PROVIDER_ORDER.map((provider) => ({ provider, result: byProvider.get(provider) ?? null }));
  const scored = run.reference !== null;

  return (
    <section className="rounded-2xl border border-primary/10 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-primary/10 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-primary">Scorecard</h2>
          <p className="text-xs text-gray-500">
            {formatWhen(run.createdAt)} · {formatDuration(run.durationMs)} clip{run.audioKept ? " · saved to the bake-off set" : ""}
          </p>
        </div>
        {!scored && <p className="text-xs text-gray-500">No reference was pasted, so there is no WER. Latency and cost still count.</p>}
      </header>

      {run.error && <p className={`px-5 py-3 text-sm ${run.status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{run.error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-gray-500">
              <th scope="col" className="px-5 py-2 font-medium">Engine</th>
              <th scope="col" className="px-3 py-2 font-medium">WER</th>
              <th scope="col" className="px-3 py-2 text-right font-medium" title="Counting casing and punctuation">Raw WER</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">First result</th>
              <th scope="col" className="px-5 py-2 text-right font-medium">Est. cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {rows.map(({ provider, result }) => (
              <tr key={provider} className={best === provider ? "bg-secondary/25" : undefined}>
                <th scope="row" className="px-5 py-3 text-left align-top font-normal">
                  <span className="flex items-center gap-2 font-semibold text-primary">
                    {PROVIDER_LABELS[provider].name}
                    {best === provider && <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">Best</span>}
                  </span>
                  <span className="block text-xs text-gray-500">{PROVIDER_LABELS[provider].detail}</span>
                </th>
                {result ? <ResultCells result={result} /> : <td colSpan={4} className="px-3 py-3 text-xs text-gray-500">Not measured for this clip.</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 border-t border-primary/10 p-5 lg:grid-cols-2">
        {run.reference && <Transcript title="Reference" text={run.reference} open />}
        {rows.map(({ provider, result }) =>
          result ? <Transcript key={provider} title={PROVIDER_LABELS[provider].name} text={result.text} open={!run.reference && provider === "aws-transcribe"} /> : null,
        )}
      </div>
    </section>
  );
}

function ResultCells({ result }: { result: LabProviderResult }) {
  const numeric = "px-3 py-3 text-right align-top font-mono tabular-nums text-primary";
  return (
    <>
      <td className="px-3 py-3 align-top">
        <WerBar value={result.normalizedWer} />
      </td>
      <td className={numeric}>{formatPct(result.wer)}</td>
      <td className={numeric}>{formatLatency(result.firstPartialMs)}</td>
      <td className={`${numeric} pr-5`}>{formatUsd(result.estimatedUsd)}</td>
    </>
  );
}

function Transcript({ title, text, open }: { title: string; text: string; open?: boolean }) {
  return (
    <details open={open} className="group rounded-lg border border-primary/10 bg-primary2/60 px-4 py-3">
      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wider text-gray-600">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
        {title}
      </summary>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-primary">{text || <span className="text-gray-400">Nothing was transcribed.</span>}</p>
    </details>
  );
}
