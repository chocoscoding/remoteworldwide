"use client";

// Talk mode inside the composer: status, the live spectrum and the clock where the text box was.

import { useCallback, useEffect, useRef, type FC, type RefObject } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { ariaTime, formatClock } from "@/app/lib/voice/format";
import { isTalkActive, problemAction, problemCopy, type TalkPhase } from "@/app/lib/voice/talkState";
import { cn } from "@/lib/utils";
import type { VoiceConversation } from "./useVoiceConversation";
import VoiceFrequencyBars from "./VoiceFrequencyBars";

/** At or under this many seconds left, the clock also shows what remains. */
const LOW_REMAINING_SECONDS = 120;

const PENDING_STATUS: Partial<Record<TalkPhase, string>> = {
  "checking-mic": "Connecting…",
  minting: "Connecting…",
  connecting: "Connecting…",
  ending: "Ending…",
};

const TEXT_ACTION =
  "inline-flex h-7 flex-none items-center rounded-md px-2 text-xs font-bold text-primary cursor-pointer transition-colors hover:bg-black/5";

export interface InlineTalkBarProps {
  talk: VoiceConversation;
  /** The status while the agent talks: "Coach is speaking", "Answering". */
  speakingLabel: string;
  /** Hides this bar and focuses the screen's text box. */
  onTypeInstead: () => void;
  /** The screen's Talk/End button: focus goes there after Retry. */
  controlRef?: RefObject<HTMLElement | null>;
  className?: string;
}

const InlineTalkBar: FC<InlineTalkBarProps> = ({ talk, speakingLabel, onTypeInstead, controlRef, className }) => {
  const live = talk.state === "live";
  const agentTurn = live && talk.agentSpeaking;
  const agentRef = useRef(agentTurn);
  const { problem, getInputFrequencyData, getOutputFrequencyData } = talk;
  const action = problem && talk.canStart ? problemAction(problem) : null;
  const status = problem ? problemCopy(problem) : live ? (talk.agentSpeaking ? speakingLabel : "Listening") : (PENDING_STATUS[talk.state] ?? "Call ended");
  const showClock = !problem && (live || talk.state === "ending");
  const remaining = talk.remainingSeconds;
  const low = remaining !== null && remaining <= LOW_REMAINING_SECONDS;

  useEffect(() => {
    agentRef.current = agentTurn;
  }, [agentTurn]);

  // Whoever is talking, read per frame from a ref: switching speaker must not restart the bars' frame loop.
  const readSpectrum = useCallback(
    () => (agentRef.current ? getOutputFrequencyData() : getInputFrequencyData()),
    [getInputFrequencyData, getOutputFrequencyData],
  );

  const retryWith = (run: () => void) => {
    run();
    controlRef?.current?.focus();
  };
  const typeInstead = () => {
    if (isTalkActive(talk.state)) talk.end();
    onTypeInstead();
  };

  return (
    <div data-talk className={cn("flex min-w-0 items-center gap-3", className)}>
      <p
        role="status"
        aria-live="polite"
        title={problem ? status : undefined}
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-xs font-semibold",
          problem ? "flex-1 text-[#b23c26]" : "max-w-[45%] flex-none text-primary sm:min-w-[7.5rem]",
        )}>
        {problem ? (
          <AlertTriangle className="h-3.5 w-3.5 flex-none" aria-hidden />
        ) : (
          <span
            aria-hidden
            className={cn(
              "h-1.5 w-1.5 flex-none rounded-full",
              !live ? "animate-pulse bg-black/30 motion-reduce:animate-none" : agentTurn ? "bg-[#e1f073] ring-1 ring-[#222325]" : "bg-[#222325]",
            )}
          />
        )}
        <span className="truncate">{status}</span>
      </p>

      {problem ? (
        <span className="flex flex-none items-center gap-0.5">
          {action === "retry" && (
            <button
              type="button"
              onClick={() => retryWith(talk.start)}
              aria-label="Retry the voice call"
              title="Retry"
              className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md text-[#b23c26] cursor-pointer transition-colors hover:bg-[#b23c26]/10">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          {action === "end-other" && (
            <button type="button" onClick={() => retryWith(talk.endOtherCall)} className={TEXT_ACTION}>
              End that call
            </button>
          )}
          <button type="button" onClick={typeInstead} className={TEXT_ACTION}>
            Type instead
          </button>
        </span>
      ) : (
        <>
          <VoiceFrequencyBars
            getFrequencyData={readSpectrum}
            active={live}
            className={cn(
              "mx-auto h-8 max-w-[420px] flex-1 rounded-full px-3 py-1 transition-colors duration-300 motion-reduce:transition-none",
              agentTurn ? "bg-[#222325]" : "bg-transparent",
            )}
            barClassName={cn("transition-colors duration-300 motion-reduce:transition-none", agentTurn ? "bg-[#e1f073]" : "bg-[#222325]", !live && "opacity-25")}
          />
          {showClock && (
            <span className="flex-none text-[11px] font-semibold tabular-nums text-black/45">
              <span aria-hidden>{formatClock(talk.elapsedMs)}</span>
              <span className="sr-only">{ariaTime(talk.elapsedMs)} elapsed</span>
              {low && (
                <span className="text-[#b23c26]">
                  <span aria-hidden> · {formatClock(remaining * 1_000)} left</span>
                  <span className="sr-only">, {ariaTime(remaining * 1_000)} left</span>
                </span>
              )}
            </span>
          )}
        </>
      )}
    </div>
  );
};

export default InlineTalkBar;
