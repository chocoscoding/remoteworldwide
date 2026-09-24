"use client";

import { FC, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrep } from "../PrepProvider";
import PrepHub, { PREP_HUB_TABS, type PrepHubTab } from "@/app/components/dashboard/prep/PrepHub";
import PrepPageShell from "@/app/components/dashboard/prep/PrepPageShell";
import { TrackLoadError, TrackLoading, TrackNotFound } from "@/app/components/dashboard/prep/PrepTrackStates";
import type { SessionFormat } from "@/app/lib/dashboard/prep-data";

export interface HubClientProps {
  trackId: string;
}

/** `?tab=questions` -> that tab, so a link can land on it; anything else opens the Overview. */
function parseTab(raw: string | null): PrepHubTab | undefined {
  return PREP_HUB_TABS.find((tab) => tab === raw);
}

const HubClient: FC<HubClientProps> = ({ trackId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getTrack, status, error, retry, toggleAction, addAction, saveRounds, setRoundOutcome, updateTrack, deleteTrack } = usePrep();
  const [now] = useState(() => new Date());

  const track = getTrack(trackId);

  function goToSetup(formats?: SessionFormat[]) {
    const q = formats?.length ? `?format=${formats.join(",")}` : "";
    router.push(`/dashboard/prep/${trackId}/setup${q}`);
  }

  if (!track) {
    if (status === "loading") return <TrackLoading />;
    if (status === "error") return <TrackLoadError error={error} onRetry={retry} />;
    return <TrackNotFound onBack={() => router.push("/dashboard/prep")} />;
  }

  return (
    <PrepPageShell>
      <PrepHub
        track={track}
        now={now}
        initialTab={parseTab(searchParams.get("tab"))}
        onBack={() => router.push("/dashboard/prep")}
        onStartSession={goToSetup}
        onViewReport={(sessionId) => router.push(`/dashboard/prep/${trackId}/sessions/${sessionId}`)}
        onToggleAction={(actionId) => toggleAction(trackId, actionId)}
        onAddAction={(title) => addAction(trackId, title)}
        onSetOutcome={(roundId, outcome) => setRoundOutcome(trackId, roundId, outcome)}
        onSaveRounds={(rounds, changed) => saveRounds(trackId, rounds, changed)}
        onUpdateTrack={(input) => updateTrack(trackId, input)}
        onDeleteTrack={async () => {
          await deleteTrack(trackId);
          router.replace("/dashboard/prep");
        }}
      />
    </PrepPageShell>
  );
};

export default HubClient;
