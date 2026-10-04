"use client";

// The board while the applications are on their way (owner, 2026-10-04): the
// nine columns in their real widths and colours, each with a few card-shaped
// placeholders, so the page has its shape from the first frame and nothing
// jumps when the cards land. The stages get more placeholders than the
// outcomes, the way a real board fills. The table and calendar get rows.

import type { FC } from "react";
import { cn } from "@/lib/utils";
import { Bone, Loading, RowsSkeleton } from "@/app/components/dashboard/ui/Skeleton";
import type { BoardColumn } from "./TrackerProvider";
import { BOARD_SCALE, isClosedStatus, statusMeta } from "./tracker-meta";
import { BOARD_COLUMN_CLASS } from "./KanbanColumn";

/** How many card placeholders each stage shows; outcomes show one. Varied, so it reads as a board and not a grid. */
const STAGE_CARDS = [3, 2, 2, 1, 1];

/** One card on its way: the company line, a two-line role, the footer. */
const CardBone: FC = () => (
  <div className="flex flex-col gap-2.5 rounded-sm border border-black/[0.08] bg-white p-3">
    <span className="flex items-center gap-2">
      <Bone className="h-4 w-4 flex-none rounded" />
      <Bone className="h-2.5 w-1/2" />
    </span>
    <span className="flex flex-col gap-1.5">
      <Bone className="h-3.5 w-full" />
      <Bone className="h-3.5 w-2/3" />
    </span>
    <Bone className="h-2.5 w-1/4" />
  </div>
);

export const BoardSkeleton: FC<{ columns: BoardColumn[] }> = ({ columns }) => (
  <Loading label="Loading your applications" className="flex flex-1 min-h-0 items-stretch gap-6 overflow-hidden pb-2 min-[1900px]:gap-5">
    {columns.map((column, i) => {
      const closed = isClosedStatus(column.id);
      const meta = statusMeta(column.id);
      const cards = closed ? 1 : (STAGE_CARDS[i] ?? 1);
      return (
        <div key={column.id} className={BOARD_COLUMN_CLASS}>
          {/* The header is real: the column names are known before anything loads. */}
          <div className={cn("mb-3 flex flex-none items-center gap-2 px-0.5", BOARD_SCALE)}>
            <span className={cn("h-2 w-2 flex-none rounded-full", meta.dot)} aria-hidden />
            <span className={cn("whitespace-nowrap text-sm font-bold", closed ? "text-black/50" : "text-primary")}>{column.label}</span>
            <Bone className="ml-auto h-3 w-3 flex-none" />
          </div>
          <div className={cn("flex flex-col gap-2 p-1", BOARD_SCALE)}>
            {Array.from({ length: cards }, (_, n) => (
              <CardBone key={n} />
            ))}
          </div>
        </div>
      );
    })}
  </Loading>
);

/** The table and calendar while the applications load: rows, not a board. */
export const ListSkeleton: FC = () => (
  <Loading label="Loading your applications">
    <RowsSkeleton rows={6} />
  </Loading>
);

export default BoardSkeleton;
