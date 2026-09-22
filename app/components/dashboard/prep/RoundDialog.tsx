"use client";

import { useState, type FC, type FormEvent } from "react";
import { format as formatDate } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { apiMessage } from "@/app/lib/api/core";
import { ROUND_OUTCOME_LABELS, ROUND_TYPE_LABELS } from "@/app/lib/prep/tracks";
import { PREP_ROUND_OUTCOMES, PREP_ROUND_TYPES, PREP_TRACK_LIMITS, type PrepRound, type PrepRoundOutcome, type PrepRoundType } from "@/app/lib/prep/types";
import { BUTTON_OUTLINE, BUTTON_SOLID, FIELD_SHELL } from "./prep-styles";

export interface RoundDraft {
  type: PrepRoundType;
  scheduledAt: string | null;
  outcome: PrepRoundOutcome | null;
  notes: string;
}

export interface RoundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The round being edited, or null to add one. */
  round: PrepRound | null;
  /** Where it sits in the loop, for the title: "Round 3". */
  position: number;
  /** Rejects with the server's refusal, which the dialog shows in place. */
  onSave: (draft: RoundDraft) => Promise<void>;
  onDelete?: () => Promise<void>;
}

/** An ISO timestamp as a `datetime-local` value, in the user's own time zone. */
const toLocalInput = (iso: string | null): string => (iso ? formatDate(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");

/** A `datetime-local` value (local time, no zone) as an ISO timestamp. */
const fromLocalInput = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const LABEL = "block text-[11px] font-bold uppercase tracking-[0.07em] text-black/45 mb-1.5";
const CONTROL = "w-full min-w-0 bg-transparent outline-none text-sm font-semibold text-primary";

/**
 * One round of the loop: what kind of conversation, when, how it went, and
 * notes to self. Keyed by the parent on the round it edits, so reopening it
 * always starts from what is saved.
 */
const RoundDialog: FC<RoundDialogProps> = ({ open, onOpenChange, round, position, onSave, onDelete }) => {
  const [type, setType] = useState<PrepRoundType>(round?.type ?? "recruiter-screen");
  const [when, setWhen] = useState(() => toLocalInput(round?.scheduledAt ?? null));
  const [outcome, setOutcome] = useState<PrepRoundOutcome | "">(round?.outcome ?? "");
  const [notes, setNotes] = useState(round?.notes ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "save" | "delete", work: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await work();
      onOpenChange(false);
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    void run("save", () => onSave({ type, scheduledAt: fromLocalInput(when), outcome: outcome || null, notes: notes.trim() }));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="bg-white rounded-[20px] border-2 border-[#222325] p-0 gap-0 max-w-[460px] overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="p-6 pb-5 flex flex-col gap-4">
            <div>
              <DialogTitle className="text-lg font-bold text-primary">{round ? `Round ${position}` : `Add round ${position}`}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-black/50">What kind of conversation it is, and when. Record how it went once you know.</DialogDescription>
            </div>

            <label className="block">
              <span className={LABEL}>Type</span>
              <span className={FIELD_SHELL}>
                <select value={type} onChange={(e) => setType(e.target.value as PrepRoundType)} className={cn(CONTROL, "cursor-pointer")}>
                  {PREP_ROUND_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {ROUND_TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="block">
              <span className={LABEL}>When</span>
              <span className={FIELD_SHELL}>
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={CONTROL} />
              </span>
              <span className="block text-[11px] text-black/40 mt-1">Leave empty if it isn&apos;t booked yet.</span>
            </label>

            <label className="block">
              <span className={LABEL}>How it went</span>
              <span className={FIELD_SHELL}>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value as PrepRoundOutcome | "")} className={cn(CONTROL, "cursor-pointer")}>
                  <option value="">Not recorded yet</option>
                  {PREP_ROUND_OUTCOMES.map((value) => (
                    <option key={value} value={value}>
                      {ROUND_OUTCOME_LABELS[value]}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="block">
              <span className={LABEL}>Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={PREP_TRACK_LIMITS.roundNotesMax}
                rows={3}
                placeholder="Who you're meeting, what they said to prepare, what to follow up on"
                className="w-full resize-none rounded-lg border border-black/15 bg-[#fbfbf7] px-3 py-2 text-sm text-primary outline-none transition-colors focus:border-[#222325] placeholder:text-black/35"
              />
            </label>

            {error && (
              <p role="alert" className="text-xs font-semibold text-red-700">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-black/8 px-6 py-4">
            {round && onDelete ? (
              <button
                type="button"
                onClick={() => void run("delete", onDelete)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-red-700 cursor-pointer disabled:opacity-50">
                {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Remove round
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => onOpenChange(false)} disabled={busy !== null} className={BUTTON_OUTLINE}>
                Cancel
              </button>
              <button type="submit" disabled={busy !== null} className={cn(BUTTON_SOLID, "disabled:opacity-50 disabled:pointer-events-none")}>
                {busy === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {round ? "Save round" : "Add round"}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RoundDialog;
