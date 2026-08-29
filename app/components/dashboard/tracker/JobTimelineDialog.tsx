"use client";

import { FC, useState } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, Check, MessageSquare, Mic, PartyPopper, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import LogoMini from "@/app/components/svg/LogoMini";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import type { TrackerCard, TrackerColumnId } from "@/app/lib/dashboard/types";
import StatusMenu from "./StatusMenu";
import { COLUMN_LABELS, STATUS_ORDER } from "./tracker-meta";

/**
 * Click any job, in any view, and this is where it opens: everything that has
 * happened with this application, where it is now, and the one thing worth
 * doing next.
 *
 * The timeline is DERIVED — the mock cards carry no stored history, only
 * `daysAgo` and a free-text status chip, so every step here is honestly
 * reconstructed from those fields. A real events table replaces
 * `buildTimeline` and nothing else.
 */
export interface JobTimelineDialogProps {
  card: TrackerCard | null;
  columnId: TrackerColumnId | null;
  onOpenChange: (open: boolean) => void;
  onMove: (cardId: string, to: TrackerColumnId) => void;
}

interface TimelineStep {
  id: string;
  label: string;
  sub?: string;
  state: "done" | "now" | "next";
}

function buildTimeline(card: TrackerCard, columnId: TrackerColumnId): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const days = card.daysAgo;
  const agoLabel = days === undefined ? undefined : days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`;
  const chip = card.statusChip ?? "";
  const [chipLabel, chipTime] = chip.split(" · ");

  // What has happened.
  if (columnId === "saved") {
    steps.push({ id: "saved", label: `Saved${agoLabel ? ` ${agoLabel}` : ""}`, state: "done" });
  } else {
    steps.push({ id: "applied", label: `Applied${agoLabel ? ` ${agoLabel}` : ""}`, state: "done" });
    if (chip.includes("Recruiter opened")) {
      steps.push({ id: "opened", label: "Recruiter opened your resume", sub: chipTime, state: "done" });
    }
    if (chip === "Referral available") {
      steps.push({ id: "referral", label: "A referral path opened up", sub: "Someone in your network can vouch here", state: "done" });
    }
  }

  // Where it is now — the chip's schedule/deadline reads as this stage's detail.
  const nowSub = chip.startsWith("Closes in")
    ? `Listing ${chip.charAt(0).toLowerCase()}${chip.slice(1)}`
    : /Round|Final round/.test(chipLabel)
      ? [chipLabel, chipTime].filter(Boolean).join(" · ")
      : chip === "Follow up"
        ? "A follow-up is due"
        : undefined;
  steps.push({ id: `now-${columnId}`, label: `In ${COLUMN_LABELS[columnId]}`, sub: nowSub, state: "now" });

  // What's ahead.
  const currentIdx = STATUS_ORDER.indexOf(columnId);
  for (const next of STATUS_ORDER.slice(currentIdx + 1)) {
    steps.push({ id: `next-${next}`, label: COLUMN_LABELS[next], state: "next" });
  }
  return steps;
}

/** The one suggested action per stage — every branch is a real, wired step. */
const NextStep: FC<{ card: TrackerCard; columnId: TrackerColumnId; onMove: JobTimelineDialogProps["onMove"] }> = ({
  card,
  columnId,
  onMove,
}) => {
  const { recordAction } = useActivity();
  // Lives and dies with the dialog (keyed by card) — no reset effect needed.
  const [followedUp, setFollowedUp] = useState(false);

  switch (columnId) {
    case "saved":
      return (
        <StickerButton variant="primary" size="sm" onClick={() => onMove(card.id, "applied")}>
          <ArrowRight className="h-3.5 w-3.5" />
          Move to Applied
        </StickerButton>
      );
    case "applied":
      return (
        <StickerButton
          variant="primary"
          size="sm"
          disabled={followedUp}
          onClick={() => {
            recordAction("follow-up", card.id, `Followed up with ${card.company}`);
            setFollowedUp(true);
          }}>
          {followedUp ? <Check className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
          {followedUp ? "Follow-up logged" : "Log a follow-up"}
        </StickerButton>
      );
    case "conversation":
      return (
        <Link href="/dashboard/referrals">
          <StickerButton variant="primary" size="sm" type="button">
            <Users className="h-3.5 w-3.5" />
            Find your referral
          </StickerButton>
        </Link>
      );
    case "interviewing":
      return (
        <Link href="/dashboard/prep">
          <StickerButton variant="primary" size="sm" type="button">
            <Mic className="h-3.5 w-3.5" />
            Prep for this
          </StickerButton>
        </Link>
      );
    case "offer":
      return (
        <Link href="/dashboard/landed">
          <StickerButton variant="primary" size="sm" type="button">
            <PartyPopper className="h-3.5 w-3.5" />
            Start your first 90 days
          </StickerButton>
        </Link>
      );
  }
};

const NEXT_STEP_HINT: Record<TrackerColumnId, string> = {
  saved: "It's ready when you are — applying moves it along.",
  applied: "A week of silence is normal. A short nudge isn't pushy.",
  conversation: "A warm voice inside the company moves this faster than waiting.",
  interviewing: "A practice round before the real one is the highest-leverage hour here.",
  offer: "Congratulations — the checklist takes it from here.",
};

const JobTimelineDialog: FC<JobTimelineDialogProps> = ({ card, columnId, onOpenChange, onMove }) => {
  const open = !!card && !!columnId;
  const steps = open ? buildTimeline(card, columnId) : [];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {open && (
            <>
              <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={card.company} tone="dark" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <DialogPrimitive.Title className="truncate text-[15px] font-bold text-primary">
                        {card.title}
                      </DialogPrimitive.Title>
                      {card.rww && <LogoMini className="h-3.5 w-3.5 flex-none" />}
                    </div>
                    <DialogPrimitive.Description className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-black/55">
                      {card.company}
                    </DialogPrimitive.Description>
                    <div className="mt-2">
                      <StatusMenu value={columnId} onChange={(to) => onMove(card.id, to)} />
                    </div>
                  </div>
                </div>
                <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  <X className="h-3.5 w-3.5" strokeWidth={3} />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>

              {/* The timeline — done in ink, now in lime, ahead in grey. */}
              <div className="border-t border-black/10 px-6 py-5">
                <p className="mb-3.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55">The story so far</p>
                <div className="flex flex-col">
                  {steps.map((step, i) => {
                    const last = i === steps.length - 1;
                    return (
                      <div key={step.id} className="flex gap-3">
                        <div className="flex w-5 flex-none flex-col items-center">
                          <span
                            className={cn(
                              "grid h-5 w-5 flex-none place-content-center rounded-full border-[1.5px]",
                              step.state === "done" && "border-[#222325] bg-[#222325]",
                              step.state === "now" && "border-[#222325] bg-[#e1f073] ring-4 ring-secondary/25",
                              step.state === "next" && "border-black/20 bg-white"
                            )}>
                            {step.state === "done" && <Check className="h-3 w-3 text-[#e1f073]" strokeWidth={3} />}
                          </span>
                          {!last && (
                            <span
                              className={cn(
                                "min-h-[14px] w-px flex-1",
                                step.state === "next" || steps[i + 1]?.state === "next"
                                  ? "border-l border-dashed border-black/20"
                                  : "bg-[#222325]"
                              )}
                            />
                          )}
                        </div>
                        <div className={cn("min-w-0 pb-3.5", last && "pb-0")}>
                          <p
                            className={cn(
                              "text-sm leading-tight",
                              step.state === "now" ? "font-bold text-primary" : step.state === "done" ? "font-semibold text-primary" : "font-medium text-black/55"
                            )}>
                            {step.label}
                          </p>
                          {step.sub && <p className="mt-0.5 text-xs leading-relaxed text-black/55">{step.sub}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* One suggested action, matched to the stage. */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 bg-[#fbfbf7] px-6 py-4">
                <p className="min-w-0 flex-1 basis-[200px] text-xs leading-relaxed text-black/60">{NEXT_STEP_HINT[columnId]}</p>
                <NextStep key={card.id} card={card} columnId={columnId} onMove={onMove} />
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default JobTimelineDialog;
