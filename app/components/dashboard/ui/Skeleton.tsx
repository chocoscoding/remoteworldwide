// Placeholders for content on its way: the dashboard's skeletons, in place of
// spinners and "Loading…" text (owner, 2026-10-03). The shapes stand in for
// what is coming, in the job picker's tone (`animate-pulse` on #f0f0ea); a
// screen reader hears the label instead.

import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One placeholder block. `dark` for a dark surface. */
export const Bone: FC<{ className?: string; dark?: boolean }> = ({ className, dark = false }) => (
  <span aria-hidden className={cn("block animate-pulse rounded", dark ? "bg-white/10" : "bg-[#f0f0ea]", className)} />
);

/** A region of skeletons: said once to assistive tech, drawn as shapes for everyone else. */
export const Loading: FC<{ label: string; className?: string; children: ReactNode }> = ({ label, className, children }) => (
  <div role="status" aria-busy="true" className={className}>
    <span className="sr-only">{label}</span>
    {children}
  </div>
);

/** Lines of text on their way; the last one runs short, the way a paragraph ends. */
export const LinesSkeleton: FC<{ lines?: number; className?: string; dark?: boolean }> = ({ lines = 3, className, dark }) => (
  <div aria-hidden className={cn("flex flex-col gap-2", className)}>
    {Array.from({ length: lines }, (_, i) => (
      <Bone key={i} dark={dark} className={cn("h-3", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
    ))}
  </div>
);

/** List rows on their way: an icon tile and two lines each. `bordered` for rows that sit in their own boxes. */
export const RowsSkeleton: FC<{ rows?: number; bordered?: boolean; className?: string }> = ({ rows = 3, bordered = true, className }) => (
  <div aria-hidden className={cn("flex flex-col gap-2", className)}>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className={cn("flex items-center gap-3 px-3.5 py-3", bordered && "rounded-md border border-black/8")}>
        <Bone className="h-8 w-8 flex-none rounded-lg" />
        <span className="flex-1 space-y-1.5">
          <Bone className="h-3 w-2/3" />
          <Bone className="h-2.5 w-1/3" />
        </span>
      </div>
    ))}
  </div>
);
