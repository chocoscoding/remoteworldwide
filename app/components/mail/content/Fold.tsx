import type { FC, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A folded section: one line (title, and a short summary while closed) that opens to its body.
 * A native <details>, so server pages use it too and it needs no state.
 */
const Fold: FC<{
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** "card": a bordered white panel. "line": just the line, for folds inside a panel. */
  variant?: "card" | "line";
}> = ({ title, summary, defaultOpen, children, className, bodyClassName, variant = "card" }) => (
  <details open={defaultOpen} className={cn("group", variant === "card" ? "rounded-md border border-gray-300 bg-white" : "", className)}>
    <summary
      className={cn(
        "flex cursor-pointer list-none items-center gap-2 text-sm font-bold marker:hidden [&::-webkit-details-marker]:hidden",
        variant === "card" ? "px-4 py-3" : "py-1.5",
      )}>
      <ChevronRight className="h-4 w-4 flex-none text-gray-500 transition-transform group-open:rotate-90" aria-hidden />
      <span>{title}</span>
      {summary ? <span className="min-w-0 truncate text-xs font-normal text-gray-500 group-open:hidden">{summary}</span> : null}
    </summary>
    <div className={cn(variant === "card" ? "border-t border-gray-200 px-4 py-4" : "pb-2 pt-1", bodyClassName)}>{children}</div>
  </details>
);

export default Fold;
