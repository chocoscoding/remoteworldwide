"use client";

// The "+ New resume" flow: name the resume, choose blank vs. duplicate the
// current document's content. Built on the same Radix dialog primitive
// DownloadModal already uses, rather than a bespoke overlay.
//
// Either choice starts from `DEFAULT_DESIGN`/`DEFAULT_SECTIONS` — a fresh
// document never inherits the outgoing document's customization, only
// (optionally) its content. That keeps "every new document starts at the
// real FlowCV default look" true regardless of how it was created.

import { useState, type FC } from "react";
import { FilePlus2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";

export type NewResumeMode = "blank" | "duplicate";

export interface NewResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Label of the document this dialog would duplicate from, shown in the "Duplicate" option's helper text. */
  currentDocLabel: string;
  onCreate: (label: string, mode: NewResumeMode) => void;
}

const NewResumeDialog: FC<NewResumeDialogProps> = ({ open, onOpenChange, currentDocLabel, onCreate }) => {
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<NewResumeMode>("blank");

  const handleCreate = () => {
    onCreate(label, mode);
    setLabel("");
    setMode("blank");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setLabel("");
          setMode("blank");
        }
      }}>
      <DialogContent className="bg-white rounded-[20px] border-0 p-0 max-w-md gap-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 flex-none rounded-full bg-[#f0f0ea] flex items-center justify-center">
              <FilePlus2 className="h-[18px] w-[18px] text-primary" />
            </div>
            <DialogTitle className="text-[17px] font-bold text-primary leading-none">New resume</DialogTitle>
          </div>
          <p className="text-xs text-black/45 mb-5 pl-[52px]">Give it a name and choose how to start.</p>

          <label className="flex flex-col gap-1.5 mb-4">
            <span className="text-xs font-semibold text-black/50">Name</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Stripe — Senior Designer"
              className="rounded-xl border border-black/12 bg-[#fbfbf7] px-4 py-3 text-sm text-primary placeholder:text-black/35 outline-none focus:border-black/30 transition-colors"
            />
          </label>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setMode("blank")}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer",
                mode === "blank" ? "border-primary ring-1 ring-primary" : "border-black/10 hover:border-black/25"
              )}>
              <p className="text-sm font-bold text-primary">Start blank</p>
              <p className="text-xs text-black/45 mt-0.5">An empty resume with the default look.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("duplicate")}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer",
                mode === "duplicate" ? "border-primary ring-1 ring-primary" : "border-black/10 hover:border-black/25"
              )}>
              <p className="text-sm font-bold text-primary">Duplicate &quot;{currentDocLabel}&quot;</p>
              <p className="text-xs text-black/45 mt-0.5">Copies its content — starts with the default design, not its customization.</p>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-black/8 px-6 py-4">
          <StickerButton type="button" variant="outline" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </StickerButton>
          <StickerButton type="button" variant="primary" size="md" onClick={handleCreate}>
            <FilePlus2 className="h-4 w-4" />
            Create
          </StickerButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewResumeDialog;
