"use client";

// Customize tab's right rail — one DashCard per A3a `CUSTOMIZE_PANELS` entry.
// Per A3a's own contract, `panel.Component` renders ONLY its controls (no
// title chrome), so the card header (`panel.label`) is this chunk's
// responsibility. Refs are collected into a caller-owned map (rather than 14
// individual `useRef`s) since the panel list is data, not a fixed set of
// named slots — `registerRef` is a callback ref assigned per card.

import type { FC } from "react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import { CUSTOMIZE_PANELS, UndoRedoBar } from "@/app/components/dashboard/resume/customize";

export interface CustomizePanelsRailProps {
  flashItem: string | null;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

const 
CustomizePanelsRail: FC<CustomizePanelsRailProps> = ({ flashItem, registerRef }) => (
  <div className="scrollbar-neo flex flex-col gap-4 max-h-[calc(100vh-112px)] overflow-y-auto pr-1">
    {CUSTOMIZE_PANELS.map((panel) => (
      <div
        key={panel.id}
        ref={(el) => registerRef(panel.id, el)}
        className={cn(
          "rounded-2xl transition-shadow duration-300",
          flashItem === panel.id && "ring-2 ring-secondary ring-offset-4 ring-offset-[#f6f6f6]"
        )}>
        <DashCard className="border-2 border-[#222325] p-3.5 flex flex-col gap-3">
          <p className="text-[13px] font-bold text-primary">{panel.label}</p>
          <panel.Component />
        </DashCard>
      </div>
    ))}

    <div className="sticky bottom-2 flex justify-center pt-2">
      <UndoRedoBar />
    </div>
  </div>
);

export default CustomizePanelsRail;
