"use client";

// The interview screen's orb, driven by the session this screen already owns.
//
// Drawn by AgentAudioVisualizerRadial, a LiveKit Agents UI visualizer ported to
// work without LiveKit. PrepLive owns the mic, the recording and the
// interviewer's voice, so it already knows the state. On the ElevenLabs Speech
// Engine it still does: the engine only adds its real levels, which are read
// here every frame and passed in as the bars' volume.
//
// It owns the level subscription instead of PrepLive doing it, and that is the
// whole point of the component: `onLevel` fires at animation rate, and lifting
// it into PrepLive's state would re-render the entire interview screen sixty
// times a second. Here only the orb re-renders.

import { useEffect, useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import type { OrbState } from "orb-ui";
import { AgentAudioVisualizerRadial } from "@/components/agents-ui/agent-audio-visualizer-radial";
import { ORB_COLOR, ORB_STATE_LABEL } from "@/app/components/dashboard/voice/orbTheme";
import { cn } from "@/lib/utils";

export interface PrepOrbProps {
  state: OrbState;
  /** Subscribe to mic amplitude 0-1; returns an unsubscribe. `useVoiceSession`/`useInterviewCapture` both expose `onLevel` in this shape. */
  onLevel?: (cb: (level: number) => void) => () => void;
  /** Whether the mic subscription should be running at all. */
  micActive?: boolean;
  /** The engine interviewer's real levels, 0-1, read every frame. Given both, they replace `onLevel` and the assumed output level. */
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
  label?: string;
  caption?: string;
  /** Draws the caption forward, for captions that are about to cause something ("Sending in 3…"). */
  captionEmphasis?: boolean;
  size?: "md" | "lg" | "xl";
  className?: string;
}

/**
 * What the orb shows while the interviewer talks.
 *
 * There is no real output envelope to give it: the interviewer's voice comes
 * from `speechSynthesis` or a pre-synthesized MP3, and neither exposes a level.
 * A steady value is the honest answer — the orb still reads as speaking,
 * because `speaking` has its own motion, and nothing here pretends to be a
 * waveform it did not measure. An engine interview passes its real levels
 * instead.
 */
const ASSUMED_OUTPUT_LEVEL = 0.55;

const PrepOrb: FC<PrepOrbProps> = ({ state, onLevel, micActive, getInputVolume, getOutputVolume, label, caption, captionEmphasis, size = "lg", className }) => {
  const [input, setInput] = useState(0);
  const [output, setOutput] = useState(0);
  const measured = Boolean(getInputVolume && getOutputVolume);

  useEffect(() => {
    if (!onLevel || !micActive || measured) return;
    return onLevel(setInput);
  }, [onLevel, micActive, measured]);

  // The engine's client exposes its levels only as reads: sampled once per frame.
  useEffect(() => {
    if (!getInputVolume || !getOutputVolume) return;
    let frame = requestAnimationFrame(function read() {
      setInput(getInputVolume());
      setOutput(getOutputVolume());
      frame = requestAnimationFrame(read);
    });
    return () => cancelAnimationFrame(frame);
  }, [getInputVolume, getOutputVolume]);

  // Masked rather than reset: zeroing the last level from inside the effect
  // would be state synchronisation, and the stale value is unreachable anyway
  // because every path that stops the mic also leaves `listening`.
  const inputVolume = micActive && state === "listening" ? input : 0;

  const outputVolume = state === "speaking" ? (measured ? output : ASSUMED_OUTPUT_LEVEL) : 0;
  const level = state === "speaking" ? outputVolume : inputVolume;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <AgentAudioVisualizerRadial
        // The orb is one colour in every state (see orbTheme.ts). Idle and
        // error have no animation of their own, so both show dim bars.
        state={state}
        size={size}
        color={ORB_COLOR}
        volumeBands={[level]}
        aria-hidden
      />

      <div className="flex flex-col items-center text-center">
        {/* Reserved height, so the caption does not jump when the spinner comes and goes. */}
        <span className="flex h-4 items-center justify-center" aria-hidden>
          {state === "connecting" && <Loader2 className="h-4 w-4 animate-spin text-[#e1f073]" />}
        </span>
        {label && <p className="mt-1 text-sm font-bold text-white">{label}</p>}
        <p
          role="status"
          aria-live="polite"
          className={cn("mt-0.5 text-xs", state === "error" ? "font-bold text-[#ff9b86]" : captionEmphasis ? "font-bold text-white" : "text-white/45")}>
          {caption ?? ORB_STATE_LABEL[state]}
        </p>
      </div>
    </div>
  );
};

export default PrepOrb;
