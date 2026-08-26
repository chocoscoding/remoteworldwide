"use client";

import { FC } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { usePrep } from "../../PrepProvider";
import PrepSetup, { type SessionConfig } from "../../_components/PrepSetup";
import PrepPageShell from "../../_components/PrepPageShell";
import PrepEmptyState from "../../_components/PrepEmptyState";
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

  function handleStart(config: SessionConfig) {
    router.push(`/dashboard/prep/${trackId}/live?format=${config.formats.join(",")}&difficulty=${config.difficulty}&length=${config.lengthMinutes}`);
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
