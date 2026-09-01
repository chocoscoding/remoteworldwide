"use client";

import { FC, useRef, useState } from "react";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Kanban as KanbanIcon, Plus, Table as TableIcon } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { useSidebarCollapse } from "@/app/components/dashboard/SidebarCollapseContext";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useWin } from "@/app/components/dashboard/win/WinProvider";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import LogoMini from "@/app/components/svg/LogoMini";
import JobPickerDialog from "@/app/components/dashboard/jobs/JobPickerDialog";
import { PLATFORM_JOBS, createPastedJob, type JobOption } from "@/app/lib/dashboard/job-options";
import { TRACKER_COLUMNS } from "@/app/lib/dashboard/mock-data";
import type { TrackerCard as TrackerCardData, TrackerColumn, TrackerColumnId } from "@/app/lib/dashboard/types";
import JobTimelineDialog from "@/app/components/dashboard/tracker/JobTimelineDialog";
import { COLUMN_LABELS } from "@/app/components/dashboard/tracker/tracker-meta";

// Component imports
import { TrackerCardItem } from "../../../../components/dashboard/tracker/TrackerCard";
import { KanbanColumn } from "../../../../components/dashboard/tracker/KanbanColumn";
import { TrackerTableView } from "../../../../components/dashboard/tracker/TrackerTableView";
import { TrackerCalendarView } from "../../../../components/dashboard/tracker/TrackerCalendarView";
import type { TrackerView, ViewConfig } from "./types";

// ---------------------------------------------------------------------------
// Local screen state types + config
// ---------------------------------------------------------------------------

const VIEWS: ViewConfig[] = [
  { id: "board", label: "Board", icon: KanbanIcon },
  { id: "table", label: "Table", icon: TableIcon },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const TrackerClient: FC = () => {
  const { collapsed: sidebarCollapsed } = useSidebarCollapse();
  const [view, setView] = useState<TrackerView>("board");
  const [columns, setColumns] = useState<TrackerColumn[]>(() => TRACKER_COLUMNS.map((col) => ({ ...col, cards: [...col.cards] })));
  const [activeCard, setActiveCard] = useState<TrackerCardData | null>(null);

  // Applications logged anywhere in the app land here. Columns stay in local
  // state so drag-and-drop keeps working, and newly logged applications are
  // folded in during render using React's "adjust state when input changes"
  // pattern — an effect would paint the stale board first, then correct it.
  const { applications, recordAction, awardStrongEvent } = useActivity();
  const { openWinLog } = useWin();
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
                  statusChip: "Follow up",
                  rww: a.source === "internal",
                })),
                ...col.cards,
              ],
            }
          : col,
      ),
    );
  }

  // Timeline dialog target — an id, resolved against live columns each render
  // so a status change made inside the dialog is reflected immediately.
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [jobs, setJobs] = useState<JobOption[]>(PLATFORM_JOBS);
  const addSeq = useRef(0);
  // A completed drag fires a click on the source card as the pointer lifts —
  // this latch swallows exactly that one click so a drop never opens the
  // timeline dialog. Plain clicks (< the 6px activation distance) never start
  // a drag, so the latch stays untouched for them.
  const dragHappened = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Whatever is under the pointer wins; corners are the fallback.
   *
   * `closestCorners` on its own compares the dragged card's corners against
   * every droppable's, and an empty column always loses that: its droppable is
   * one tall rectangle whose corners sit far from the cursor, so a small card
   * rect in a neighbouring column wins even when the pointer is squarely
   * inside the empty one. Offer was effectively undroppable.
   *
   * The second step matters just as much: a column's droppable spans its whole
   * height, so the pointer is inside BOTH a card and its column. If the column
   * won, every drop would append to the end instead of landing where you
   * aimed, so a populated column re-resolves to its nearest card.
   *
   * Safe against the layout the drop gap introduces: droppable rects are
   * measured once per drag (`MeasuringFrequency.Optimized`), so opening a gap
   * does not move the rects this reads and cannot oscillate.
   */
  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    const hits = pointer.length > 0 ? pointer : closestCorners(args);
    const first = hits[0]?.id;
    if (first == null) return hits;

    const col = columns.find((c) => c.id === first);
    if (!col || col.cards.length === 0) return hits;

    const cardIds = new Set<string>(col.cards.map((c) => c.id));
    const inner = closestCorners({
      ...args,
      droppableContainers: args.droppableContainers.filter((d) => cardIds.has(String(d.id))),
    });
    return inner.length > 0 ? inner : hits;
  };

  function findColumnIdForCard(cardId: string, cols: TrackerColumn[]): TrackerColumnId | null {
    return cols.find((c) => c.cards.some((card) => card.id === cardId))?.id ?? null;
  }

  const openEntry = (() => {
    if (!openCardId) return null;
    for (const col of columns) {
      const card = col.cards.find((c) => c.id === openCardId);
      if (card) return { card, columnId: col.id };
    }
    return null;
  })();

  function openTimeline(cardId: string) {
    if (dragHappened.current) {
      dragHappened.current = false;
      return;
    }
    setOpenCardId(cardId);
  }

  /** The one mover — drag-drop, the status pills and the timeline dialog all
   *  land here, so every view agrees. Both `count` and `cards` shift, per the
   *  count-is-the-real-total contract. */
  /** Landing in Offer is the win-log’s moment — offered, never forced. */
  function offerWinToast(company: string) {
    toast.success(`${company} moved to Offer 🎉`, {
      description: "That sounds like a job. Log it and your pod sees.",
      action: { label: "I got the job", onClick: openWinLog },
    });
  }

  function moveCard(cardId: string, to: TrackerColumnId) {
    const from = findColumnIdForCard(cardId, columns);
    if (!from || from === to) return;
    const card = columns.find((c) => c.id === from)!.cards.find((c) => c.id === cardId);
    if (!card) return;

    setColumns((prev) =>
      prev.map((c) => {
        if (c.id === from) return { ...c, cards: c.cards.filter((x) => x.id !== cardId), count: Math.max(0, c.count - 1) };
        if (c.id === to) return { ...c, cards: [card, ...c.cards], count: c.count + 1 };
        return c;
      }),
    );
    // Keeping the board honest is a qualifying action — the "status-change"
    // kind existed for exactly this and had no caller until now.
    recordAction("status-change", cardId, `${card.company} → ${COLUMN_LABELS[to]}`);
    // Reaching a real stage pays a rare-event credit drop, once per
    // application forever — dragging back and forth can't farm it.
    if (to === "interviewing") awardStrongEvent("reached-interview", cardId, `Reached interview — ${card.company}`);
    if (to === "offer") {
      awardStrongEvent("reached-offer", cardId, `Offer reached — ${card.company}`);
      offerWinToast(card.company);
    }
  }

  /** "Add job" — dedupe against the board; new jobs land in Saved. */
  function addJob(job: JobOption) {
    setAddOpen(false);
    const existing = columns
      .flatMap((c) => c.cards)
      .find(
        (c) =>
          c.company.trim().toLowerCase() === job.company.trim().toLowerCase() &&
          c.title.trim().toLowerCase() === job.role.trim().toLowerCase(),
      );
    if (existing) {
      toast("Already on your board", { description: `${job.company} — ${job.role}` });
      setOpenCardId(existing.id);
      return;
    }

    const card: TrackerCardData = {
      id: `trk-added-${++addSeq.current}`,
      title: job.role,
      company: job.company,
      daysAgo: 0,
      rww: job.source === "platform",
    };
    setColumns((prev) => prev.map((c) => (c.id === "saved" ? { ...c, cards: [card, ...c.cards], count: c.count + 1 } : c)));
    toast.success("Added to Saved", { description: `${job.company} — ${job.role}` });
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    dragHappened.current = true;
    setActiveCard(columns.flatMap((c) => c.cards).find((c) => c.id === id) ?? null);
  }

  /**
   * Both same-column reordering and cross-column moves are committed here, on
   * drop, and deliberately NOT in an `onDragOver` handler.
   *
   * Moving a card between columns while the drag is still live is the obvious
   * implementation, and it is a genuine infinite-loop hazard: the move mutates
   * the layout (columns grow and shrink, a column's empty-state placeholder
   * appears or disappears), dnd-kit re-measures its droppable rects against
   * the new geometry, and `over` can resolve back to the column the card just
   * left. That fires the move again in the opposite direction — and because
   * source and target have genuinely swapped by then, neither the
   * `activeId === overId` nor the `sourceColId === targetColId` guard stops
   * the return trip. The result is an unbounded setState ping-pong that
   * surfaces as React's "Maximum update depth exceeded".
   *
   * Committing on drop removes the feedback loop entirely rather than trying
   * to damp it. Live feedback is unaffected: `DragOverlay` still renders the
   * floating card and each column's `isOver` still highlights the drop target,
   * so the only behavioural change is that the card lands on release instead
   * of pre-flighting into the column under the cursor.
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    // Record the status change outside the updater (state updaters must stay
    // pure). Computed against the pre-drop state, which the drop hasn't
    // changed yet — commits happen only here, on drop.
    const preSource = findColumnIdForCard(activeId, columns);
    const preTarget = columns.some((c) => c.id === overId) ? (overId as TrackerColumnId) : findColumnIdForCard(overId, columns);
    if (preSource && preTarget && preSource !== preTarget) {
      const moved = columns.find((c) => c.id === preSource)?.cards.find((c) => c.id === activeId);
      if (moved) {
        recordAction("status-change", activeId, `${moved.company} → ${COLUMN_LABELS[preTarget]}`);
        if (preTarget === "interviewing") awardStrongEvent("reached-interview", activeId, `Reached interview — ${moved.company}`);
        if (preTarget === "offer") {
          awardStrongEvent("reached-offer", activeId, `Offer reached — ${moved.company}`);
          offerWinToast(moved.company);
        }
      }
    }

    setColumns((prev) => {
      const sourceColId = findColumnIdForCard(activeId, prev);
      if (!sourceColId) return prev;

      // `overId` is either a column's own droppable id (dropped on empty
      // space) or another card's id (dropped onto a specific position).
      const isOverColumn = prev.some((c) => c.id === overId);
      const targetColId = isOverColumn ? (overId as TrackerColumnId) : findColumnIdForCard(overId, prev);
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
          newCards.splice(insertAt, 0, movedCard);
          return { ...c, cards: newCards, count: c.count + 1 };
        }
        return c;
      });
    });
  }

  return (
    <div className={cn("bg-[#f6f6f6]", view === "board" ? "h-screen flex flex-col overflow-hidden" : "min-h-screen")}>
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex-none flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Application tracker</h1>

        <div className="flex items-center gap-3 flex-none">
          <div className="inline-flex items-center gap-1 rounded-lg border border-black/15 bg-[#f0f0ea] p-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded font-semibold whitespace-nowrap transition-all cursor-pointer px-3.5 py-1.5 text-xs",
                  view === v.id
                    ? "bg-[#222325] text-white shadow-[2px_2px_0_0_#e1f073]"
                    : "text-black/55 hover:bg-black/[0.04] hover:text-primary",
                )}>
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            ))}
          </div>

          {/* sm to sit level with the view switcher; opens the shared
              structured Add-job dialog, not the one-field log flow. */}
          <StickerButton variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add job
          </StickerButton>
        </div>
      </header>

      <main
        className={cn(
          "px-8 py-7 mx-auto w-full transition-[max-width] duration-200",
          sidebarCollapsed ? "max-w-[1520px]" : "max-w-[1320px]",
          view === "board" ? "flex flex-1 min-h-0 flex-col pb-6" : "pb-14",
        )}>
        {view === "board" ? (
          <>
            {/* RWW-badge note */}
            <div className="mb-5 flex flex-none items-center gap-2.5 rounded-sm border border-black/20 bg-[#fbfbf7] px-4 py-3">
              <LogoMini className="h-4 w-4 flex-none" />
              <p className="text-xs font-medium text-black/60">
                <span className="font-bold text-primary">Applied through Remote Worldwide</span> — status updates itself.
              </p>
            </div>

            {/* Kanban board — columns are `flex-1 min-w-[200px]` (see
                `KanbanColumn`), not fixed-width, so they share whatever width
                is actually available and only fall back to the outer
                `overflow-x-auto` scroll when the viewport is genuinely too
                narrow for that 200px floor, instead of scrolling at every
                ordinary desktop width the way 5 rigid 240px columns used to.
                Deliberately flexbox, not a CSS Grid `minmax(200px,1fr)` track
                set — that combination produced a real "Maximum update depth
                exceeded" loop, almost certainly dnd-kit's own ResizeObserver-
                based rect measurement fighting with grid's subpixel track
                resolution on every layout pass. Flexbox's `flex-basis`/
                `flex-grow` sizing gives the same "share available space, floor
                at 200px" result without that failure mode. */}
            <DndContext
              id="tracker-board"
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              // Escape mid-drag never reaches onDragEnd — without this the
              // overlay card sticks around after a cancelled drag.
              onDragCancel={() => setActiveCard(null)}>
              {/* items-stretch so every column is the full height of the
                  row and its own card list is what scrolls. The horizontal
                  bar is the system's slim black one. */}
              <div className="flex flex-1 min-h-0 gap-6 items-stretch overflow-x-auto overflow-y-hidden pb-2 scrollbar-neo">
                {columns.map((col) => (
                  <KanbanColumn key={col.id} column={col} onOpen={openTimeline} />
                ))}
              </div>

              <DragOverlay>
                {activeCard ? (
                  <div className="w-[240px] rotate-2 cursor-grabbing">
                    <TrackerCardItem card={activeCard} columnId={findColumnIdForCard(activeCard.id, columns) ?? undefined} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </>
        ) : view === "table" ? (
          <TrackerTableView columns={columns} onMove={moveCard} onOpen={openTimeline} />
        ) : (
          <TrackerCalendarView columns={columns} onMove={moveCard} onOpen={openTimeline} />
        )}
      </main>

      <JobTimelineDialog
        card={openEntry?.card ?? null}
        columnId={openEntry?.columnId ?? null}
        onOpenChange={(v) => !v && setOpenCardId(null)}
        onMove={moveCard}
      />
      <JobPickerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        jobs={jobs}
        onPick={addJob}
        onCreate={(input) => {
          const created = createPastedJob(input);
          setJobs((prev) => [created, ...prev]);
          addJob(created);
        }}
      />
    </div>
  );
};

export default TrackerClient;
