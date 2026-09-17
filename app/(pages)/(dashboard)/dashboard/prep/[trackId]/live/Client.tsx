"use client";

import { FC, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrep } from "../../PrepProvider";
import PrepLive from "@/app/components/dashboard/prep/PrepLive";
import PrepPageShell from "@/app/components/dashboard/prep/PrepPageShell";
import PrepEmptyState from "@/app/components/dashboard/prep/PrepEmptyState";
import { SearchX } from "lucide-react";
import { FORMAT_META, SESSION_LENGTHS, type SessionFormat } from "@/app/lib/dashboard/prep-data";
import type { SessionConfig } from "@/app/components/dashboard/prep/PrepSetup";
import type { SessionInput } from "@/app/lib/dashboard/prep-engine";

export interface LiveClientProps {
  trackId: string;
}

const DIFFICULTIES = ["warm-up", "standard", "tough"] as const;
/** A shorter-session cap beyond this is not one the setup screen could have offered. */
const CAP_MINUTES_MAX = 120;

function parseConfig(searchParams: URLSearchParams): SessionConfig | null {
  const rawFormats = searchParams.get("format");
  const difficulty = searchParams.get("difficulty");
  const length = Number(searchParams.get("length"));
  const formats = (rawFormats ?? "").split(",").filter((f): f is SessionFormat => f in FORMAT_META);
  if (formats.length === 0) return null;
  if (!difficulty || !DIFFICULTIES.includes(difficulty as (typeof DIFFICULTIES)[number])) return null;
  if (!SESSION_LENGTHS.includes(length as (typeof SESSION_LENGTHS)[number])) return null;
  const config: SessionConfig = { formats, difficulty: difficulty as SessionConfig["difficulty"], lengthMinutes: length as SessionConfig["lengthMinutes"] };
  // Links from before voice interviews carry no mode: they were typed sessions.
  config.mode = searchParams.get("mode") === "voice" ? "voice" : "text";
  const cap = Number(searchParams.get("cap"));
  if (config.mode === "voice" && Number.isInteger(cap) && cap > 0 && cap <= CAP_MINUTES_MAX) config.capMinutes = cap;
  return config;
}

const LiveClient: FC<LiveClientProps> = ({ trackId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getTrack, endSession } = usePrep();
  const track = getTrack(trackId);
  const config = parseConfig(searchParams);

  // A missing/invalid config (e.g. someone bookmarked a malformed URL, or
  // typed one by hand) sends them back to pick one rather than crashing.
  useEffect(() => {
    if (track && !config) router.replace(`/dashboard/prep/${trackId}/setup`);
  }, [track, config, trackId, router]);

  // Only when the session could not be saved: the report is built in memory.
  function handleEnd(input: SessionInput) {
    const session = endSession(trackId, input);
    if (session) router.push(`/dashboard/prep/${trackId}/sessions/${session.id}`);
    else router.push(`/dashboard/prep/${trackId}`);
  }

  // A saved session's report is read from the AI service by its id.
  function handleSaved(serverId: string) {
    router.push(`/dashboard/prep/${trackId}/sessions/${encodeURIComponent(serverId)}`);
  }

  function handleSwitchToTyped() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "text");
    params.delete("cap");
    router.replace(`/dashboard/prep/${trackId}/live?${params.toString().replace(/%2C/g, ",")}`);
  }

  if (!track) {
    return (
      <PrepPageShell>
        <PrepEmptyState icon={SearchX} title="Track not found" body="This one may have been part of a previous session — mock data resets on reload." ctaLabel="Back to all interviews" onCta={() => router.push("/dashboard/prep")} />
      </PrepPageShell>
    );
  }

  if (!config) return null; // redirecting via the effect above

  // Keyed by mode, so switching a voice session to typed starts the screen afresh.
  return (
    <PrepLive
      key={config.mode ?? "text"}
      track={track}
      config={config}
      onEnd={handleEnd}
      onSaved={handleSaved}
      onExit={() => router.push(`/dashboard/prep/${trackId}`)}
      onSwitchToTyped={handleSwitchToTyped}
    />
  );
};

export default LiveClient;
