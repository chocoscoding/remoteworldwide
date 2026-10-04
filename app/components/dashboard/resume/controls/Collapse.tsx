import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Animates its children open and shut, for every collapsing part of the
 * resume editor (owner, 2026-10-04): the Content sections, an entry opening
 * into its editing card, the rail's fix list and fix cards.
 *
 * The same `grid-template-rows: 0fr → 1fr` transition as `CollapsibleGroup`,
 * so it reaches the content's natural height with nothing measured. The
 * content fades with it. It stays mounted while shut, `inert` so nothing in
 * it takes focus or reaches a screen reader, and clips while it moves, so
 * padding belongs inside `children`, never on this.
 */
export interface CollapseProps {
  open: boolean;
  children: ReactNode;
}

const Collapse: FC<CollapseProps> = ({ open, children }) => (
  <div
    className={cn(
      "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
      open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
    )}>
    <div
      inert={!open}
      className={cn("min-h-0 overflow-hidden transition-opacity duration-300 ease-out motion-reduce:transition-none", open ? "opacity-100" : "opacity-0")}>
      {children}
    </div>
  </div>
);

export default Collapse;
