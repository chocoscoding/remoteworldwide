"use client";

import { useEffect, useRef } from "react";
import type { ChannelStatus, LiveChannelState } from "./labCapture";
import { formatLatency } from "./labFormat";

const STATUS: Record<ChannelStatus, { label: string; light: string }> = {
  off: { label: "Off", light: "bg-primary2/20" },
  connecting: { label: "Connecting", light: "bg-primary2/60 animate-pulse" },
  live: { label: "Live", light: "bg-secondary animate-pulse" },
  ended: { label: "Ended", light: "bg-primary2/40" },
  unavailable: { label: "Unavailable", light: "bg-red-400" },
};

interface ChannelPaneProps {
  channel: 1 | 2;
  name: string;
  detail: string;
  state: LiveChannelState;
  /** Whether a clip is being recorded, which is when an empty pane means silence rather than nothing yet. */
  recording: boolean;
}

/**
 * One live engine's captions, as a channel on the recording deck: its status
 * light (with a word, never colour alone), how soon it answered, and the text
 * it has settled with the still-changing tail after it.
 */
export default function ChannelPane({ channel, name, detail, state, recording }: ChannelPaneProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const status = STATUS[state.status];
  const empty = !state.text && !state.interim;

  // Keep the newest words in view as captions arrive.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.text, state.interim]);

  return (
    <section aria-label={`Channel ${channel}: ${name}`} className="flex min-w-0 flex-col rounded-xl border border-primary2/10 bg-primary2/5">
      <header className="flex items-start justify-between gap-3 border-b border-primary2/10 px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">CH{channel}</p>
          <h3 className="truncate text-sm font-semibold text-primary2">{name}</h3>
          <p className="truncate text-xs text-primary2/50">{detail}</p>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary2/70">
            <span aria-hidden className={`h-2 w-2 rounded-full ${status.light}`} />
            {status.label}
          </span>
          <span className="font-mono text-[11px] text-primary2/50" title="From the start of the clip to this engine's first result">
            first result <span className="text-primary2">{formatLatency(state.firstResultMs)}</span>
          </span>
        </div>
      </header>
      <div ref={scroller} aria-live="polite" className="h-44 overflow-y-auto px-4 py-3 text-sm leading-relaxed sm:h-52">
        {empty ? (
          <p className="text-primary2/35">{state.note ?? (recording ? "Listening…" : "Captions appear here while you record.")}</p>
        ) : (
          <p className="whitespace-pre-wrap break-words text-primary2">
            {state.text}
            {state.interim && <span className="text-primary2/45 italic">{state.text ? " " : ""}{state.interim}</span>}
          </p>
        )}
      </div>
      {!empty && state.note && <p className="border-t border-primary2/10 px-4 py-2 text-xs text-red-300">{state.note}</p>}
    </section>
  );
}
