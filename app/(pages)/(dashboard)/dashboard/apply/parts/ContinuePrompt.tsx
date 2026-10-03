"use client";

// Starting a job that already has an unfinished application (owner,
// 2026-10-03): continue where it stopped, or start a new one. A finished one
// never asks — a second application for the same job just starts fresh.

import type { FC } from "react";
import TimeAgo from "timeago-react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import type { ApplySessionSummary } from "@/app/lib/apply/sessions";
import { APPLY_STEP_LABELS } from "@/app/lib/apply/state";

export interface ContinuePromptProps {
  existing: ApplySessionSummary | null;
  starting: boolean;
  onContinue: () => void;
  onStartNew: () => void;
  onCancel: () => void;
}

const ContinuePrompt: FC<ContinuePromptProps> = ({ existing, starting, onContinue, onStartNew, onCancel }) => (
  <Dialog open={existing !== null} onOpenChange={(open) => !open && !starting && onCancel()}>
    <DialogContent className="max-w-md gap-0 rounded-[20px] border-0 bg-white p-0">
      {existing && (
        <>
          <div className="px-6 pb-5 pt-6 pr-14">
            <DialogTitle className="text-[17px] font-bold leading-tight text-primary">You&apos;ve started this one before</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-black/60">
              {existing.role} at {existing.company}: you stopped at {APPLY_STEP_LABELS[existing.step]} (step {existing.step} of 5){" "}
              <TimeAgo datetime={existing.updatedAt} opts={{ minInterval: 60 }} />. Continue where you stopped?
            </DialogDescription>
            <p className="mt-2 text-xs text-black/45">Starting a new one sets the old one aside.</p>
          </div>
          <div className="flex items-center justify-end gap-2.5 border-t border-black/8 px-6 py-4">
            <StickerButton variant="outline" size="md" disabled={starting} onClick={onStartNew}>
              {starting && <Loader2 className="h-4 w-4 animate-spin" />}
              No, start a new one
            </StickerButton>
            <StickerButton variant="primary" size="md" disabled={starting} onClick={onContinue}>
              Yes, continue
            </StickerButton>
          </div>
        </>
      )}
    </DialogContent>
  </Dialog>
);

export default ContinuePrompt;
