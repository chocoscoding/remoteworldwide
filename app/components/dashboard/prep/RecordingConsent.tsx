"use client";

// The recording consent for a voice interview, and its hand-off from the setup
// screen to the live one.
//
// Consent is per session: the box starts unticked every time, and the create
// call carries the consent version the service has in force (a stale version
// is refused). The wording says exactly what is kept and for how long.
//
// The hand-off goes through sessionStorage rather than the live page's URL. A
// URL can be bookmarked, shared or restored from history, and a link that
// starts a recording for whoever opens it is not consent. The stored tick only
// lives for this tab, for one track, for a few minutes, and the live page
// clears it once the session exists; without it the live page asks again.

import { FC, useId } from "react";
import { cn } from "@/lib/utils";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";

export const RECORDING_CONSENT_LABEL = "Record my answers for delivery coaching. Kept until I delete this session or my account.";

export const RECORDING_CONSENT_DETAIL =
  "Your recording is sent to AWS to be transcribed and to our own service to measure your delivery. You can delete it from the session's report at any time.";

export interface RecordingConsentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** On the dark call screen. */
  dark?: boolean;
  className?: string;
}

const RecordingConsent: FC<RecordingConsentProps> = ({ checked, onChange, disabled = false, dark = false, className }) => {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "group flex items-start gap-2.5 rounded-xl border p-3.5 text-left transition-colors",
        "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
        dark ? "border-white/15 bg-white/5 has-[:focus-visible]:outline-white" : "border-black/10 bg-[#fbfbf7] has-[:focus-visible]:outline-[#222325]",
        disabled ? "opacity-50 cursor-not-allowed" : dark ? "cursor-pointer hover:border-white/35" : "cursor-pointer hover:border-black/25",
        className,
      )}>
      {/* The real control, for keyboards and screen readers; the box beside it is its picture. */}
      <input id={id} type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <NeoCheckbox checked={checked} size="sm" dark={dark} interactive={!disabled} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[13px] font-bold leading-snug", dark ? "text-white" : "text-primary")}>{RECORDING_CONSENT_LABEL}</span>
        <span className={cn("block text-xs leading-relaxed mt-1", dark ? "text-white/55" : "text-black/50")}>{RECORDING_CONSENT_DETAIL}</span>
      </span>
    </label>
  );
};

export default RecordingConsent;

// ---------------------------------------------------------------------------
// Hand-off to the live page
// ---------------------------------------------------------------------------

const HANDOFF_KEY = "rww.prep.recordingConsent";
/** Long enough for a slow page load and a mic prompt; short enough that a forgotten tab does not carry it. */
const HANDOFF_TTL_MS = 10 * 60_000;

interface ConsentHandoff {
  trackId: string;
  version: string;
  at: number;
}

function readHandoff(): ConsentHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentHandoff> | null;
    if (!parsed || typeof parsed.trackId !== "string" || typeof parsed.version !== "string" || typeof parsed.at !== "number") return null;
    return { trackId: parsed.trackId, version: parsed.version, at: parsed.at };
  } catch {
    // Storage blocked (private mode, a sandbox): the live page asks again.
    return null;
  }
}

/** Called by the setup screen as the user starts a voice session with the box ticked. */
export function handConsentToLive(trackId: string, version: string): void {
  try {
    const handoff: ConsentHandoff = { trackId, version, at: Date.now() };
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    // The live page asks again.
  }
}

/** The consent version ticked on the setup screen for this track, if it is still fresh. Does not consume it. */
export function peekConsentHandoff(trackId: string): string | null {
  const handoff = readHandoff();
  if (!handoff || handoff.trackId !== trackId) return null;
  const age = Date.now() - handoff.at;
  return age >= 0 && age <= HANDOFF_TTL_MS ? handoff.version : null;
}

/** Once a session exists (or the tick is no longer wanted), so a reload asks again. */
export function clearConsentHandoff(): void {
  try {
    window.sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    // Nothing stored, or storage blocked.
  }
}
