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
// The source is the applications table (Part 2 Phase B). Columns and the
// closed list are derived from one cached list, `useApplications()`, grouped
// by status and ordered by position, so the tracker, Home's follow-ups and the
// log dialog's duplicate check all read the same rows. Every mutation writes
// that cache first and the server second (hooks/mutations/
// useApplicationMutations.ts), and the rewards, toasts and Undo around each
// move fire exactly where they always did.

import { createContext, useContext, useEffect, useMemo, useRef, type FC, type ReactNode } from "react";
import { toast } from "sonner";
import { arrayMove } from "@dnd-kit/sortable";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useWin } from "@/app/components/dashboard/win/WinProvider";
import { apiMessage } from "@/app/lib/api/core";
import {
  applicationInput,
  compareByClosedAt,
  compareByPosition,
  isObjectId,
  newClientId,
  planDropPositions,
  toTrackerCard,
  topPosition,
} from "@/app/lib/applications/api";
import type { ApplicationItem } from "@/app/lib/applications/types";
import type { JobSource } from "@/app/lib/jobs/types";
import type { TrackerCard, TrackerClosedReason, TrackerColumn, TrackerColumnId, TrackerStatus } from "@/app/lib/dashboard/types";
import { useCreateApplication, useUpdateApplication } from "@/hooks/mutations/useApplicationMutations";
import { useApplications } from "@/hooks/queries/useApplicationsQuery";
import { CLOSED_META, CLOSED_ORDER, COLUMN_LABELS, STATUS_ORDER, isClosedStatus } from "./tracker-meta";

/** One card plus where it currently sits — what every cross-screen reader wants. */
export interface PlacedCard {
  card: TrackerCard;
  columnId: TrackerColumnId;
}

/**
 * A column on the board. The five stages and the four outcomes render through
 * the same shape, so the board never special-cases half of itself.
 */
export interface BoardColumn {
  id: TrackerStatus;
  label: string;
  count: number;
  cards: TrackerCard[];
}

export type AddCardResult = { status: "added"; card: TrackerCard } | { status: "duplicate"; card: TrackerCard };

interface TrackerContextValue {
  columns: TrackerColumn[];
  closed: TrackerCard[];
  /** Stages and outcomes together, in board order. */
  boardColumns: BoardColumn[];
  /** Every open card with its stage, board order. */
  placed: PlacedCard[];
  findColumnIdForCard: (cardId: string) => TrackerColumnId | null;
  /** Where a card is now — a stage, an outcome, or null if it is gone. */
  statusOf: (cardId: string) => TrackerStatus | null;
  /** The one move: stage to stage, stage to outcome, and back again. */
  setStatus: (cardId: string, to: TrackerStatus) => void;
  moveCard: (cardId: string, to: TrackerColumnId) => void;
  closeCard: (cardId: string, reason: TrackerClosedReason) => void;
  reopenCard: (cardId: string) => void;
  addCard: (job: { company: string; role: string; source: JobSource }) => AddCardResult;
  /** Commits a dnd-kit drop: reorder within a column, or move between them. */
  commitDrop: (activeId: string, overId: string) => void;
  /** Marks an application touched today, restarting its silence clock. */
  touchCard: (cardId: string) => void;
}

/**
 * What the tracker's job picker hands `addCard` beyond the three fields the
 * context promises. Optional, so every caller of that signature still fits;
 * read when present, so a picked job arrives with its link, its location and
 * the saved job it came from.
 */
interface PickedJobExtras {
  id?: string;
  url?: string | null;
  location?: string | null;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

/** One empty list for every render with nothing loaded, so the derived board keeps its identity. */
const NO_APPLICATIONS: ApplicationItem[] = [];

export const TrackerProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { recordAction, awardStrongEvent } = useActivity();
  const { openWinLog } = useWin();
  const applications = useApplications();
  const createApplication = useCreateApplication();
  const updateApplication = useUpdateApplication();

  const items = applications.data ?? NO_APPLICATIONS;
  // "Now" for every day count on the board is when the cache last changed.
  // Reading the clock during render is impure, and every read and every
  // optimistic write moves this forward anyway.
  const now = applications.dataUpdatedAt;

  // A failed read keeps the last board on screen (React Query holds on to the
  // data) and says so once per outage, not once per retry or per move.
  const { isError, error, refetch } = applications;
  const hasBoard = applications.data !== undefined;
  const errorShown = useRef(false);
  useEffect(() => {
    if (!isError) {
      errorShown.current = false;
      return;
    }
    if (errorShown.current) return;
    errorShown.current = true;
    toast.error(hasBoard ? "Your board couldn't refresh" : "Your board couldn't load", {
      id: "tracker-board-load-failed",
      description: hasBoard ? `${apiMessage(error)} This is the last copy we had.` : apiMessage(error),
      action: { label: "Retry", onClick: () => void refetch() },
    });
  }, [isError, error, hasBoard, refetch]);

  // Grouped by status, ordered by position. Loading shows five empty columns,
  // never the old mock seed, and `count` is the real number of cards: it used
  // to be a declared total that the seed's sample of cards never reached.
  const { columns, closed } = useMemo(() => {
    const byStatus = new Map<TrackerStatus, ApplicationItem[]>();
    for (const item of items) {
      const group = byStatus.get(item.status);
      if (group) group.push(item);
      else byStatus.set(item.status, [item]);
    }
    const open: TrackerColumn[] = STATUS_ORDER.map((id) => {
      const cards = (byStatus.get(id) ?? []).sort(compareByPosition).map((item) => toTrackerCard(item, now));
      return { id, label: COLUMN_LABELS[id], count: cards.length, cards };
    });
    const ended = CLOSED_ORDER.flatMap((reason) => byStatus.get(reason) ?? [])
      .sort(compareByClosedAt)
      .map((item) => toTrackerCard(item, now));
    return { columns: open, closed: ended };
  }, [items, now]);

  const placed: PlacedCard[] = columns.flatMap((col) => col.cards.map((card) => ({ card, columnId: col.id })));

  const boardColumns: BoardColumn[] = [
    ...columns.map((col) => ({ id: col.id as TrackerStatus, label: col.label, count: col.count, cards: col.cards })),
    ...CLOSED_ORDER.map((reason) => {
      const cards = closed.filter((c) => c.closedReason === reason);
      return { id: reason as TrackerStatus, label: CLOSED_META[reason].label, count: cards.length, cards };
    }),
  ];

  const rowOf = (cardId: string) => items.find((item) => item.id === cardId);

  function findColumnIdForCard(cardId: string): TrackerColumnId | null {
    const status = rowOf(cardId)?.status;
    return status && !isClosedStatus(status) ? status : null;
  }

  function statusOf(cardId: string): TrackerStatus | null {
    return rowOf(cardId)?.status ?? null;
  }

  /** Landing in Offer is the win-log's moment — offered, never forced. */
  function offerWinToast(company: string) {
    toast.success(`${company} moved to Offer 🎉`, {
      description: "That sounds like a job. Log it and your pod sees.",
      action: { label: "I got the job", onClick: openWinLog },
    });
  }

  /**
   * The rewards a real stage change pays.
   *
   * Only landing an offer keeps the streak alive. Every other move is bookkeeping
   * the user does for themselves, and a streak that a drag between two columns
   * could preserve would be measuring tidiness rather than the work.
   *
   * The gifts are a separate currency and stay: reaching interview or offer pays
   * once per application forever, so dragging back and forth can't farm it.
   */
  function creditStageChange(cardId: string, company: string, to: TrackerColumnId) {
    if (to === "interviewing") awardStrongEvent("reached-interview", cardId, `Reached interview — ${company}`);
    if (to === "offer") {
      recordAction("status-change", cardId, `${company} → ${COLUMN_LABELS[to]}`);
      awardStrongEvent("reached-offer", cardId, `Offer reached — ${company}`);
      offerWinToast(company);
    }
  }

  function moveCard(cardId: string, to: TrackerColumnId) {
    const row = rowOf(cardId);
    if (!row || isClosedStatus(row.status) || row.status === to) return;
    // On top of its new column, where a moved card has always landed. Moving a
    // card IS touching it, so the server restarts the silence clock.
    updateApplication(cardId, { status: to, position: topPosition(items, to) });
    creditStageChange(cardId, row.company, to);
  }

  function touchCard(cardId: string) {
    if (findColumnIdForCard(cardId) === null) return;
    updateApplication(cardId, { touch: true });
  }

  /**
   * The exit. A closed application leaves its column carrying the stage it
   * died in, so the funnel can tell one nobody read from one that reached a
   * final round. Reversible, with the undo on the toast rather than buried in
   * the drawer — a mis-tap should cost one click to fix.
   */
  function closeCard(cardId: string, reason: TrackerClosedReason) {
    const row = rowOf(cardId);
    if (!row || isClosedStatus(row.status)) return;
    const from = row.status;
    updateApplication(cardId, { status: reason });
    toast.success(`${row.company} closed`, {
      description: `Marked ${CLOSED_META[reason].label.toLowerCase()}. Your funnel just got more honest.`,
      // The row as it was, by value: Undo puts back its stage AND its place in
      // that column, and this copy is the only record left of the place.
      action: { label: "Undo", onClick: () => restoreCard(row.id, from, row.position) },
    });
  }

  /** Back onto the board from an outcome, at `position`. The server clears the closed fields and restarts the silence clock. */
  function restoreCard(cardId: string, to: TrackerColumnId, position: number) {
    updateApplication(cardId, { status: to, position });
  }

  function reopenCard(cardId: string) {
    const row = rowOf(cardId);
    if (!row || !isClosedStatus(row.status)) return;
    const to = row.closedFrom ?? "applied";
    restoreCard(cardId, to, topPosition(items, to));
  }

  /**
   * Every status change on the board goes through here, so a drag, a menu pick
   * and a dialog all take the same four paths: forward through the stages,
   * out to an outcome, back from one, or from one outcome to another.
   */
  function setStatus(cardId: string, to: TrackerStatus) {
    const from = statusOf(cardId);
    if (!from || from === to) return;

    if (!isClosedStatus(from)) {
      if (isClosedStatus(to)) closeCard(cardId, to);
      else moveCard(cardId, to);
      return;
    }

    const row = rowOf(cardId);
    if (!row) return;
    if (isClosedStatus(to)) {
      // Same card, different verdict — nothing moves, the reason is corrected.
      updateApplication(cardId, { status: to });
      return;
    }
    restoreCard(cardId, to, topPosition(items, to));
    creditStageChange(cardId, row.company, to);
  }

  /** Dedupes against the whole board; new jobs land in Saved. */
  function addCard(job: { company: string; role: string; source: JobSource } & PickedJobExtras): AddCardResult {
    const existing = columns
      .flatMap((c) => c.cards)
      .find(
        (c) =>
          c.company.trim().toLowerCase() === job.company.trim().toLowerCase() &&
          c.title.trim().toLowerCase() === job.role.trim().toLowerCase(),
      );
    if (existing) return { status: "duplicate", card: existing };

    const id = newClientId("trk");
    const rww = job.source === "platform";
    createApplication({
      clientId: id,
      input: applicationInput({
        company: job.company,
        role: job.role,
        location: job.location,
        url: job.url,
        // Every pick is one of the user's saved jobs, and the application
        // remembers which.
        savedJobId: isObjectId(job.id) ? job.id : null,
        source: rww ? "internal" : "external",
        status: "saved",
      }),
    });

    const card: TrackerCard = { id, title: job.role, company: job.company, daysAgo: 0, lastTouchedDaysAgo: 0, rww };
    return { status: "added", card };
  }

  /**
   * Commits a drop. `overId` is either a column's own droppable id (dropped on
   * empty space) or another card's id (dropped onto a position). The reward
   * side-effects are computed against pre-drop state.
   *
   * The column is laid out exactly as the board always laid out a drop, then
   * the moved card's position is chosen to put it there: between its new
   * neighbours, so a reorder is normally a single write.
   */
  function commitDrop(activeId: string, overId: string) {
    if (activeId === overId) return;

    // Resolve the drop target to a column: either the column itself, or the
    // column holding the card it landed on.
    const target = boardColumns.some((c) => c.id === overId)
      ? (overId as TrackerStatus)
      : (boardColumns.find((c) => c.cards.some((card) => card.id === overId))?.id ?? null);
    const source = statusOf(activeId);
    if (!target || !source) return;

    // Anything involving an outcome column is a status change, not a reorder —
    // closed cards carry no order worth preserving.
    if (isClosedStatus(source) || isClosedStatus(target)) {
      if (source !== target) setStatus(activeId, target);
      return;
    }

    const moved = rowOf(activeId);
    if (!moved) return;
    const targetRows = items.filter((item) => item.status === target).sort(compareByPosition);
    const isOverColumn = columns.some((c) => c.id === overId);

    let order: ApplicationItem[];
    if (source === target) {
      // Same column — pure reorder.
      const oldIndex = targetRows.findIndex((item) => item.id === activeId);
      const newIndex = isOverColumn ? targetRows.length - 1 : targetRows.findIndex((item) => item.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      order = arrayMove(targetRows, oldIndex, newIndex);
    } else {
      // Different column — in at the card it landed on, or at the end.
      const overIndex = isOverColumn ? targetRows.length : targetRows.findIndex((item) => item.id === overId);
      order = [...targetRows];
      order.splice(overIndex === -1 ? targetRows.length : overIndex, 0, moved);
      creditStageChange(activeId, moved.company, target);
    }

    for (const write of planDropPositions(order, activeId)) {
      const input = write.id === activeId && source !== target ? { status: target, position: write.position } : { position: write.position };
      updateApplication(write.id, input);
    }
  }

  return (
    <TrackerContext.Provider
      value={{
        columns,
        closed,
        boardColumns,
        placed,
        findColumnIdForCard,
        statusOf,
        setStatus,
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
