"use client";

import { useState, useTransition, type FC } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { cancelCampaign, deleteCampaign, duplicateCampaign, pauseCampaign, pickCampaignWinner, resumeCampaign } from "@/libs/mail-admin";
import type { CampaignStatus } from "@/app/lib/mail/types";
import { BTN, BTN_DANGER, BTN_PRIMARY } from "@/app/components/mail/ui";

type Act = "pause" | "resume" | "cancel" | "duplicate" | "delete" | "a" | "b";

/** Pause, resume, cancel, pick the A/B winner, duplicate, delete (once finished). Cancel and delete ask once more. */
const CampaignActions: FC<{ id: string; status: CampaignStatus; ab: { subjectA: string; subjectB: string; winner: "a" | "b" | null } | null }> = ({ id, status, ab }) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [doing, setDoing] = useState<Act | null>(null);
  const [busy, start] = useTransition();

  const act = (what: Act) =>
    start(async () => {
      setDoing(what);
      setError(null);
      const res =
        what === "pause"
          ? await pauseCampaign(id)
          : what === "resume"
            ? await resumeCampaign(id)
            : what === "cancel"
              ? await cancelCampaign(id)
              : what === "duplicate"
                ? await duplicateCampaign(id)
                : what === "delete"
                  ? await deleteCampaign(id)
                  : await pickCampaignWinner(id, what);
      setDoing(null);
      setConfirmCancel(false);
      setConfirmDelete(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (what === "delete") router.push("/heroshima/outreach/campaigns");
      else if (what === "duplicate" && res.data?.id) router.push(`/heroshima/outreach/campaigns/${res.data.id}`);
      else router.refresh();
    });

  const spin = (what: Act) => (busy && doing === what ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null);
  const canPause = status === "scheduled" || status === "sending" || status === "testing";
  const canCancel = status === "scheduled" || status === "sending" || status === "testing" || status === "paused";
  const canPick = Boolean(ab) && !ab?.winner && (status === "testing" || status === "paused");
  // A finished campaign can go; one still going is cancelled first (a draft is deleted from its editor).
  const canDelete = status === "sent" || status === "canceled" || status === "failed";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canPick && ab ? (
          <>
            <span className="text-xs font-semibold text-gray-600">Send the rest:</span>
            <button type="button" disabled={busy} onClick={() => act("a")} className={BTN} title={ab.subjectA}>
              {spin("a")}A wins
            </button>
            <button type="button" disabled={busy} onClick={() => act("b")} className={BTN} title={ab.subjectB}>
              {spin("b")}B wins
            </button>
          </>
        ) : null}
        {canPause ? (
          <button type="button" disabled={busy} onClick={() => act("pause")} className={BTN}>
            {spin("pause")}Pause
          </button>
        ) : null}
        {status === "paused" ? (
          <button type="button" disabled={busy} onClick={() => act("resume")} className={BTN_PRIMARY}>
            {spin("resume")}Resume
          </button>
        ) : null}
        {canCancel ? (
          confirmCancel ? (
            <>
              <span className="text-xs text-gray-600">Nobody else gets it. This can&apos;t be undone.</span>
              <button type="button" disabled={busy} onClick={() => act("cancel")} className="inline-flex items-center gap-2 rounded-md bg-[#b23c26] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                {spin("cancel")}Yes, cancel
              </button>
              <button type="button" onClick={() => setConfirmCancel(false)} className="px-2 text-xs font-semibold text-gray-500">
                Keep it
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmCancel(true)} className={BTN_DANGER}>
              Cancel campaign
            </button>
          )
        ) : null}
        <button type="button" disabled={busy} onClick={() => act("duplicate")} className={BTN}>
          {spin("duplicate")}Duplicate
        </button>
        {canDelete ? (
          confirmDelete ? (
            <>
              <span className="text-xs text-gray-600">The mails it sent stay in people&apos;s history.</span>
              <button type="button" disabled={busy} onClick={() => act("delete")} className="inline-flex items-center gap-2 rounded-md bg-[#b23c26] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                {spin("delete")}Yes, delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="px-2 text-xs font-semibold text-gray-500">
                Keep it
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className={BTN_DANGER}>
              Delete
            </button>
          )
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[#b23c26]">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default CampaignActions;
