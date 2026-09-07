"use client";

// One owed follow-up, with the message already written.
//
// The whole point is that the user does not have to compose anything. A nudge
// that says "you should follow up with Linear" adds a task; a nudge that hands
// over the finished text removes one. So the draft is visible by default, not
// behind a "generate" button.
//
// "Mark sent" records the real `follow-up` action, which is a qualifying
// action worth 0.5 intensity — so clearing a nudge feeds the streak exactly
// like any other real piece of work, with no new reward plumbing.

import { useState, type FC } from "react";
import { toast } from "sonner";
import { Check, Copy, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useSettings } from "@/app/(pages)/(dashboard)/dashboard/settings/SettingsProvider";
import { useTracker } from "@/app/components/dashboard/tracker/TrackerProvider";
import { FOLLOW_UP_REASON, draftFollowUp, type FollowUpDue } from "@/app/lib/dashboard/follow-up";

export interface FollowUpNudgeProps {
  due: FollowUpDue;
  /** Compact form for the Home list; the dialog uses the roomier one. */
  dense?: boolean;
}

const FollowUpNudge: FC<FollowUpNudgeProps> = ({ due, dense = false }) => {
  const { recordAction } = useActivity();
  const { touchCard } = useTracker();
  const { profile } = useSettings();
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const firstName = profile.fullName.trim().split(/\s+/)[0] || "me";
  const draft = draftFollowUp(due, firstName);

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
    <div data-followup={due.cardId} className={cn("rounded-xl border border-black/12 bg-white", dense ? "p-3" : "p-3.5")}>
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

      {/* The draft, plainly visible. whitespace-pre-line because the message
          carries its own paragraph breaks and a sign-off. */}
      <p
        className={cn(
          "mt-2 whitespace-pre-line rounded-lg bg-[#fbfbf7] px-3 py-2.5 text-[11px] leading-relaxed text-black/70",
          dense && "line-clamp-4",
        )}>
        {draft}
      </p>

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
    </div>
  );
};

export default FollowUpNudge;
