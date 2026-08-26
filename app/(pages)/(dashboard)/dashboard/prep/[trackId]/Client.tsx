"use client";

import { FC, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchX } from "lucide-react";
import { usePrep } from "../PrepProvider";
import PrepHub from "../_components/PrepHub";
import PrepPageShell from "../_components/PrepPageShell";
import PrepEmptyState from "../_components/PrepEmptyState";
import type { SessionFormat } from "@/app/lib/dashboard/prep-data";

export interface HubClientProps {
  trackId: string;
}

const HubClient: FC<HubClientProps> = ({ trackId }) => {
  const router = useRouter();
  const { getTrack, toggleAction, researchPanelFor, setOutcome } = usePrep();
  const [now] = useState(() => new Date());

  const track = getTrack(trackId);

  function goToSetup(formats?: SessionFormat[]) {
    const q = formats?.length ? `?format=${formats.join(",")}` : "";
    router.push(`/dashboard/prep/${trackId}/setup${q}`);
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
      <PrepHub
        track={track}
        now={now}
        onBack={() => router.push("/dashboard/prep")}
        onStartSession={goToSetup}
        onViewReport={(sessionId) => router.push(`/dashboard/prep/${trackId}/sessions/${sessionId}`)}
        onToggleAction={(actionId) => toggleAction(trackId, actionId)}
        onResearchPanel={() => researchPanelFor(trackId)}
        onSetOutcome={(outcome) => setOutcome(trackId, outcome)}
      />
    </PrepPageShell>
  );
};

export default HubClient;
