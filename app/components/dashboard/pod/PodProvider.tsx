"use client";

// Pod state, lifted out of the pod page so the rest of the dashboard can
// reach it: the win-log modal auto-shares a landed job here, the tracker's
// timeline dialog can push a milestone here, and the pod screen renders
// whatever has accumulated. Page-local state made that impossible — the
// whole point of "add this to your pod" is that it works from anywhere.

import { createContext, useContext, useState, type FC, type ReactNode } from "react";
import { toast } from "sonner";
import { BOARD, FEED, POD_GOALS } from "@/app/lib/dashboard/mock-data";
import type { PodGoal, PodGoalKind } from "@/app/lib/dashboard/types";
import type { WinRecord } from "@/app/lib/dashboard/win";

/** One row of "What's moving" — the pod's shared feed. */
export interface PodMovingItem {
  id: string;
  text: string;
  time: string;
  /** Fire-reaction count. The fire is the only reaction — one tap, one dopamine hit. */
  fires: number;
  firedByMe: boolean;
  hot?: boolean;
  /** True for items you shared — the pod screen labels them quietly. */
  mine?: boolean;
}

export interface SuggestedGoal {
  kind: PodGoalKind;
  label: string;
  target: number;
  unit: string;
}

interface PodContextValue {
  moving: PodMovingItem[];
  /** Prepends an update to What's moving as "just now". Everything that
   *  feels share-worthy anywhere in the dashboard funnels through this. */
  shareToPod: (text: string, opts?: { hot?: boolean }) => void;
  toggleFire: (id: string) => void;

  goals: PodGoal[];
  /** Majority needed to resolve a vote — derived from pod size. */
  voteMajority: number;
  suggestGoal: (input: SuggestedGoal) => void;
  suggestRemoval: (goalId: string) => void;
  castVote: (goalId: string, choice: "for" | "against") => void;

  /**
   * The whole reason a job win is worth logging: it lands on the pod feed as
   * a hot item AND moves the pod's protected "someone lands a job" goal.
   */
  recordJobWin: (win: WinRecord) => void;
}

const PodCtx = createContext<PodContextValue | null>(null);

let seq = 0;
const nextId = () => `pod-shared-${(seq += 1)}`;

const PodProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [moving, setMoving] = useState<PodMovingItem[]>(() =>
    FEED.map((f) => ({ id: f.id, text: f.text, time: f.time, fires: f.n, firedByMe: false, hot: f.hot }))
  );
  const [goals, setGoals] = useState<PodGoal[]>(POD_GOALS);

  const voteMajority = Math.floor(BOARD.length / 2) + 1;

  function shareToPod(text: string, opts?: { hot?: boolean }) {
    setMoving((prev) => [{ id: nextId(), text, time: "Just now", fires: 0, firedByMe: false, hot: opts?.hot, mine: true }, ...prev]);
  }

  function toggleFire(id: string) {
    setMoving((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, firedByMe: !item.firedByMe, fires: item.fires + (item.firedByMe ? -1 : 1) }
          : item
      )
    );
  }

  function suggestGoal(input: SuggestedGoal) {
    setGoals((prev) => [
      ...prev,
      {
        id: `goal-custom-${prev.length}`,
        kind: input.kind,
        label: input.label,
        target: input.target,
        current: 0,
        unit: input.unit,
        protected: false,
        proposedBy: "You",
        votes: [],
        status: "voting-add",
        proposedAt: new Date().toISOString(),
      },
    ]);
    toast.success("Put to a pod vote", { description: "Majority wins — the window runs for 7 days." });
  }

  function suggestRemoval(goalId: string) {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId ? { ...g, status: "voting-remove", proposedBy: "You", votes: [], proposedAt: new Date().toISOString() } : g
      )
    );
  }

  /**
   * Casts "You"'s vote. A "for" majority resolves immediately (activates an
   * add, deletes a removal target); "against" votes only accumulate — a
   * proposal that never wins expires on its own 7-day window. Reads `goals`
   * from the closure so the toast never lives inside a setState updater.
   */
  function castVote(goalId: string, choice: "for" | "against") {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal || goal.votes.some((v) => v.memberName === "You")) return;

    const votes = [...goal.votes, { memberName: "You" as const, choice }];
    const forCount = votes.filter((v) => v.choice === "for").length;

    if (forCount >= voteMajority) {
      if (goal.status === "voting-add") {
        setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, status: "active", votes } : g)));
        toast.success(`"${goal.label}" is now a pod goal.`);
      } else {
        setGoals((prev) => prev.filter((g) => g.id !== goalId));
        toast.success(`"${goal.label}" was voted out.`);
      }
      return;
    }

    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, votes } : g)));
  }

  function recordJobWin(win: WinRecord) {
    shareToPod(`You landed ${win.facts.role} at ${win.facts.company} 🎉`, { hot: true });
    setGoals((prev) =>
      prev.map((g) => (g.kind === "job-win" && g.status === "active" ? { ...g, current: Math.min(g.target, g.current + 1) } : g))
    );
    toast.success("Your pod knows", { description: "Your win is on What's moving and counts toward the pod's goal." });
  }

  return (
    <PodCtx.Provider
      value={{ moving, shareToPod, toggleFire, goals, voteMajority, suggestGoal, suggestRemoval, castVote, recordJobWin }}>
      {children}
    </PodCtx.Provider>
  );
};

export default PodProvider;

export function usePod(): PodContextValue {
  const ctx = useContext(PodCtx);
  if (!ctx) throw new Error("usePod must be used inside a PodProvider");
  return ctx;
}
