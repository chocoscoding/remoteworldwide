"use client";

import { FC, FormEvent, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import DashTooltip from "@/app/components/dashboard/ui/DashTooltip";
import TokenTextarea from "@/app/components/dashboard/answers/TokenTextarea";
import { useAnswers } from "@/app/components/dashboard/answers/AnswersProvider";
import type { QaItem } from "@/app/lib/dashboard/types";

export interface AddAnswerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LABEL = "mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40";
const FIELD =
  "w-full rounded-lg border border-black/15 bg-white px-3.5 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]";

const AddAnswerDialog: FC<AddAnswerDialogProps> = ({ open, onOpenChange }) => {
  const { addAnswer } = useAnswers();
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [cat, setCat] = useState<QaItem["cat"]>("screening");

  function reset() {
    setQ("");
    setA("");
    setCat("screening");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!q.trim() || !a.trim()) return;

    const result = addAnswer({ q, a, cat });
    if (result.added) {
      toast.success("Answer saved", { description: "Available to the extension on every future application." });
      reset();
      onOpenChange(false);
    } else {
      // Dedupe surfaces rather than silently creating a second entry that
      // would make the extension's pick ambiguous.
      toast("You've already answered that", { description: result.existing.q });
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <form onSubmit={submit} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogPrimitive.Title className="text-lg font-bold text-primary">Add an answer</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-black/50">
                  Saved here, it&apos;s available on every future application.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                <X className="h-3.5 w-3.5" strokeWidth={3} />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              <div>
                <label className={LABEL} htmlFor="new-q">
                  Question
                </label>
                <input
                  id="new-q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="e.g. What's your preferred start date?"
                  required
                  className={cn(FIELD, "h-10")}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="new-a">
                  Answer
                </label>
                <TokenTextarea id="new-a" value={a} onChange={setA} rows={4} required placeholder="Write the answer you want saved…" />
                <p className="mt-1.5 text-xs text-black/40">
                  Type <code className="rounded bg-[#859c03] px-1 font-mono text-[14px]">{"{company}"}</code> anywhere and it&apos;s swapped
                  for whoever you&apos;re applying to.
                </p>
              </div>
              <div>
                <div className={cn(LABEL, "flex items-center gap-1.5")}>
                  Category
                  <DashTooltip label="What these categories mean">
                    <span className="block text-xs font-semibold normal-case tracking-normal text-primary">Screening</span>
                    <span className="mt-0.5 block text-xs font-normal normal-case leading-relaxed tracking-normal text-black/55">
                      The role and logistics questions almost every employer asks — notice period, salary, work authorisation.
                    </span>
                    <span className="mt-2.5 block text-xs font-semibold normal-case tracking-normal text-primary">Demographics</span>
                    <span className="mt-0.5 block text-xs font-normal normal-case leading-relaxed tracking-normal text-black/55">
                      Optional diversity questions — gender, ethnicity, veteran status. Never required, and the extension leaves them blank
                      unless you turn that on.
                    </span>
                  </DashTooltip>
                </div>
                <div className="inline-flex items-center gap-0.5 rounded-lg bg-[#f0f0ea] p-1">
                  {(["screening", "demographics"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCat(c)}
                      aria-pressed={cat === c}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-bold capitalize transition-colors cursor-pointer",
                        cat === c ? "bg-[#222325] text-white" : "text-black/55 hover:text-primary",
                      )}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2.5">
              <StickerButton type="submit" variant="primary" size="md" disabled={!q.trim() || !a.trim()}>
                Save answer
              </StickerButton>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-black/50 transition-colors hover:bg-[#fdeae6] hover:text-[#b23c26]">
                Cancel
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default AddAnswerDialog;
