"use client";

import { FC } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrep } from "../../PrepProvider";
import PrepSetup, { type SessionConfig } from "@/app/components/dashboard/prep/PrepSetup";
import PrepPageShell from "@/app/components/dashboard/prep/PrepPageShell";
import { TrackLoadError, TrackLoading, TrackNotFound } from "@/app/components/dashboard/prep/PrepTrackStates";
import { FORMAT_META, type SessionFormat } from "@/app/lib/dashboard/prep-data";

export interface SetupClientProps {
  trackId: string;
}

/** `?format=behavioural,salary` -> the valid subset, or undefined. */
function parseFormats(raw: string | null): SessionFormat[] | undefined {
  if (!raw) return undefined;
  const picked = raw.split(",").filter((f): f is SessionFormat => f in FORMAT_META);
  return picked.length ? picked : undefined;
}

const SetupClient: FC<SetupClientProps> = ({ trackId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getTrack, status, error, retry } = usePrep();
  const track = getTrack(trackId);
  const initialFormats = parseFormats(searchParams.get("format"));

  function handleStart(config: SessionConfig) {
    const params = new URLSearchParams({ format: config.formats.join(","), difficulty: config.difficulty, length: String(config.lengthMinutes) });
    if (config.capMinutes) params.set("cap", String(config.capMinutes));
    // URLSearchParams would write the format list's commas as %2C; the live page reads either.
    router.push(`/dashboard/prep/${trackId}/live?${params.toString().replace(/%2C/g, ",")}`);
  }

  if (!track) {
    if (status === "loading") return <TrackLoading />;
    if (status === "error") return <TrackLoadError error={error} onRetry={retry} />;
    return <TrackNotFound onBack={() => router.push("/dashboard/prep")} />;
  }

  return (
    <PrepPageShell>
      <PrepSetup
        track={track}
        initialFormats={initialFormats}
        onBack={() => router.push(`/dashboard/prep/${trackId}`)}
        onOpenQuestions={() => router.push(`/dashboard/prep/${trackId}?tab=questions`)}
        onStart={handleStart}
      />
    </PrepPageShell>
  );
};

export default SetupClient;
