"use client";

import { FC } from "react";
import { useRouter } from "next/navigation";
import { SearchX } from "lucide-react";
import { usePrep } from "../../../PrepProvider";
import PrepReport from "../../../_components/PrepReport";
import PrepPageShell from "../../../_components/PrepPageShell";
import PrepEmptyState from "../../../_components/PrepEmptyState";
import type { SessionFormat } from "@/app/lib/dashboard/prep-data";

export interface ReportClientProps {
  trackId: string;
  sessionId: string;
}

const ReportClient: FC<ReportClientProps> = ({ trackId, sessionId }) => {
  const router = useRouter();
  const { getTrack, toggleAction } = usePrep();
  const track = getTrack(trackId);
  const session = track?.sessions.find((s) => s.id === sessionId);

  function goToSetup(formats?: SessionFormat[]) {
    const q = formats?.length ? `?format=${formats.join(",")}` : "";
    router.push(`/dashboard/prep/${trackId}/setup${q}`);
  }

  if (!track || !session) {
    return (
      <PrepPageShell>
        <PrepEmptyState
          icon={SearchX}
          title="Report not found"
          body="Session reports are in-memory and don't survive a reload — run a fresh session to get a new one."
          ctaLabel={track ? "Back to track" : "Back to all interviews"}
          onCta={() => router.push(track ? `/dashboard/prep/${trackId}` : "/dashboard/prep")}
        />
      </PrepPageShell>
    );
  }

  return (
    <PrepPageShell>
      <PrepReport
        track={track}
        session={session}
        onBack={() => router.push(`/dashboard/prep/${trackId}`)}
        onRunAnother={() => goToSetup(session.formats)}
        onToggleAction={(actionId) => toggleAction(trackId, actionId)}
      />
    </PrepPageShell>
  );
};

export default ReportClient;
