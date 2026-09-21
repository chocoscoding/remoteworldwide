"use client";

// The interview screen's orb, driven by the session this screen already owns.
//
// orb-ui runs in controlled mode here rather than through a provider adapter:
// PrepLive holds the mic, the recording and the interviewer's voice itself, so
// it already knows the state. On the ElevenLabs Speech Engine it still does;
// the engine only adds its real levels, read here every frame.
//
// It owns the level subscription instead of PrepLive doing it, and that is the
// whole point of the component: `onLevel` fires at animation rate, and lifting
// it into PrepLive's state would re-render the entire interview screen sixty
// times a second. Here only the orb re-renders.

import { useEffect, useState, type FC } from "react";
import type { OrbState } from "orb-ui";
import InterviewOrb from "@/app/components/dashboard/voice/InterviewOrb";

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
  /** See InterviewOrb — for captions about to cause something. */
  captionEmphasis?: boolean;
  size?: number;
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

const PrepOrb: FC<PrepOrbProps> = ({ state, onLevel, micActive, getInputVolume, getOutputVolume, label, caption, captionEmphasis, size = 190, className }) => {
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

  return (
    <InterviewOrb
      signal={{
        state,
        inputVolume,
        outputVolume: state === "speaking" ? (measured ? output : ASSUMED_OUTPUT_LEVEL) : 0,
      }}
      label={label}
      caption={caption}
      captionEmphasis={captionEmphasis}
      size={size}
      tone="dark"
      className={className}
    />
  );
};

export default PrepOrb;
