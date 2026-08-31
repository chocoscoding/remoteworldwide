"use client";

import { FC, Fragment, useEffect, useRef, useState } from "react";
import { Award, ChevronDown } from "lucide-react";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { COLUMN_META } from "@/app/components/dashboard/tracker/tracker-meta";
import type { TrackerColumn } from "@/app/lib/dashboard/types";
import { SortableTrackerCard } from "./TrackerCard";

interface KanbanColumnProps {
  column: TrackerColumn;
  onOpen: (cardId: string) => void;
}

/** A card only counts as reached once most of it is on screen. */
const SEEN_RATIO = 0.6;

/**
 * How many cards are still below the fold of this column's scroller.
 *
 * Live, not derived from data: the old footer showed `count - cards.length`,
 * a fixed number that stayed put no matter how far you scrolled, and sat in
 * the flex flow where it stole height from the scroll area. This watches the
 * cards themselves, so the hint tracks the scroll and reaches zero exactly
 * when the last card is on screen.
 */
function useCardsBelowFold(cardCount: number) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [below, setBelow] = useState(0);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-tracker-card]"));
    if (cards.length === 0) return;

    // A membership set, not a running total: the observer only reports the
    // entries that CHANGED, so incrementing a counter would drift out of sync.
    // The set is rebuilt per effect run, and IntersectionObserver's initial
    // callback reports every target, so the first count is already correct —
    // no setState in the effect body for the compiler to object to.
    const unseen = new Set<Element>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const bounds = entry.rootBounds;
          // Null while the column has no box — a hidden view, or first paint.
          // Skipping leaves the previous verdict rather than guessing.
          if (!bounds) continue;
          const past = entry.boundingClientRect.bottom > bounds.bottom && entry.intersectionRatio < SEEN_RATIO;
          if (past) unseen.add(entry.target);
          else unseen.delete(entry.target);
        }
        setBelow(unseen.size);
      },
      { root, threshold: [0, SEEN_RATIO, 1] }
    );

    cards.forEach((card) => io.observe(card));
    return () => io.disconnect();
  }, [cardCount]);

  function scrollToEnd() {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  return { scrollRef, below, scrollToEnd };
}

/**
 * Where the dragged card would land in this column, or null for no gap.
 *
 * Only opens a gap for a card arriving from ANOTHER column. A card being
 * reordered inside its own column already gets dnd-kit's sortable shuffle,
 * and adding a second hole on top of that reads as two drop targets.
 *
 * `over` is either a column id (the pointer is on empty column space, so the
 * card lands at the end) or a card id (it lands in that card's place).
 */
function landingIndex(
  column: TrackerColumn,
  activeId: string | number | undefined,
  overId: string | number | undefined
): number | null {
  if (activeId == null || overId == null) return null;
  if (column.cards.some((c) => c.id === activeId)) return null;
  if (overId === column.id) return column.cards.length;
  const i = column.cards.findIndex((c) => c.id === overId);
  return i === -1 ? null : i;
}

/** Fallback when the dragged node has not been measured yet. */
const FALLBACK_GAP = 76;

/**
 * The hole a card would drop into. Sized to the card being dragged, so the
 * column opens exactly the space that card will occupy rather than a token
 * sliver. Inline height because it is a runtime measurement, not a token —
 * the same call the ScoreRing makes.
 */
const DropGap: FC<{ height: number }> = ({ height }) => (
  <div
    aria-hidden
    style={{ height }}
    className="flex-none rounded-xl border-[1.5px] border-dashed border-[#222325]/40 bg-[#e1f073]/30"
  />
);

/**
 * One Kanban column — a dnd-kit droppable region wrapping a `SortableContext`
 * of its cards. The cards scroll inside the column; the column itself is
 * sized by the board.
 */
export const KanbanColumn: FC<KanbanColumnProps> = ({ column, onOpen }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const { scrollRef, below, scrollToEnd } = useCardsBelowFold(column.cards.length);

  // Read straight off dnd-kit rather than mirroring the drag into state of our
  // own. `active`/`over`/`activeNodeRect` are plain context values, so the gap
  // is derived during render and nothing this column does can feed back into
  // the drag — which is what made the old `onDragOver` approach loop.
  const { active, over, activeNodeRect } = useDndContext();
  const dropIndex = landingIndex(column, active?.id, over?.id);
  const gapHeight = activeNodeRect?.height ?? FALLBACK_GAP;
  // Hidden mid-drag: the fade is painted in the board's resting colour, and
  // the column swaps to the drop-target fill while a card is over it.
  const hasMore = below > 0 && !isOver;

  return (
    <div className="min-w-[250px] flex-1 flex flex-col min-h-0">
      <div className="flex flex-none items-center gap-2 mb-3 px-0.5">
        <span className={cn("h-2 w-2 rounded-full flex-none", COLUMN_META[column.id].dot)} aria-hidden />
        <span className="text-sm font-bold text-primary whitespace-nowrap">{column.label}</span>
        <span className="text-xs font-semibold text-black/40 ml-auto flex-none">{column.count}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "relative flex flex-1 min-h-0 flex-col rounded-sm transition-colors",
          isOver && "border-[#222325] bg-[#e5e5d8]"
        )}>
        {/* The cards scroll, the column doesn't grow. No visible track here —
            one horizontal bar on the board is enough chrome. */}
        <div ref={scrollRef} className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none p-1">
          <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {column.cards.map((card, i) => (
              <Fragment key={card.id}>
                {dropIndex === i && <DropGap height={gapHeight} />}
                <SortableTrackerCard card={card} columnId={column.id} onOpen={onOpen} />
              </Fragment>
            ))}
            {dropIndex === column.cards.length && <DropGap height={gapHeight} />}
          </SortableContext>

          {column.cards.length === 0 && dropIndex === null && (
            <div className="flex flex-col items-center justify-center text-center gap-2 rounded-xl border border-dashed border-black/15 py-8 px-3">
              <Award className="h-5 w-5 text-black/25" />
              <p className="text-[11px] font-medium text-black/40 leading-relaxed">
                {column.id === "offer" ? "No offers yet — this is where they'll land." : "Nothing here yet."}
              </p>
            </div>
          )}
        </div>

        {/* Overlaid, never in the flow — as a flex sibling this shortened the
            scroller and left the last card permanently under the fade. It
            fades out the moment the last card is on screen, so the bottom of
            the column is reachable and unobstructed. */}
        <div
          aria-hidden={!hasMore}
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-16 transition-opacity duration-200",
            hasMore ? "opacity-100" : "opacity-0"
          )}>
          <div className="absolute inset-0 bg-gradient-to-t from-[#f6f6f6] via-[#f6f6f6]/80 to-transparent" />
          <button
            type="button"
            onClick={scrollToEnd}
            tabIndex={hasMore ? 0 : -1}
            className={cn(
              "absolute bottom-1 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border-[1.5px] border-[#222325] bg-white px-2.5 py-1 text-[10px] font-bold text-primary shadow-[2px_2px_0_0_#222325] transition-shadow duration-100 ease-out hover:shadow-[3px_3px_0_0_#222325]",
              hasMore ? "pointer-events-auto cursor-pointer" : "pointer-events-none"
            )}>
            +{below} more
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
