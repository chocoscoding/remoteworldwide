"use client";

import type { FC } from "react";
import { CloudOff, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiMessage } from "@/app/lib/api/core";
import PrepEmptyState from "./PrepEmptyState";
import PrepPageShell from "./PrepPageShell";
import { PANEL } from "./prep-styles";

/**
 * The three states every track page shares before it has a track to show:
 * the first read still on its way, the read failed, or the id names no track
 * of this user's. One place, so the hub, setup and live pages say the same
 * thing about the same situation.
 */

export const TrackLoading: FC<{ bare?: boolean }> = ({ bare }) => {
  const body = (
    <div className="flex flex-col gap-5" aria-busy="true">
      <p className="sr-only" role="status">
        Loading your interview prep
      </p>
      <div className={cn(PANEL, "h-[104px] animate-pulse")} />
      <div className={cn(PANEL, "h-[260px] animate-pulse")} />
    </div>
  );
  return bare ? body : <PrepPageShell>{body}</PrepPageShell>;
};

export const TrackLoadError: FC<{ error: unknown; onRetry: () => void; bare?: boolean }> = ({ error, onRetry, bare }) => {
  const body = <PrepEmptyState icon={CloudOff} title="Your prep couldn't load" body={`${apiMessage(error)} Nothing is lost — try again in a moment.`} ctaLabel="Try again" onCta={onRetry} />;
  return bare ? body : <PrepPageShell>{body}</PrepPageShell>;
};

export const TrackNotFound: FC<{ onBack: () => void }> = ({ onBack }) => (
  <PrepPageShell>
    <PrepEmptyState
      icon={SearchX}
      title="Track not found"
      body="It may have been deleted, or it belongs to another account."
      ctaLabel="Back to all interviews"
      onCta={onBack}
    />
  </PrepPageShell>
);
