"use client";

// One owed follow-up, inside the application it is about.
//
// The message is written for the user, but it is not written *at* them: the
// panel opens with the reason and one button, and the draft appears when they
// ask for it. Handing over finished text unprompted reads as the app having
// already decided what to say.
//
// `draftFollowUp` is deterministic and instant. The wait is deliberate: it is
// the seam a real generator's round trip goes into, so the button already
// behaves the way it will when there is a model behind it.
//
// "Mark sent" records the real `follow-up` action, which is a qualifying
// action worth 0.5 intensity — so clearing a nudge feeds the streak exactly
// like any other real piece of work, with no new reward plumbing.

import { useEffect, useRef, useState, type FC } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useSettings } from "@/app/(pages)/(dashboard)/dashboard/settings/SettingsProvider";
import { useTracker } from "@/app/components/dashboard/tracker/TrackerProvider";
import { FOLLOW_UP_REASON, draftFollowUp, type FollowUpDue } from "@/app/lib/dashboard/follow-up";

export interface FollowUpNudgeProps {
  due: FollowUpDue;
}

/** Long enough to read as work being done, short enough not to be a wait. */
const WRITING_MS = 900;

const FollowUpNudge: FC<FollowUpNudgeProps> = ({ due }) => {
  const { recordAction } = useActivity();
  const { touchCard } = useTracker();
  const { profile } = useSettings();
  const [phase, setPhase] = useState<"idle" | "writing" | "ready">("idle");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  // The dialog unmounts the moment the card moves; a pending timer must not
  // outlive it.
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const firstName = profile.fullName.trim().split(/\s+/)[0] || "me";
  const draft = draftFollowUp(due, firstName);

  function generate() {
    setPhase("writing");
    timer.current = window.setTimeout(() => setPhase("ready"), WRITING_MS);
  }

  function copy() {
    void navigator.clipboard?.writeText(draft);
    setCopied(true);
    toast.success("Copied", { description: `Your note to ${due.company} is on the clipboard.` });
  }

  function markSent() {
    recordAction("follow-up", due.cardId, `Followed up with ${due.company}`);
    // Restarts the silence clock, which is what actually clears this nudge.
    touchCard(due.cardId);
    setSent(true);
  }

  return (
    <div data-followup={due.cardId} className="rounded-xl border border-black/12 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-primary">{due.company}</p>
          <p className="truncate text-xs text-black/55">{due.role}</p>
        </div>
        <span className="flex-none rounded-full bg-[#f0f0ea] px-2 py-0.5 text-[11px] font-bold text-black/55">
          silent {due.daysSilent}d
        </span>
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-black/45">{FOLLOW_UP_REASON[due.kind]}</p>

      {phase !== "ready" ? (
        <button
          type="button"
          onClick={generate}
          disabled={phase === "writing"}
          data-generate-followup=""
          className={cn(
            "mt-2.5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors",
            phase === "writing" ? "cursor-default bg-[#f0f0ea] text-black/50" : "cursor-pointer bg-primary text-white hover:bg-black",
          )}>
          {phase === "writing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {phase === "writing" ? "Writing your note…" : "Generate follow-up message"}
        </button>
      ) : (
        <>
          {/* whitespace-pre-line because the message carries its own paragraph
              breaks and a sign-off. */}
          <p className="mt-2 whitespace-pre-line rounded-lg bg-[#fbfbf7] px-3 py-2.5 text-[11px] leading-relaxed text-black/70">{draft}</p>

          <div className="mt-2.5 flex items-center gap-3">
            <button
              type="button"
              onClick={markSent}
              disabled={sent}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors",
                sent ? "cursor-default bg-[#f0f0ea] text-[#6c7a1e]" : "cursor-pointer bg-primary text-white hover:bg-black",
              )}>
              {sent ? <Check className="h-3 w-3" /> : <Send className="h-3 w-3" />}
              {sent ? "Logged" : "Mark sent"}
            </button>
            <button
              type="button"
              onClick={copy}
              className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-black/55 transition-colors hover:text-primary">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FollowUpNudge;
