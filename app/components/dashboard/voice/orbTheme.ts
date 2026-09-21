// The interview orb's look.
//
// One colour — the brand green — for every state. orb-ui already distinguishes
// the six states by motion: the connecting spinner, the glow that tracks input
// level while listening, the one that tracks output level while speaking, and
// the error state's own treatment. Recolouring on top of that says the same
// thing twice, and it costs the orb its identity: a control that changes colour
// six times in a conversation reads as a status light, not as the interviewer.
//
// It also means the orb is never red. A dropped connection is reported in the
// caption beneath it and by the state's own motion, which is where a specific,
// readable message belongs — a red circle can only say "something", and in a
// mock interview it says it alarmingly.

import { defineOrbTheme } from "orb-ui";

/** `secondary` in tailwind.config.ts — the brand green, and the orb's only colour. */
export const ORB_COLOR = "#e1f073";

/**
 * Every state, the same colour. Spelled out rather than built with a loop so
 * that the intent survives: this is one colour ON PURPOSE, not a palette
 * somebody forgot to finish.
 */
export const ORB_COLORS = {
  idle: ORB_COLOR,
  connecting: ORB_COLOR,
  listening: ORB_COLOR,
  thinking: ORB_COLOR,
  speaking: ORB_COLOR,
  error: ORB_COLOR,
} as const;

/**
 * `circle` rather than `cloud` or `radial`: those two take fixed colour slots
 * built around their own palettes, so they cannot be held to a single brand
 * colour. `bars` can, but it reads as a meter rather than a presence.
 */
export const interviewOrbTheme = defineOrbTheme({
  name: "circle",
  // Audio-reactive but not restless — this sits on screen for forty minutes.
  preset: "balanced",
  appearance: {
    colors: ORB_COLORS,
    listeningGlow: 0.55,
    speakingGlow: 0.85,
  },
});

/**
 * What the orb is doing, in words. With one colour this is the only thing that
 * names the state, so it is not decoration — `error` in particular has to say
 * what went wrong, because nothing else on screen will.
 */
export const ORB_STATE_LABEL: Record<keyof typeof ORB_COLORS, string> = {
  idle: "Ready when you are",
  connecting: "Connecting…",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Interviewer speaking",
  error: "Connection lost — tap to reconnect",
};
