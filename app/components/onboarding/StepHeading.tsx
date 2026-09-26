import type { FC, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A step's number (a check once it is done), its title, a status pill and one line on why. The pill
 * says "Needed" for a step the checklist counts and "Optional" for one it doesn't (the resume).
 */
const StepHeading: FC<{ n: number; id: string; title: string; done: boolean; doneLabel: string; optional?: boolean; blurb: ReactNode; action?: ReactNode }> = ({
  n,
  id,
  title,
  done,
  doneLabel,
  optional = false,
  blurb,
  action,
}) => (
  <div className="flex items-start gap-3.5">
    <span
      aria-hidden
      className={cn(
        "grid h-9 w-9 flex-none place-content-center rounded-full border-[1.5px] border-primary text-sm font-bold tabular-nums",
        done ? "bg-secondary text-primary" : "bg-white text-primary",
      )}>
      {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 id={id} className="text-lg font-bold tracking-tight text-primary md:text-xl">
          {title}
        </h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]",
            done ? "bg-secondary text-primary" : "border border-primary/25 text-primary/60",
          )}>
          {done ? doneLabel : optional ? "Optional" : "Needed"}
        </span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-primary/60">{blurb}</p>
    </div>
    {action && <div className="flex-none">{action}</div>}
  </div>
);

export default StepHeading;
