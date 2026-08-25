"use client";

import type { FC } from "react";
import { Redo2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useResumeDesign } from "../useResumeDesign";

export interface UndoRedoBarProps {
  /** Positioning is the caller's call (fixed/absolute/etc.) — this only renders the pill itself. */
  className?: string;
}

/** Floating undo/redo pill for the bottom of the Customize column (spec §10). */
const UndoRedoBar: FC<UndoRedoBarProps> = ({ className }) => {
  const { undo, redo, canUndo, canRedo } = useResumeDesign();

  return (
    <div
      className={cn(
        "pointer-events-auto inline-flex items-center gap-1 rounded-full border border-black/10 bg-white p-1 shadow-lg",
        className
      )}>
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        className="grid h-8 w-8 place-content-center rounded-full text-primary transition-colors cursor-pointer hover:bg-[#f0f0ea] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent">
        <Undo2 className="h-4 w-4" />
      </button>
      <div className="h-4 w-px flex-none bg-black/10" />
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        className="grid h-8 w-8 place-content-center rounded-full text-primary transition-colors cursor-pointer hover:bg-[#f0f0ea] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent">
        <Redo2 className="h-4 w-4" />
      </button>
    </div>
  );
};

export default UndoRedoBar;
