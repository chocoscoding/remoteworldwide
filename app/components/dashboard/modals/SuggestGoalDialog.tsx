"use client";

// "Suggest a goal" flow, opened from the Pod screen's "Pod goals" card. Built
// on the same Radix dialog primitive (`components/ui/dialog.tsx`) and the
// same header/field/footer shape as `NewResumeDialog` — a plain form that
// hands its values up via `onSuggest`; the parent owns what happens next
// (append a `voting-add` PodGoal and close the dialog).

import { useState, type FC, type FormEvent } from "react";
import { Target } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";

export interface SuggestedGoalInput {
  label: string;
  target: number;
  unit: string;
}

export interface SuggestGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuggest: (input: SuggestedGoalInput) => void;
}

const FIELD_CLASS =
  "rounded-xl border border-black/12 bg-[#fbfbf7] px-4 py-3 text-sm text-primary placeholder:text-black/35 outline-none focus:border-black/30 transition-colors";

const SuggestGoalDialog: FC<SuggestGoalDialogProps> = ({ open, onOpenChange, onSuggest }) => {
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");

  const targetNum = Number(target);
  const canSubmit = label.trim().length > 0 && unit.trim().length > 0 && Number.isFinite(targetNum) && targetNum > 0;

  const resetFields = () => {
    setLabel("");
    setTarget("");
    setUnit("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSuggest({ label: label.trim(), target: Math.round(targetNum), unit: unit.trim() });
    resetFields();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetFields();
      }}>
      <DialogContent className="bg-white rounded-[20px] border-0 p-0 max-w-md gap-0">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 flex-none rounded-full bg-[#f0f0ea] flex items-center justify-center">
                <Target className="h-[18px] w-[18px] text-primary" />
              </div>
              <DialogTitle className="text-[17px] font-bold text-primary leading-none">Suggest a goal</DialogTitle>
            </div>
            <p className="text-xs text-black/45 mb-5 pl-[52px]">Goes to a pod vote — majority wins.</p>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-black/50">Goal</span>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. 5 mock interviews this week"
                  className={FIELD_CLASS}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-black/50">Target</span>
                  <input
                    type="number"
                    min={1}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="5"
                    className={FIELD_CLASS}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-black/50">Unit</span>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="interviews this week"
                    className={FIELD_CLASS}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-black/8 px-6 py-4">
            <StickerButton type="button" variant="outline" size="md" onClick={() => onOpenChange(false)}>
              Cancel
            </StickerButton>
            <StickerButton type="submit" variant="primary" size="md" disabled={!canSubmit}>
              <Target className="h-4 w-4" />
              Put it to a vote
            </StickerButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SuggestGoalDialog;
