import { ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Primary CTA button for the Job Seeker Dashboard: flat at rest, a hard
 * "sticker" shadow on hover, pressed into it on click — the site's
 * `br-plain-press` (app/globals.css).
 */
const stickerButtonVariants = cva(
  "br-plain-press inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[#222325] text-white",
        secondary: "bg-[#e1f073] text-[#222325]",
        outline: "border-[rgba(34,35,37,.18)] bg-white text-[#222325]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
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

/** The br-* shadow colour for each choice; the faint white has no named class of its own. */
const STICKER_SHADOW_COLOR: Record<StickerShadowColor, string> = {
  "#e1f073": "br-lime",
  "#ffffff": "br-white",
  "rgba(255,255,255,.3)": "[--br-c:rgba(255,255,255,0.3)]",
};

export interface StickerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof stickerButtonVariants> {
  shadowColor?: StickerShadowColor;
}

const StickerButton = forwardRef<HTMLButtonElement, StickerButtonProps>(
  ({ className, variant, size, shadowColor = "#e1f073", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(stickerButtonVariants({ variant, size }), STICKER_SHADOW_COLOR[shadowColor], className)}
        {...props}
      />
    );
  },
);
StickerButton.displayName = "StickerButton";

export default StickerButton;
export { stickerButtonVariants };
