import { FC, HTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Small rounded chip/status badge used throughout the dashboard (streak
 * pills, status chips on tracker cards, filter pills, readiness tags, etc).
 * `"active"` and `"dark"` are intentionally identical (both = solid
 * `#222325` / white text) — two names for the same treatment depending on
 * whether the call site is expressing "currently selected" vs "dark chip".
 */
const pillVariants = cva("inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    variant: {
      neutral: "bg-[#f0f0ea] text-[#222325]",
      active: "bg-[#222325] text-white",
      dark: "bg-[#222325] text-white",
      positive: "bg-[#e1f073] text-[#222325]",
      urgent: "bg-[#222325] text-[#e1f073]",
      "outline-dashed": "border border-dashed border-black/25 bg-transparent text-black/50",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

export interface PillProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillVariants> {
  children?: ReactNode;
}

const Pill: FC<PillProps> = ({ className, variant, children, ...rest }) => {
  return (
    <span className={cn(pillVariants({ variant }), className)} {...rest}>
      {children}
    </span>
  );
};

export default Pill;
export { pillVariants };
