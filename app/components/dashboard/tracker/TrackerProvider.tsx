"use client";

// The board, lifted out of the tracker screen.
//
// It used to live in `dashboard/tracker/Client.tsx` as local state, which was
// fine while the tracker was the only thing that knew about applications. It
// no longer is: Home has to show which applications are owed a follow-up, and
// that list is worthless if it still names three companies the user closed an
// hour ago on another screen. One board, one source.
//
// Mount order matters — this sits INSIDE ActivityProvider (every move is a
// logged action) and inside WinProvider (landing in Offer offers the win log).
//
// Mock-only: in-memory, resets on reload. Every mutation here is the seam a
// real applications table fills.

import { createContext, useContext, useRef, useState, type FC, type ReactNode } from "react";
import { toast } from "sonner";
import { arrayMove } from "@dnd-kit/sortable";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useWin } from "@/app/components/dashboard/win/WinProvider";
import { TRACKER_CLOSED_CARDS, TRACKER_COLUMNS } from "@/app/lib/dashboard/mock-data";
import type { JobOption } from "@/app/lib/dashboard/job-options";
import type { TrackerCard, TrackerClosedReason, TrackerColumn, TrackerColumnId } from "@/app/lib/dashboard/types";
import { CLOSED_META, COLUMN_LABELS } from "./tracker-meta";

/** One card plus where it currently sits — what every cross-screen reader wants. */
export interface PlacedCard {
  card: TrackerCard;
  columnId: TrackerColumnId;
}

export type AddCardResult = { status: "added"; card: TrackerCard } | { status: "duplicate"; card: TrackerCard };

interface TrackerContextValue {
  columns: TrackerColumn[];
  closed: TrackerCard[];
  /** Every open card with its stage, board order. */
  placed: PlacedCard[];
  findColumnIdForCard: (cardId: string) => TrackerColumnId | null;
  moveCard: (cardId: string, to: TrackerColumnId) => void;
  closeCard: (cardId: string, reason: TrackerClosedReason) => void;
  reopenCard: (cardId: string) => void;
  addCard: (job: JobOption) => AddCardResult;
  /** Commits a dnd-kit drop: reorder within a column, or move between them. */
  commitDrop: (activeId: string, overId: string) => void;
  /** Marks an application touched today, restarting its silence clock. */
  touchCard: (cardId: string) => void;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

export const TrackerProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { applications, recordAction, awardStrongEvent } = useActivity();
  const { openWinLog } = useWin();

  const [columns, setColumns] = useState<TrackerColumn[]>(() => TRACKER_COLUMNS.map((col) => ({ ...col, cards: [...col.cards] })));
  const [closed, setClosed] = useState<TrackerCard[]>(() => [...TRACKER_CLOSED_CARDS]);
  const addSeq = useRef(0);

  // Applications logged anywhere in the app land here. Folded in during render
  // using React's "adjust state when input changes" pattern — an effect would
  // paint the stale board first, then correct it.
  const [mergedIds, setMergedIds] = useState<string[]>([]);
  const pending = applications.filter((a) => !mergedIds.includes(a.id));
  if (pending.length > 0) {
    setMergedIds(applications.map((a) => a.id));
    setColumns((prev) =>
      prev.map((col) =>
        col.id === "applied"
          ? {
              ...col,
              // `count` is the real total and is independent of `cards.length`,
              // which is only a representative sample — so both have to move.
              count: col.count + pending.length,
              cards: [
                ...pending.map((a) => ({
                  id: a.id,
                  title: a.role,
                  company: a.company,
                  daysAgo: 0,
                  lastTouchedDaysAgo: 0,
                  rww: a.source === "internal",
                })),
                ...col.cards,
              ],
            }
          : col,
      ),
    );
  }

  const placed: PlacedCard[] = columns.flatMap((col) => col.cards.map((card) => ({ card, columnId: col.id })));

  function findColumnIdForCard(cardId: string): TrackerColumnId | null {
    return columns.find((c) => c.cards.some((card) => card.id === cardId))?.id ?? null;
  }

  /** Landing in Offer is the win-log's moment — offered, never forced. */
  function offerWinToast(company: string) {
    toast.success(`${company} moved to Offer 🎉`, {
      description: "That sounds like a job. Log it and your pod sees.",
      action: { label: "I got the job", onClick: openWinLog },
    });
  }

  /** The rewards a real stage change pays. Shared by the pill and by drops. */
  function creditStageChange(cardId: string, company: string, to: TrackerColumnId) {
    // Keeping the board honest is a qualifying action.
    recordAction("status-change", cardId, `${company} → ${COLUMN_LABELS[to]}`);
    // Reaching a real stage pays once per application forever — dragging back
    // and forth can't farm it.
    if (to === "interviewing") awardStrongEvent("reached-interview", cardId, `Reached interview — ${company}`);
    if (to === "offer") {
      awardStrongEvent("reached-offer", cardId, `Offer reached — ${company}`);
      offerWinToast(company);
    }
  }

  function moveCard(cardId: string, to: TrackerColumnId) {
    const from = findColumnIdForCard(cardId);
    if (!from || from === to) return;
    const card = columns.find((c) => c.id === from)!.cards.find((c) => c.id === cardId);
    if (!card) return;

    setColumns((prev) =>
      prev.map((c) => {
        if (c.id === from) return { ...c, cards: c.cards.filter((x) => x.id !== cardId), count: Math.max(0, c.count - 1) };
        // Moving a card IS touching it, so the silence clock restarts.
        if (c.id === to) return { ...c, cards: [{ ...card, lastTouchedDaysAgo: 0 }, ...c.cards], count: c.count + 1 };
        return c;
      }),
    );
    creditStageChange(cardId, card.company, to);
  }

  function touchCard(cardId: string) {
    setColumns((prev) =>
      prev.map((c) => ({ ...c, cards: c.cards.map((x) => (x.id === cardId ? { ...x, lastTouchedDaysAgo: 0 } : x)) })),
    );
  }

  /**
   * The exit. A closed application leaves its column carrying the stage it
   * died in, so the funnel can tell one nobody read from one that reached a
   * final round. Reversible, with the undo on the toast rather than buried in
   * the drawer — a mis-tap should cost one click to fix.
   */
  function closeCard(cardId: string, reason: TrackerClosedReason) {
    const from = findColumnIdForCard(cardId);
    if (!from) return;
    const card = columns.find((c) => c.id === from)!.cards.find((c) => c.id === cardId);
    if (!card) return;

    setColumns((prev) =>
      prev.map((c) => (c.id === from ? { ...c, cards: c.cards.filter((x) => x.id !== cardId), count: Math.max(0, c.count - 1) } : c)),
    );
    setClosed((prev) => [
      // statusChip is dropped: "Follow up" on a rejected application is noise
      // at best and a lie at worst.
      { ...card, statusChip: undefined, closedReason: reason, closedDaysAgo: 0, closedFrom: from },
      ...prev,
    ]);
    recordAction("status-change", cardId, `${card.company} → ${CLOSED_META[reason].label}`);
    toast.success(`${card.company} closed`, {
      description: `Marked ${CLOSED_META[reason].label.toLowerCase()}. Your funnel just got more honest.`,
      // Passes the card by value, not by id: `closed` hasn't committed yet, so
      // an id lookup inside this closure would find nothing.
      action: { label: "Undo", onClick: () => restoreCard(card, from) },
    });
  }

  /** Both setState calls stay pure — no cross-calls inside updaters. */
  function restoreCard(card: TrackerCard, to: TrackerColumnId) {
    const restored: TrackerCard = {
      ...card,
      closedReason: undefined,
      closedDaysAgo: undefined,
      closedFrom: undefined,
      lastTouchedDaysAgo: 0,
    };
    setClosed((prev) => prev.filter((c) => c.id !== card.id));
    setColumns((prev) => prev.map((c) => (c.id === to ? { ...c, cards: [restored, ...c.cards], count: c.count + 1 } : c)));
  }

  function reopenCard(cardId: string) {
    const card = closed.find((c) => c.id === cardId);
    if (!card) return;
    restoreCard(card, card.closedFrom ?? "applied");
  }

  /** Dedupes against the whole board; new jobs land in Saved. */
  function addCard(job: JobOption): AddCardResult {
    const existing = columns
      .flatMap((c) => c.cards)
      .find(
        (c) =>
          c.company.trim().toLowerCase() === job.company.trim().toLowerCase() &&
          c.title.trim().toLowerCase() === job.role.trim().toLowerCase(),
      );
    if (existing) return { status: "duplicate", card: existing };

    const card: TrackerCard = {
      id: `trk-added-${++addSeq.current}`,
      title: job.role,
      company: job.company,
      daysAgo: 0,
      lastTouchedDaysAgo: 0,
      rww: job.source === "platform",
    };
    setColumns((prev) => prev.map((c) => (c.id === "saved" ? { ...c, cards: [card, ...c.cards], count: c.count + 1 } : c)));
    return { status: "added", card };
  }

  /**
   * Commits a drop. `overId` is either a column's own droppable id (dropped on
   * empty space) or another card's id (dropped onto a position). The reward
   * side-effects are computed against pre-drop state and fired outside the
   * updater, which must stay pure.
   */
  function commitDrop(activeId: string, overId: string) {
    if (activeId === overId) return;

    const preSource = findColumnIdForCard(activeId);
    const preTarget = columns.some((c) => c.id === overId) ? (overId as TrackerColumnId) : findColumnIdForCard(overId);
    if (preSource && preTarget && preSource !== preTarget) {
      const moved = columns.find((c) => c.id === preSource)?.cards.find((c) => c.id === activeId);
      if (moved) creditStageChange(activeId, moved.company, preTarget);
    }

    setColumns((prev) => {
      const sourceColId = prev.find((c) => c.cards.some((card) => card.id === activeId))?.id ?? null;
      if (!sourceColId) return prev;

      const isOverColumn = prev.some((c) => c.id === overId);
      const targetColId = isOverColumn
        ? (overId as TrackerColumnId)
        : (prev.find((c) => c.cards.some((card) => card.id === overId))?.id ?? null);
      if (!targetColId) return prev;

      // Same column — pure reorder.
      if (sourceColId === targetColId) {
        const col = prev.find((c) => c.id === sourceColId)!;
        const oldIndex = col.cards.findIndex((c) => c.id === activeId);
        const newIndex = isOverColumn ? col.cards.length - 1 : col.cards.findIndex((c) => c.id === overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        return prev.map((c) => (c.id === sourceColId ? { ...c, cards: arrayMove(c.cards, oldIndex, newIndex) } : c));
      }

      // Different column — move the card and shift both counts.
      const sourceCol = prev.find((c) => c.id === sourceColId)!;
      const movedCard = sourceCol.cards.find((c) => c.id === activeId);
      if (!movedCard) return prev;

      return prev.map((c) => {
        if (c.id === sourceColId) {
          return { ...c, cards: c.cards.filter((card) => card.id !== activeId), count: Math.max(0, c.count - 1) };
        }
        if (c.id === targetColId) {
          const overIndex = isOverColumn ? c.cards.length : c.cards.findIndex((card) => card.id === overId);
          const insertAt = overIndex === -1 ? c.cards.length : overIndex;
          const newCards = [...c.cards];
          newCards.splice(insertAt, 0, { ...movedCard, lastTouchedDaysAgo: 0 });
          return { ...c, cards: newCards, count: c.count + 1 };
        }
        return c;
      });
    });
  }

  return (
    <TrackerContext.Provider
      value={{
        columns,
        closed,
        placed,
        findColumnIdForCard,
        moveCard,
        closeCard,
        reopenCard,
        addCard,
        commitDrop,
        touchCard,
      }}>
      {children}
    </TrackerContext.Provider>
  );
};

export function useTracker(): TrackerContextValue {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error("useTracker must be used within TrackerProvider");
  return ctx;
}
