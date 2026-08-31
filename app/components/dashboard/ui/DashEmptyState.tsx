import { FC, ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "./DashCard";
import EmptyStateLottie from "./EmptyStateLottie";
import StickerButton from "./StickerButton";

/**
 * The dashboard-wide empty state. Every screen outside prep was rolling its
 * own; prep keeps its version because that one is coupled to prep-styles.
 *
 * Deliberately the flat DashCard tier — an empty state is the absence of the
 * thing, so it shouldn't carry more weight than the content it stands in for.
 */
export interface DashEmptyStateProps {
  /** The quiet default. Ignored when `lottieSrc` is set. */
  icon?: LucideIcon;
  /**
   * Public path to a Lottie shown above the text instead of the icon circle —
   * for the empty states worth animating, not every absence on the dashboard.
   */
  lottieSrc?: string;
  title: string;
  body: ReactNode;
  ctaLabel?: string;
  /** In-place action. */
  onCta?: () => void;
  /** Navigate instead — an empty state shouldn't dead-end. */
  ctaHref?: string;
  /** Drops the card chrome, for use inside a panel that already has it. */
  bare?: boolean;
  className?: string;
}

const DashEmptyState: FC<DashEmptyStateProps> = ({
  icon: Icon,
  lottieSrc,
  title,
  body,
  ctaLabel,
  onCta,
  ctaHref,
  bare,
  className,
}) => {
  const inner = (
    <>
      {lottieSrc ? (
        <EmptyStateLottie src={lottieSrc} />
      ) : Icon ? (
        <span className="grid h-12 w-12 place-content-center rounded-full bg-[#f0f0ea]">
          <Icon className="h-5 w-5 text-black/40" />
        </span>
      ) : null}
      <div>
        <p className="mb-1 text-sm font-bold text-primary">{title}</p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-black/50">{body}</p>
      </div>
      {ctaLabel && onCta && (
        <StickerButton variant="primary" size="sm" onClick={onCta}>
          {ctaLabel}
        </StickerButton>
      )}
      {ctaLabel && ctaHref && !onCta && (
        <Link href={ctaHref}>
          <StickerButton variant="primary" size="sm" type="button">
            {ctaLabel}
          </StickerButton>
        </Link>
      )}
    </>
  );

  const layout = cn(
    "flex flex-col items-center px-6 text-center",
    // A 200px animation brings its own padding; the icon variant needs the room.
    lottieSrc ? "gap-2 py-6" : "gap-3.5 py-12"
  );
  if (bare) return <div className={cn(layout, className)}>{inner}</div>;
  return <DashCard className={cn("p-0", className)}>{<div className={layout}>{inner}</div>}</DashCard>;
};

export default DashEmptyState;
