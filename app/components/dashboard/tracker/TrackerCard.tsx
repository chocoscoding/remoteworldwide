"use client";

import { FC } from "react";
import Link from "next/link";
import { MoreHorizontal, Mic, Clock } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import LogoMini from "@/app/components/svg/LogoMini";
import { COLUMN_META } from "@/app/components/dashboard/tracker/tracker-meta";
import type { TrackerCard as TrackerCardData, TrackerColumnId } from "@/app/lib/dashboard/types";
import { daysAgoLabel, chipMeta } from "../../../(pages)/(dashboard)/dashboard/tracker/types";

interface TrackerCardItemProps {
  card: TrackerCardData;
  columnId?: TrackerColumnId;
  onOptions?: () => void;
}

/**
 * A single tracker card — shows job application details with optional status chip.
 * Can be highlighted (featured view) or normal (board view).
 */
export const TrackerCardItem: FC<TrackerCardItemProps> = ({ card, columnId, onOptions }) => {
  const daysLabel = daysAgoLabel(card.daysAgo);

  /**
   * The explicit way into a card's details. It sits inside the drag listeners,
   * so pointerdown must be stopped or dnd-kit claims the gesture and the menu
   * never opens. Omitted on the DragOverlay clone, which takes no input.
   */
  const optionsButton = onOptions ? (
    <button
      type="button"
      aria-label={`Options for ${card.title} at ${card.company}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onOptions();
      }}
      className="grid h-6 w-6 flex-none cursor-pointer place-content-center rounded-md text-black/35 transition-colors hover:bg-black/[0.06] hover:text-primary">
      <MoreHorizontal className="h-4 w-4" />
    </button>
  ) : null;

  if (card.highlighted) {
    const [roundLabel, timeLabel] = (card.statusChip ?? "").split(" · ");
    return (
      <div className="rounded-sm border-[1.5px] border-primary bg-white p-3.5 shadow-[4px_4px_0_0_#e1f073]">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {card.rww && <LogoMini className="h-3.5 w-3.5 flex-none" />}
            <span className="text-xs font-semibold text-black/60 truncate">{card.company}</span>
          </div>
          <div className="flex flex-none items-center gap-0.5">
            {daysLabel && <span className="text-[11px] font-medium text-black/35 whitespace-nowrap">{daysLabel}</span>}
            {optionsButton}
          </div>
        </div>

        <p className="text-sm font-bold text-primary leading-snug mb-2.5">{card.title}</p>

        {roundLabel && (
          <Pill variant="dark" className="max-w-full min-w-0 mb-2">
            <span className="truncate min-w-0">{roundLabel}</span>
          </Pill>
        )}

        {timeLabel && (
          <div className="flex items-center gap-1.5 text-xs text-black/55 mb-3 min-w-0">
            <Clock className="h-3.5 w-3.5 flex-none" />
            <span className="truncate min-w-0">{timeLabel}</span>
          </div>
        )}

        {/* Routes to prep, never into the timeline dialog behind it. */}
        <Link href="/dashboard/prep" className="block" onClick={(e) => e.stopPropagation()}>
          <StickerButton variant="primary" size="sm" className="w-full">
            <Mic className="h-3.5 w-3.5" />
            Prep for this
          </StickerButton>
        </Link>
      </div>
    );
  }

  const chip = card.statusChip ? chipMeta(card.statusChip) : null;
  const ChipIcon = chip?.icon;
  const showEngagementBar = card.statusChip?.includes("Recruiter opened") ?? false;
  // Long chips (e.g. "Recruiter opened your resume · 2h ago") are split into a
  // primary label rendered inside the pill (truncated as a safety net so it
  // can never spill past the card edge) and a trailing timestamp rendered
  // underneath as its own small caption, matching the highlighted-card treatment.
  const [chipLabel, chipTime] = (card.statusChip ?? "").split(" · ");

  return (
    // Border carries the column's color, so a card says its stage at a glance.
    <div
      className={cn(
        "rounded-sm border bg-white p-3.5 transition-all hover:outline hover:outline-[#222325] hover:outline-1 ",
        columnId ? COLUMN_META[columnId].cardBorder : "border-black/25",
      )}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {card.rww && <LogoMini className="h-3.5 w-3.5 flex-none" />}
          <span className="text-xs font-semibold text-black/60 truncate">{card.company}</span>
        </div>
        <div className="flex flex-none items-center gap-0.5">
          {daysLabel && <span className="text-[11px] font-medium text-black/35 whitespace-nowrap">{daysLabel}</span>}
          {optionsButton}
        </div>
      </div>

      <p className="text-sm font-semibold text-primary leading-snug">{card.title}</p>

      {card.statusChip && chip && ChipIcon && (
        <div className="mt-2.5">
          <Pill variant={chip.variant} className="max-w-full min-w-0 gap-1">
            <ChipIcon className="h-3 w-3 flex-none" />
            <span className="truncate min-w-0">{chipLabel}</span>
          </Pill>
          {chipTime && (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-black/40 min-w-0">
              <Clock className="h-3 w-3 flex-none" />
              <span className="truncate min-w-0">{chipTime}</span>
            </div>
          )}
          {showEngagementBar && <ProgressBar value={65} height="h-1" className="mt-2" />}
        </div>
      )}
    </div>
  );
};

interface SortableTrackerCardProps {
  card: TrackerCardData;
  columnId: TrackerColumnId;
  onOpen: (cardId: string) => void;
}

/**
 * Draggable/sortable wrapper around a card — adds the grab affordance and
 * the dnd-kit transform/transition needed to animate it while dragging.
 * `transform`/`transition` are the one place this file uses an inline
 * `style` — dnd-kit computes a per-pixel drag offset at runtime, which has
 * no static Tailwind-class equivalent. Every other style here is a Tailwind
 * utility class.
 */
export const SortableTrackerCard: FC<SortableTrackerCardProps> = ({ card, columnId, onOpen }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  // `data-tracker-card` marks this as an observable card for the column's
  // below-the-fold counter. It goes on the wrapper rather than the card body
  // because this is the element the column actually lays out.
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      data-tracker-card=""
      onClick={() => onOpen(card.id)}
      className={cn("touch-none cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}>
      <TrackerCardItem card={card} columnId={columnId} onOptions={() => onOpen(card.id)} />
    </div>
  );
};
