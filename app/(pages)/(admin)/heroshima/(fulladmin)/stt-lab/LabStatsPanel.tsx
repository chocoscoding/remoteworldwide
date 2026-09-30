"use client";

import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import type { LabStats } from "@/app/lib/voice/types";
import { formatPct, LIVE_PROVIDER_LABELS } from "./labFormat";

interface LabStatsPanelProps {
  stats: LabStats | null;
  error: string | null;
}

/**
 * What real interviews say about the live engines, as stat tiles: each
 * engine's transcript rating, how closely what it heard live matched the
 * report transcript (Scribe, from the recording), and how often a session
 * meant for the ElevenLabs engine started on Web Speech captions instead.
 */
export default function LabStatsPanel({ stats, error }: LabStatsPanelProps) {
  return (
    <section className="rounded-2xl border border-primary/10 bg-white">
      <header className="border-b border-primary/10 px-5 py-4">
        <h2 className="text-lg font-bold text-primary">Real interviews</h2>
        <p className="text-xs text-gray-500">Voice interview sessions from the last {stats?.days ?? 30} days, by the engine that wrote their live captions.</p>
      </header>
      {error ? (
        <p className="px-5 py-6 text-sm text-red-700">{error}</p>
      ) : stats === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-5 w-5 animate-spin text-gray-400" aria-label="Loading interview figures" />
        </div>
      ) : (
        <div className="grid gap-px bg-primary/10 md:grid-cols-3">
          <Tile title="Transcript rating" note="The users' own 1–5 rating of their transcript.">
            {stats.ratings.map((row) => (
              <Figure
                key={row.provider}
                label={LIVE_PROVIDER_LABELS[row.provider]}
                value={row.meanScore === null ? "–" : `${row.meanScore.toFixed(1)} / 5`}
                count={row.sessions}
                unit="rated"
              />
            ))}
          </Tile>
          <Tile
            title="Heard live vs report"
            note="Median WER of what was recognised live against the report transcript, over answers that have both: agreement, not accuracy. Lower means the interviewer heard what the report scored."
          >
            {stats.liveAgreement.map((row) => (
              <Figure key={row.provider} label={LIVE_PROVIDER_LABELS[row.provider]} value={formatPct(row.medianWer)} count={row.sessions} unit="compared" />
            ))}
          </Tile>
          <Tile
            title="Fell back to Web Speech"
            note="Voice sessions meant for the ElevenLabs engine that started on the browser's captions: the engine could not take calls (no key, engine or engine URL). Older sessions: from AWS."
          >
            <p className="font-mono text-4xl font-semibold tabular-nums text-primary">{formatPct(stats.fallbackRate)}</p>
            <p className="text-xs text-gray-500">{stats.fallbackRate === null ? "No voice sessions yet." : "of voice sessions"}</p>
          </Tile>
        </div>
      )}
    </section>
  );
}

function Tile({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 bg-white px-5 py-4">
      <div>
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-gray-500">{title}</h3>
        <p className="text-xs text-gray-500">{note}</p>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Figure({ label, value, count, unit }: { label: string; value: string; count: number; unit: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-primary/10 pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-primary">{label}</span>
      <span className="text-right">
        <span className="font-mono text-2xl font-semibold tabular-nums text-primary">{value}</span>
        <span className="block text-[11px] text-gray-500">
          {count} {unit}
        </span>
      </span>
    </div>
  );
}
