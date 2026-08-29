"use client";

// Customize tab's left-nav list — data-driven from A3a's `CUSTOMIZE_PANELS`,
// the SAME ordered list `CustomizePanelsRail` maps over for the right rail.
// Building both off one list is what makes left-click -> right-scroll/
// highlight correct by construction instead of a hand-matched pair of arrays
// that can silently drift (as the old screen's did for 6 of its 14 items).

import type { FC } from "react";
import { cn } from "@/lib/utils";
import { CUSTOMIZE_PANELS } from "@/app/components/dashboard/resume/customize";

export interface CustomizeNavProps {
  activeItem: string;
  onSelect: (id: string) => void;
}

const CustomizeNav: FC<CustomizeNavProps> = ({ activeItem, onSelect }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    {CUSTOMIZE_PANELS.map((item) => (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelect(item.id)}
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] cursor-pointer transition-all text-left",
          activeItem === item.id
            ? "bg-[#222325] text-white font-bold shadow-[inset_3px_3px_0_0_rgba(0,0,0,0.4)] translate-x-px translate-y-px"
            : "font-medium text-black/60 hover:bg-[#f6f6f6]"
        )}>
        <item.icon className="h-[15px] w-[15px] flex-none" />
        <span className="truncate">{item.label}</span>
      </button>
    ))}
  </div>
);

export default CustomizeNav;
