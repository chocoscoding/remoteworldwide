// Pause detection from audio levels. Pure: no DOM, no React.
//
// Moved here from app/components/dashboard/voice/pcm.ts, which re-exports both
// names so nothing that imported them there breaks. It lives beside the
// capture modules because a voice interview is what uses it: an answer closes
// on a natural pause, and in a browser with no live captions (Firefox) the
// audio level is the only sign that someone has stopped talking.

/** The packet length the detector assumes when the caller names none: 50 ms, the capture buffer it was first written for. */
const DEFAULT_PACKET_MS = 50;

/** Root mean square of the samples, each clamped to [-1, 1] first, 0 to 1: a packet's level, as the pause detector reads it. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    // `|| 0` turns NaN into silence; a hot mic past full scale counts as full scale.
    const v = samples[i] || 0;
    const s = v > 1 ? 1 : v < -1 ? -1 : v;
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

export interface PauseDetector {
  /** Feeds one packet's RMS. Returns true once, when speech has been followed by a long enough quiet. */
  push(volume: number): boolean;
  /** Whether speech has been heard since the last pause it reported. */
  hasSpeech(): boolean;
  reset(): void;
}

/**
 * Finds the pause after someone stops speaking, from packet volumes alone.
 *
 * A voice interview closes an answer on a natural pause, and the captions
 * cannot be relied on to say when one happened: AWS streaming may hold its
 * final result, and a browser without captions (Firefox) has none at all. So
 * the pause is found from the audio itself, whichever engine writes the
 * captions.
 *
 * Quiet is judged against the room, not a fixed level. The noise floor drops to
 * the quietest packet at once and rises slowly, so a hum that the mic's
 * automatic gain lifts during silence does not read as speech. While someone is
 * speaking it barely rises, so a long sentence does not raise the floor to its
 * own level. Speech has to last two packets, so a click or a knock on the desk
 * does not count as someone speaking.
 */
export function createPauseDetector(pauseMs = 800, packetMs = DEFAULT_PACKET_MS, minSpeechRms = 0.01): PauseDetector {
  let floor = -1;
  let speechMs = 0;
  let heard = false;
  let quietMs = 0;

  return {
    push(volume) {
      const v = Number.isFinite(volume) ? Math.max(0, volume) : 0;
      if (floor < 0 || v < floor) floor = v;
      const threshold = Math.max(minSpeechRms, floor * 3);

      if (v > threshold) {
        floor += (v - floor) * 0.001;
        speechMs += packetMs;
        quietMs = 0;
        if (speechMs >= packetMs * 2) heard = true;
        return false;
      }

      floor += (v - floor) * 0.05;
      speechMs = 0;
      if (!heard) return false;
      quietMs += packetMs;
      if (quietMs < pauseMs) return false;
      heard = false;
      quietMs = 0;
      return true;
    },
    hasSpeech() {
      return heard;
    },
    reset() {
      speechMs = 0;
      heard = false;
      quietMs = 0;
    },
  };
}
