// Ported from LiveKit Agents UI (@agents-ui/agent-audio-visualizer-radial).
// The only change is that it no longer depends on @livekit/components-react.
// That package was used here only for the AgentState type. The sequence is
// derived rather than set from an effect, and an infinite interval runs no frame loop.

import { useEffect, useMemo, useState } from "react";

/** The states the radial visualizer animates. A subset of LiveKit's AgentState, plus our own idle/error. */
export type RadialVisualizerState = "idle" | "connecting" | "initializing" | "listening" | "thinking" | "speaking" | "error";

function findGcdLessThan(columns: number, max: number = columns): number {
  function gcd(a: number, b: number): number {
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }
  for (let i = max; i >= 1; i--) {
    if (gcd(columns, i) === i) return i;
  }
  return 1;
}

function generateConnectingSequenceBar(columns: number): number[][] {
  const seq = [];
  const center = Math.floor(columns / 2);
  for (let x = 0; x < columns; x++) seq.push([x, (x + center) % columns]);
  return seq;
}

function generateListeningSequenceBar(columns: number): number[][] {
  const divisor = columns > 8 ? columns / findGcdLessThan(columns, 4) : findGcdLessThan(columns, 2);
  return Array.from({ length: divisor }, (_, idx) => [
    ...Array(Math.floor(columns / divisor))
      .fill(1)
      .map((_, idx2) => idx2 * divisor + idx),
  ]);
}

function sequenceFor(state: RadialVisualizerState | undefined, barCount: number): number[][] {
  if (state === "thinking" || state === "listening") return generateListeningSequenceBar(barCount);
  if (state === "connecting" || state === "initializing") return generateConnectingSequenceBar(barCount);
  if (state === undefined || state === "speaking") return [Array.from({ length: barCount }, (_, idx) => idx)];
  return [[]];
}

/** The bar indices lit right now. */
export const useAgentAudioVisualizerRadialAnimator = (state: RadialVisualizerState | undefined, barCount: number, interval: number): number[] => {
  const sequence = useMemo(() => sequenceFor(state, barCount), [state, barCount]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(interval) || sequence.length < 2) return;
    let startTime = performance.now();
    let frame = requestAnimationFrame(function animate(time) {
      if (time - startTime >= interval) {
        setIndex((prev) => prev + 1);
        startTime = time;
      }
      frame = requestAnimationFrame(animate);
    });
    return () => cancelAnimationFrame(frame);
  }, [interval, sequence]);

  return sequence[index % sequence.length] ?? [];
};
