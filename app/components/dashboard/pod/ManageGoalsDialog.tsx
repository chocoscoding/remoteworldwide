"use client";

import { FC, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, CircleHelp, Lock, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePod } from "./PodProvider";
import { useLivePod } from "./LivePodProvider";
import PodAvatar from "./PodAvatar";
import { GOAL_KIND_META } from "./pod-goal-meta";
import { isPendingGoal, isStandingGoal, myVote, tally } from "@/app/lib/pod/goalVotes";
import type { PodGoal } from "@/app/lib/dashboard/types";

/**
 * The pod's goals, laid out after the owner's 2026-10-13 mockup ("Goals panel"): what is up for a
 * vote first, each on a lime card with its two choices and a dot per member who has voted; then the
 * goals the pod is working on, as hairline rows. How voting works sits behind the "?" rather than
 * above every card. Every click shows at once (the goal writes are optimistic).
 */
export interface ManageGoalsDialogProps {
  onClose: () => void;
  /** Opens the "Suggest a goal" form (a sibling dialog owned by the page). */
  onSuggest: () => void;
  /** The goal a "goal under review" notification pointed at: scrolled to and briefly ringed. */
  focusGoalId?: string | null;
}

/** How long the linked goal stays ringed after the dialog opens on it. */
const FOCUS_RING_MS = 2400;

const SECTION_LABEL = "px-[18px] text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f6062]";

/**
 * The two choices on a vote, each a toggle: pressing the one you hold takes your vote back, and
 * pressing the other switches it. "Add it / Skip" for a new goal, "Keep / Remove" for one under
 * review. A suggestion still waiting for its server id can't be voted on yet.
 */
const VoteButtons: FC<{ goal: PodGoal; onVote: (choice: "for" | "against" | null) => void }> = ({ goal, onVote }) => {
  const mine = myVote(goal);
  const { up, down } = tally(goal);
  const pending = isPendingGoal(goal);
  const adding = goal.status === "voting-add";

  const base =
    "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold tabular-nums transition-colors disabled:cursor-default disabled:opacity-50";

  return (
    <>
      <button
        type="button"
        aria-label={`${adding ? "Add it" : "Keep it"}, ${up} so far`}
        title={mine === "for" ? "Take your vote back" : undefined}
        aria-pressed={mine === "for"}
        disabled={pending}
        onClick={() => onVote(mine === "for" ? null : "for")}
        className={cn(base, mine === "for" ? "border-[1.5px] border-[#222325] bg-[#222325] text-[#e1f073]" : "bg-[#e1f073] br-shadow-press")}>
        <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.4} />
        {adding ? "Add it" : "Keep"} · {up}
      </button>
      <button
        type="button"
        aria-label={`${adding ? "Skip" : "Remove"}, ${down} so far`}
        title={mine === "against" ? "Take your vote back" : undefined}
        aria-pressed={mine === "against"}
        disabled={pending}
        onClick={() => onVote(mine === "against" ? null : "against")}
        className={cn(
          base,
          "border border-[#222325]",
          // Chosen, it only turns its text red (owner, 2026-10-13); the white stays.
          mine === "against" ? "bg-white text-[#b23c26] hover:bg-[#fdf3f1]" : "bg-white text-[#222325] hover:bg-[#f0f0ea]",
        )}>
        <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.4} />
        {adding ? "Skip" : "Remove"} · {down}
      </button>
    </>
  );
};

/** One dot per member: filled for each vote cast. */
const VoteDots: FC<{ cast: number; of: number }> = ({ cast, of }) => (
  <div role="img" aria-label={`${cast} of ${of} voted`} className="ml-auto flex gap-[3px]">
    {Array.from({ length: of }, (_, i) => (
      <span
        key={i}
        className={cn("h-2.5 w-2.5 rounded-full", i < cast ? "bg-[#222325]" : "border-[1.5px] border-[#222325]/40")}
      />
    ))}
  </div>
);

const ManageGoalsDialog: FC<ManageGoalsDialogProps> = ({ onClose, onSuggest, focusGoalId = null }) => {
  const { goals, castVote, suggestRemoval, voteMajority, memberCount } = usePod();
  // A proposer's photo, by the name the server gave them on the goal, which is the name their member
  // row carries too ("You" for you). Someone who has left, or hides their profile, keeps initials.
  const { members } = useLivePod();
  const photoOf = (name: string) => members.find((member) => member.name === name)?.image ?? null;
  // Read once on mount — feeds the 7-day voting-window math without calling
  // the impure Date.now() from render.
  const [now] = useState(() => Date.now());
  const [howOpen, setHowOpen] = useState(false);

  // The linked goal is ringed for a moment, then settles like the rest. The dialog is keyed by the
  // link, so a second notification remounts it and rings its own goal.
  const [ringed, setRinged] = useState(focusGoalId);
  useEffect(() => {
    if (!focusGoalId) return;
    const timer = window.setTimeout(() => setRinged(null), FOCUS_RING_MS);
    return () => window.clearTimeout(timer);
  }, [focusGoalId]);

  // Scrolled to once, when its card first mounts; later re-renders (a vote) leave the scroll alone.
  const scrolled = useRef(false);
  const focusRef = (el: HTMLDivElement | null) => {
    if (!el || scrolled.current) return;
    scrolled.current = true;
    el.scrollIntoView({ block: "center" });
  };

  const withMeta = goals.map((g) => ({
    ...g,
    // Clamped both ways: a proposal created while this dialog is open has a
    // proposedAt NEWER than the mount-time `now`, and floor(negative) would
    // read as "closes in 8d".
    daysLeft: g.proposedAt ? Math.min(7, Math.max(0, 7 - Math.floor((now - new Date(g.proposedAt).getTime()) / 86_400_000))) : 0,
  }));
  // A goal under review stays among the pod's goals, counting, until its review carries (owner,
  // 2026-10-13); it is voted on above with the new ones.
  const activeGoals = withMeta.filter(isStandingGoal);
  const votingGoals = withMeta.filter((g) => g.status !== "active" && g.daysLeft > 0);
  // The link outlived its vote: the pod voted the goal out, or a suggestion ran out of time.
  const linkClosed = focusGoalId !== null && !withMeta.some((g) => g.id === focusGoalId);

  const cardProps = (goalId: string) => (goalId === focusGoalId ? { ref: focusRef, "data-goal-id": goalId } : { "data-goal-id": goalId });
  const ring = (goalId: string) => ringed === goalId && "ring-2 ring-[#222325] ring-offset-2";

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-[472px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white text-[13px] text-[#222325] br-bold duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex flex-none items-center gap-2.5 pb-3 pl-[18px] pr-3.5 pt-3.5">
            <DialogPrimitive.Title className="flex-1 text-base font-extrabold">Goals</DialogPrimitive.Title>
            <button
              type="button"
              onClick={() => setHowOpen((open) => !open)}
              aria-label="How voting works"
              aria-expanded={howOpen}
              className={cn(
                "grid h-[30px] w-[30px] cursor-pointer place-content-center rounded-full transition-colors hover:bg-[#f0f0ea]",
                howOpen ? "bg-[#f0f0ea] text-[#222325]" : "text-[#5f6062]",
              )}>
              <CircleHelp className="h-4 w-4" />
            </button>
            <DialogPrimitive.Close className="grid h-[30px] w-[30px] cursor-pointer place-content-center rounded-lg border border-[#222325] bg-white transition-colors hover:bg-[#f0f0ea]">
              <X className="h-3.5 w-3.5" strokeWidth={2.6} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className={cn(howOpen ? "mx-[18px] mb-3 rounded-lg bg-[#f0f0ea] px-3 py-2.5 text-xs leading-relaxed text-[#44453f]" : "sr-only")}>
            Goals are what the pod works toward together. Votes count against the whole pod: {voteMajority} of {memberCount} upvotes adds a goal,{" "}
            {voteMajority} of {memberCount} downvotes takes it off. If everyone has voted and it&apos;s level, the side that got there first wins. A goal
            under review keeps counting until its vote carries.
          </DialogPrimitive.Description>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-neo">
            {linkClosed && (
              <p className="mx-3.5 mb-3 rounded-lg bg-[#f0f0ea] px-3 py-2 text-xs text-black/60">That vote has closed, and the goal is no longer on the list.</p>
            )}

            {votingGoals.length > 0 && (
              <>
                <p className={cn(SECTION_LABEL, "pb-1")}>Up for a vote</p>
                <div className="mx-3.5 mb-3 mt-1.5 flex flex-col gap-2.5">
                  {votingGoals.map((goal) => {
                    const adding = goal.status === "voting-add";
                    const proposer = goal.proposedBy ?? "You";
                    return (
                      <div
                        key={goal.id}
                        {...cardProps(goal.id)}
                        className={cn("flex flex-col gap-2.5 rounded-xl border-[1.5px] border-[#222325] bg-[#f4f9c9] px-3.5 py-3 transition-shadow", ring(goal.id))}>
                        <div className="flex items-center gap-2.5">
                          <span title={proposer}>
                            <PodAvatar name={proposer} image={photoOf(proposer)} size={28} />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-extrabold">{goal.label}</span>
                            <span className="text-xs text-[#44453f]">
                              {adding ? "New goal" : "Suggested for removal"} · closes in {goal.daysLeft} {goal.daysLeft === 1 ? "day" : "days"} · needs{" "}
                              {voteMajority} of {memberCount}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <VoteButtons goal={goal} onVote={(choice) => castVote(goal.id, choice)} />
                          <VoteDots cast={goal.votes.length} of={memberCount} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <p className={cn(SECTION_LABEL, "py-1")}>Active</p>
            {activeGoals.map((goal, i) => {
              const Icon = GOAL_KIND_META[goal.kind].icon;
              return (
                <div
                  key={goal.id}
                  {...(goal.status === "active" ? cardProps(goal.id) : {})}
                  className={cn(
                    "flex min-h-[50px] items-center gap-3 py-1.5 pl-[18px] pr-3.5 transition-shadow",
                    i > 0 && "border-t border-black/10",
                    goal.status === "active" && ring(goal.id),
                  )}>
                  <span className={cn("grid h-7 w-7 flex-none place-content-center rounded-lg", goal.protected ? "bg-[#f0f0ea]" : "bg-[#e1f073]")}>
                    <Icon className="h-[15px] w-[15px]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{goal.label}</span>
                  <span className="flex-none text-xs font-bold tabular-nums text-[#5f6062]">
                    {goal.current}/{goal.target}
                  </span>
                  {goal.protected ? (
                    <span title="Every pod carries this. It can't be voted out." className="grid h-[26px] w-[26px] flex-none place-content-center text-[#5f6062]">
                      <Lock className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                  ) : goal.status === "voting-remove" ? (
                    <span className="flex-none text-[11px] font-bold text-[#b23c26]">In review</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => suggestRemoval(goal.id)}
                      aria-label={`Suggest removing ${goal.label}`}
                      title="Suggest removing: your downvote, and the pod reviews it"
                      className="grid h-[26px] w-[26px] flex-none cursor-pointer place-content-center rounded-md text-[#5f6062] transition-colors hover:bg-[#fdf3f1] hover:text-[#b23c26]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            <div className="h-1" />
          </div>

          <div className="flex flex-none items-center gap-2.5 border-t-[1.5px] border-[#222325] bg-[#fbfbf7] py-3 pl-[18px] pr-3.5">
            <span className="flex-1 text-xs text-[#5f6062]">Votes close after 7 days.</span>
            <button
              type="button"
              onClick={onSuggest}
              className="flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg bg-[#222325] px-3.5 text-[13px] font-extrabold text-white transition-opacity hover:opacity-90">
              <Plus className="h-4 w-4" />
              Suggest a goal
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default ManageGoalsDialog;
