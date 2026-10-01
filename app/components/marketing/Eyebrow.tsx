import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The small pill over a section heading on /pricing and /waitlist: flat, on a hairline, with a
 * tiny lime square in an ink outline as the brand mark. Pass `dot` to swap the square for
 * something else, such as a live pulse.
 */
const Eyebrow: FC<{ children: ReactNode; dot?: ReactNode; className?: string }> = ({ children, dot, className }) => (
  <span className={cn("inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white px-3 py-1 text-xs font-semibold text-primary/80", className)}>
    {dot ?? <span className="h-2 w-2 flex-none rounded-[3px] border border-primary bg-secondary" aria-hidden />}
    {children}
  </span>
);

export default Eyebrow;
