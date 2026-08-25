import { ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Primary CTA button for the Job Seeker Dashboard. Hover state renders a
 * flat "sticker" shadow (offset box-shadow + slight translate) instead of a
 * blur/elevation shadow — mirrors the `brutalist-accent` treatment already
 * used in `components/ui/button.tsx`, but as its own cva component per the
 * dashboard's design spec.
 */
const stickerButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap cursor-pointer transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[#222325] text-white",
        secondary: "bg-[#e1f073] text-[#222325]",
        outline: "border-[1.5px] border-[rgba(34,35,37,.18)] bg-white text-[#222325] hover:border-[#222325]",
      },
      size: {
        sm: "h-8 px-3 text-xs hover:-translate-x-px hover:-translate-y-px",
        md: "h-10 px-4 text-sm hover:-translate-x-px hover:-translate-y-px",
        lg: "h-12 px-6 text-base hover:-translate-x-[2px] hover:-translate-y-[2px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

/**
 * The sticker-shadow color. Defaults to the brand lime. On dark/primary
 * surfaces (e.g. a StickerButton sitting inside a `bg-[#222325]` card), pass
 * `"#ffffff"` or `"rgba(255,255,255,.3)"` so the shadow reads against the
 * dark background instead of disappearing.
 *
 * Implemented as a small closed set (rather than an arbitrary string) so
 * every possible class is written out literally below and picked up by
 * Tailwind's static build-time scan — no inline styles required.
 */
export type StickerShadowColor = "#e1f073" | "#ffffff" | "rgba(255,255,255,.3)";

const STICKER_SHADOW_HOVER: Record<StickerShadowColor, Record<"sm" | "md" | "lg", string>> = {
  "#e1f073": {
    sm: "hover:shadow-[3px_3px_0_0_#e1f073]",
    md: "hover:shadow-[4px_4px_0_0_#e1f073]",
    lg: "hover:shadow-[5px_5px_0_0_#e1f073]",
  },
  "#ffffff": {
    sm: "hover:shadow-[3px_3px_0_0_#ffffff]",
    md: "hover:shadow-[4px_4px_0_0_#ffffff]",
    lg: "hover:shadow-[5px_5px_0_0_#ffffff]",
  },
  "rgba(255,255,255,.3)": {
    sm: "hover:shadow-[3px_3px_0_0_rgba(255,255,255,.3)]",
    md: "hover:shadow-[4px_4px_0_0_rgba(255,255,255,.3)]",
    lg: "hover:shadow-[5px_5px_0_0_rgba(255,255,255,.3)]",
  },
};

export interface StickerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof stickerButtonVariants> {
  /** Sticker-shadow color on hover. Defaults to the brand lime `#e1f073`. */
  shadowColor?: StickerShadowColor;
}

const StickerButton = forwardRef<HTMLButtonElement, StickerButtonProps>(
  ({ className, variant, size, shadowColor = "#e1f073", type = "button", ...props }, ref) => {
    const resolvedSize = size ?? "md";
    return (
      <button
        ref={ref}
        type={type}
        className={cn(stickerButtonVariants({ variant, size }), STICKER_SHADOW_HOVER[shadowColor][resolvedSize], className)}
        {...props}
      />
    );
  }
);
StickerButton.displayName = "StickerButton";

export default StickerButton;
export { stickerButtonVariants };
