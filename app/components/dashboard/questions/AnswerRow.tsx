"use client";

import { FC, useState } from "react";
import { ChevronDown, Copy, Pencil, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import type { PillProps } from "@/app/components/dashboard/ui/Pill";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import TokenTextarea from "@/app/components/dashboard/answers/TokenTextarea";
import { useAnswers } from "@/app/components/dashboard/answers/AnswersProvider";
import type { QaItem } from "@/app/lib/dashboard/types";
import AnswerText from "./AnswerText";

/** Quiet inline control — reserved weight goes to the row's real decisions. */
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/50 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary";

function kindPill(kind: QaItem["kind"]): { label: string; variant: NonNullable<PillProps["variant"]> } {
  switch (kind) {
    case "review":
      return { label: "Needs review", variant: "urgent" };
    case "ai":
      return { label: "AI answered", variant: "positive" };
    default:
      return { label: "Saved by you", variant: "neutral" };
  }
}

export interface AnswerRowProps {
  item: QaItem;
  open: boolean;
  onToggle: () => void;
}

/**
 * Edit state lives in a child that only mounts while the row is open, so
 * collapsing throws the draft away for free. The old screen kept `editingId`
 * alive across collapse, filter changes and pagination, and reopening a row
 * restored a stale draft the user thought they'd walked away from.
 */
const AnswerEditor: FC<{ item: QaItem; onDone: () => void }> = ({ item, onDone }) => {
  const { saveEdit } = useAnswers();
  const [draft, setDraft] = useState(item.a);

  return (
    <div>
      <TokenTextarea value={draft} onChange={setDraft} rows={4} aria-label={`Answer to: ${item.q}`} />
      <div className="mt-3 flex items-center gap-2.5">
        <StickerButton
          variant="primary"
          size="sm"
          disabled={!draft.trim()}
          onClick={() => {
            saveEdit(item.id, draft.trim());
            onDone();
          }}>
          Save answer
        </StickerButton>
        <button type="button" className={cn(GHOST_BTN, "hover:bg-[#fdeae6] hover:text-[#b23c26]")} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
};

const AnswerRow: FC<AnswerRowProps> = ({ item, open, onToggle }) => {
  const { resolveReview, removeAnswer, extension } = useAnswers();
  const [editing, setEditing] = useState(false);

  const pill = kindPill(item.kind);
  const skippedByExtension = item.cat === "demographics" && !extension.fillDemographics;

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(item.a);
      toast.success("Answer copied");
    } catch {
      toast.error("Couldn't reach the clipboard");
    }
  }

  return (
    <DashCard className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => {
          if (open) setEditing(false);
          onToggle();
        }}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#fafaf7]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary">{item.q}</p>
          {!open && <p className="mt-0.5 truncate text-xs text-black/45">{item.kind === "review" ? item.draft : item.a}</p>}
        </div>
        <div className="flex flex-none items-center gap-2">
          <Pill variant={pill.variant}>{pill.label}</Pill>
          {item.cat === "demographics" && <Pill variant="outline-dashed">Demographics</Pill>}
          <ChevronDown className={cn("h-4 w-4 flex-none text-black/35 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="border-t border-black/8 px-5 pb-5 pt-4">
          {item.kind === "review" ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-black/10 bg-[#fbfbf7] p-4">
                  <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40">Your saved answer</p>
                  <AnswerText text={item.a} />
                </div>
                <div className="rounded-xl border-[1.5px] border-dashed border-secondary2 bg-secondary/10 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40">
                    <Sparkles className="h-3 w-3 flex-none" />
                    New AI draft
                  </p>
                  <AnswerText text={item.draft ?? ""} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <StickerButton variant="primary" size="sm" onClick={() => resolveReview(item.id, "mine")}>
                  Use mine from now on
                </StickerButton>
                <StickerButton variant="outline" size="sm" onClick={() => resolveReview(item.id, "draft")}>
                  Keep ours
                </StickerButton>
                <span className="text-xs text-black/40">Either choice clears this from your review queue.</span>
              </div>
            </>
          ) : editing ? (
            <AnswerEditor item={item} onDone={() => setEditing(false)} />
          ) : (
            <div>
              <div className="rounded-xl border border-black/8 bg-[#fbfbf7] p-4">
                <AnswerText text={item.a} />
              </div>
              {skippedByExtension && (
                <p className="mt-2 text-xs text-black/40">
                  The extension leaves demographics blank — turn it on in extension settings if you&apos;d rather it filled these.
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-1">
                <button type="button" className={GHOST_BTN} onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button type="button" className={GHOST_BTN} onClick={copyAnswer}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                <button
                  type="button"
                  className={cn(GHOST_BTN, "hover:bg-[#fdeae6] hover:text-[#b23c26]")}
                  onClick={() => removeAnswer(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </DashCard>
  );
};

export default AnswerRow;
