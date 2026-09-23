"use client";

// Solo mode — the whole screen when you are in no pod.
//
// Not `DashEmptyState`: this state has three genuinely different ways out, and
// that shared component carries one CTA. Matching is still the one we want
// taken, so it keeps the sticker button. Starting a pod is a real choice rather
// than a fallback, so it sits beside it as an outline button; an invite
// is something you were handed rather than something you go looking for, so it
// stays the quiet line at the bottom.
//
// It fills the page rather than a panel, because there is no pod screen behind
// it to sit inside.

import { FC } from "react";
import EmptyStateLottie from "@/app/components/dashboard/ui/EmptyStateLottie";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";

const LOTTIE = "/Lottie/neobrutalism/Video_Online_Meetings_lottie.json";

export interface PodEmptyStateProps {
  /** Seats a new pod would fill besides yours — quoted so the promise is concrete. */
  capacity: number;
  onMatch: () => void;
  onCreate: () => void;
  onJoinWithCode: () => void;
  /** Matching is a write; the button has to stop being pressable while it runs. */
  matching?: boolean;
}

const PodEmptyState: FC<PodEmptyStateProps> = ({ capacity, onMatch, onCreate, onJoinWithCode, matching }) => (
  <DashCard className="mx-auto mt-12 max-w-md px-10 pb-10 pt-4 text-center" data-pod-empty>
    <EmptyStateLottie src={LOTTIE} size={180} />
    <p className="text-lg font-bold text-primary">You&apos;re in solo mode</p>
    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-black/50">
      Pods apply 2.4× more consistently. We&apos;ll match you with up to {Math.max(1, capacity - 1)} others at your level, in
      your timezone.
    </p>
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
      <StickerButton variant="primary" size="md" onClick={onMatch} disabled={matching}>
        {matching ? "Finding your pod…" : "Match me with a pod"}
      </StickerButton>
      <StickerButton variant="outline" size="md" onClick={onCreate} disabled={matching}>
        Start my own pod
      </StickerButton>
    </div>
    <p className="mt-4 text-xs text-black/50">
      Got an invite from someone?{" "}
      <button
        type="button"
        onClick={onJoinWithCode}
        className="cursor-pointer font-bold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
        Join with a code or link
      </button>
    </p>
  </DashCard>
);

export default PodEmptyState;
