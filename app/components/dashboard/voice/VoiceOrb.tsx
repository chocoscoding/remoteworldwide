"use client";

import { FC } from "react";
import { cn } from "@/lib/utils";

/**
 * The interviewer's presence. Pulses only while they're actually speaking —
 * the animation is bound to `speechSynthesis` firing onstart/onend, so it is
 * genuine feedback about audio state rather than idle decoration.
 */
export interface VoiceOrbProps {
  speaking: boolean;
  /** Shown under the orb, e.g. the interviewer's name. */
  label?: string;
  sublabel?: string;
  className?: string;
}

const VoiceOrb: FC<VoiceOrbProps> = ({ speaking, label, sublabel, className }) => (
  <div className={cn("flex flex-col items-center gap-4", className)}>
    <div className="relative h-[132px] w-[132px] flex items-center justify-center">
      {/* Expanding rings, staggered so they read as a pulse, not a flash. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full border border-[#e1f073]/40",
          speaking ? "animate-[orbPulse_2s_ease-out_infinite]" : "opacity-0"
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full border border-[#e1f073]/30",
          speaking ? "animate-[orbPulse_2s_ease-out_infinite_0.66s]" : "opacity-0"
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full border border-[#e1f073]/20",
          speaking ? "animate-[orbPulse_2s_ease-out_infinite_1.33s]" : "opacity-0"
        )}
      />

      <span
        className={cn(
          "relative h-[84px] w-[84px] rounded-full transition-all duration-300",
          speaking
            ? "bg-[#e1f073] shadow-[0_0_44px_10px_rgba(225,240,115,0.32)] scale-105"
            : "bg-white/10 border border-white/15 scale-100"
        )}
      />
    </div>

    {label && (
      <div className="text-center">
        <p className="text-sm font-bold text-white">{label}</p>
        {sublabel && <p className="text-xs text-white/45 mt-0.5">{speaking ? "Speaking…" : sublabel}</p>}
      </div>
    )}

    <style>{`
      @keyframes orbPulse {
        0%   { transform: scale(0.68); opacity: 0.9; }
        100% { transform: scale(1.28); opacity: 0; }
      }
    `}</style>
  </div>
);

export default VoiceOrb;
