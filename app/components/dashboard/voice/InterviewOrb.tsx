"use client";

// The interviewer's presence, and the main control of a spoken interview.
//
// Wraps orb-ui's Orb with our palette (orbTheme.ts) and the ElevenLabs adapter,
// which owns the session: Orb calls start()/stop() when the orb is clicked, and
// the adapter reports listening/thinking/speaking plus live input and output
// levels, so the animation is genuine audio feedback rather than decoration.
//
// Two things the adapter does not do, both handled here.
//
// It does not distinguish hanging up from dropping out: `onError` reports
// `error`, but `onDisconnect` resets to `idle`. Since the orb is a single
// colour (see orbTheme.ts), state drives the caption and the motion — so a
// candidate whose connection died mid-answer would be told "Ready when you are"
// and left waiting for a question that is never coming. `withConnectionLoss`
// closes that gap.
//
// And orb-ui's `circle` theme animates `idle`, `connecting` and `thinking`
// identically — surface only, no glow — so connecting is invisible in the orb
// itself. The spinner below says it instead.

import { useEffect, useMemo, useState, type FC } from "react";
import { Loader2 } from "lucide-react";
import { Orb, type OrbAdapter, type OrbSignal, type OrbSignalListener, type OrbState } from "orb-ui";
import { cn } from "@/lib/utils";
import { ORB_STATE_LABEL, interviewOrbTheme } from "./orbTheme";

/** States that mean a session was actually running. */
const LIVE_STATES: ReadonlySet<OrbState> = new Set<OrbState>(["connecting", "listening", "thinking", "speaking"]);

/**
 * Turns an unannounced drop into `error`, so a lost connection says so.
 *
 * A return to `idle` is only ever legitimate after WE stopped the session —
 * the orb was clicked, or the interview ended. Any other fall back to idle
 * came from the socket going away underneath.
 *
 * It keeps ONE upstream subscription and fans out to its own listeners, rather
 * than wrapping each `subscribe` call. Two subscribers — Orb and the caption
 * below it — would otherwise each run the transform over the same signal, and
 * whichever ran first would consume the transition by advancing `previous`,
 * leaving the second to see an ordinary idle and never report the drop. The
 * last signal is replayed to late subscribers because the underlying adapter
 * emits on subscribe, and a listener that arrives second would otherwise start
 * blank.
 */
export const withConnectionLoss = (adapter: OrbAdapter): OrbAdapter => {
  const listeners = new Set<OrbSignalListener>();
  let unsubscribe: (() => void) | null = null;
  let intentional = false;
  let previous: OrbState = "idle";
  let last: OrbSignal | null = null;

  const connect = () => {
    if (unsubscribe) return;
    unsubscribe = adapter.subscribe((signal) => {
      const dropped = signal.state === "idle" && LIVE_STATES.has(previous) && !intentional;
      previous = signal.state;
      last = dropped ? { ...signal, state: "error", inputVolume: 0, outputVolume: 0 } : signal;
      for (const listener of listeners) listener(last);
    });
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      connect();
      if (last) listener(last);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribe?.();
          unsubscribe = null;
        }
      };
    },
    async start() {
      // A retry clears the previous failure: the next idle is legitimate again
      // only once we have stopped it ourselves.
      intentional = false;
      previous = "idle";
      await adapter.start?.();
    },
    async stop() {
      intentional = true;
      await adapter.stop?.();
    },
  };
};

/** The orb's current state, for the chrome underneath it. Null adapter = controlled mode. */
const useOrbState = (adapter: OrbAdapter | null): OrbState => {
  const [state, setState] = useState<OrbState>("idle");
  useEffect(() => {
    if (!adapter) return;
    return adapter.subscribe((signal) => setState(signal.state));
  }, [adapter]);
  return state;
};

export interface InterviewOrbProps {
  /**
   * The session, when a provider owns it. With an adapter the orb is also the
   * control: clicking it starts and stops.
   */
  adapter?: OrbAdapter;
  /**
   * Controlled mode, for when THIS app owns the session — which is where the
   * interview screen still is: it drives the mic, the recording and the
   * interviewer's voice itself, so it already knows the state and the levels.
   * Ignored when `adapter` is given.
   */
  signal?: OrbSignal;
  /** Shown under the orb — the interviewer's name. */
  label?: string;
  /**
   * Overrides the caption. Defaults to what the state means; pass this to say
   * something more specific ("Reconnecting…", "Out of minutes").
   */
  caption?: string;
  /**
   * Draw the caption forward. For captions that are about to cause something —
   * "Sending in 3…" — which must not read at the same weight as a state name,
   * or the answer goes before anyone noticed it was going.
   */
  captionEmphasis?: boolean;
  size?: number;
  /** The surface it sits on. The live interview screen is dark; the dashboard is not. */
  tone?: "light" | "dark";
  className?: string;
}

const InterviewOrb: FC<InterviewOrbProps> = ({ adapter, signal, label, caption, captionEmphasis, size = 200, tone = "light", className }) => {
  // Decorated once per adapter: rebuilding it would drop the subscription and
  // lose the state it needs to tell a hang-up from a drop.
  const guarded = useMemo(() => (adapter ? withConnectionLoss(adapter) : null), [adapter]);
  const adapterState = useOrbState(guarded);
  const state = guarded ? adapterState : (signal?.state ?? "idle");
  const connecting = state === "connecting";
  const dark = tone === "dark";

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <Orb
        // Exactly one source drives it. Passing both would let the adapter's
        // state and a stale controlled signal fight over the same orb.
        {...(guarded ? { adapter: guarded } : { signal: signal ?? { state: "idle" } })}
        theme={interviewOrbTheme}
        size={size}
        // Only an adapter makes the orb a control. In controlled mode it is a
        // status surface, and labelling it "start or stop" would promise a
        // button that is not there.
        {...(guarded
          ? { "aria-label": label ? `${label} — start or stop the interview` : "Start or stop the interview" }
          : { interactive: false })}
        slotProps={{
          // The caption is rendered below rather than inside, so it can say
          // more than the state machine knows.
          label: { className: "sr-only" },
        }}
      />

      <div className="flex flex-col items-center text-center">
        {/* Reserved height, so the caption does not jump when the spinner
            appears and disappears on either side of connecting. */}
        <span className="flex h-4 items-center justify-center" aria-hidden>
          {connecting && <Loader2 className={cn("h-4 w-4 animate-spin", dark ? "text-[#e1f073]" : "text-[#6c7a1e]")} />}
        </span>

        {label && <p className={cn("mt-1 text-sm font-bold", dark ? "text-white" : "text-primary")}>{label}</p>}
        <p
          // The orb is one colour and three of its six states animate alike, so
          // this line is the state for anyone who cannot see the difference.
          role="status"
          aria-live="polite"
          className={cn(
            "mt-0.5 text-xs",
            state === "error"
              ? dark
                ? "font-bold text-[#ff9b86]"
                : "font-bold text-[#b23c26]"
              : captionEmphasis
                ? dark
                  ? "font-bold text-white"
                  : "font-bold text-primary"
                : dark
                  ? "text-white/45"
                  : "text-black/45"
          )}>
          {caption ?? ORB_STATE_LABEL[state]}
        </p>
      </div>
    </div>
  );
};

export { ORB_STATE_LABEL };
export default InterviewOrb;
