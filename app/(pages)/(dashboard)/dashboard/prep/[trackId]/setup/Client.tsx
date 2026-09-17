"use client";

import { FC } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { usePrep } from "../../PrepProvider";
import PrepSetup, { type SessionConfig } from "@/app/components/dashboard/prep/PrepSetup";
import PrepPageShell from "@/app/components/dashboard/prep/PrepPageShell";
import PrepEmptyState from "@/app/components/dashboard/prep/PrepEmptyState";
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
  const { getTrack } = usePrep();
  const track = getTrack(trackId);
  const initialFormats = parseFormats(searchParams.get("format"));

  // The recording consent is not in the URL: PrepSetup hands it to the live
  // page through sessionStorage (see RecordingConsent.tsx), so a shared or
  // bookmarked link can never start a recording on its own.
  function handleStart(config: SessionConfig) {
    const params = new URLSearchParams({ format: config.formats.join(","), difficulty: config.difficulty, length: String(config.lengthMinutes) });
    params.set("mode", config.mode ?? "text");
    if (config.mode === "voice" && config.capMinutes) params.set("cap", String(config.capMinutes));
    // URLSearchParams would write the format list's commas as %2C; the live page reads either.
    router.push(`/dashboard/prep/${trackId}/live?${params.toString().replace(/%2C/g, ",")}`);
  }

  if (!track) {
    return (
      <PrepPageShell>
        <PrepEmptyState icon={SearchX} title="Track not found" body="This one may have been part of a previous session — mock data resets on reload." ctaLabel="Back to all interviews" onCta={() => router.push("/dashboard/prep")} />
      </PrepPageShell>
    );
  }

  return (
    <PrepPageShell>
      <PrepSetup track={track} initialFormats={initialFormats} onBack={() => router.push(`/dashboard/prep/${trackId}`)} onStart={handleStart} />
    </PrepPageShell>
  );
};

export default SetupClient;
