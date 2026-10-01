import type { FC } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The site's one deliberately brutalist tick: an ink check on a small square chip with an ink
 * hairline and a hard 2px offset shadow. Everything around it stays flat (owner, 2026-10-01).
 * `tone="white"` is for lime surfaces, where a lime chip would disappear.
 */
const CheckChip: FC<{ tone?: "lime" | "white"; size?: "sm" | "md"; label?: string; className?: string }> = ({
  tone = "lime",
  size = "md",
  label,
  className,
}) => (
  <span
    className={cn(
      "inline-grid flex-none place-content-center text-primary br-shadow",
      size === "md" ? "h-5 w-5 rounded-[6px]" : "h-[18px] w-[18px] rounded-[5px]",
      tone === "white" ? "bg-white" : "bg-secondary",
      className,
    )}>
    <Check className={size === "md" ? "h-3 w-3" : "h-2.5 w-2.5"} strokeWidth={3.5} aria-hidden />
    {label ? <span className="sr-only">{label}</span> : null}
  </span>
);

export default CheckChip;
