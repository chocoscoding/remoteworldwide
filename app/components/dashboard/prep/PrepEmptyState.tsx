import { FC, ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import EmptyStateLottie from "@/app/components/dashboard/ui/EmptyStateLottie";
import { BUTTON_SOLID, PANEL } from "./prep-styles";

/**
 * Shared empty-state card — the same {icon, title, body, cta} shape repeats
 * across the Index (nothing scheduled) and three Hub tabs (no panel, no
 * questions, no sessions yet).
 *
 * Deliberately the flat PANEL tier, never RAISED: an empty state is the
 * absence of the thing, so it shouldn't pull more attention than the real
 * content it stands in for.
 */
export interface PrepEmptyStateProps {
  /** The quiet default. Ignored when `lottieSrc` is set. */
  icon?: LucideIcon;
  /** Public path to a Lottie shown instead of the icon circle — the page-level
   *  "nothing scheduled" state earns the animated figure; in-panel tabs stay quiet. */
  lottieSrc?: string;
  title: string;
  body: ReactNode;
  ctaLabel?: string;
  /** Use for an in-place action (research the panel, start a session). */
  onCta?: () => void;
  /** Use instead of `onCta` to navigate elsewhere (e.g. the tracker) — an
   * empty state should never be a dead end even when there's nothing this
   * screen itself can do about it. */
  ctaHref?: string;
  ctaBusy?: boolean;
  /** Drops the border/background, for use inside a panel that already has one. */
  bare?: boolean;
  className?: string;
}

const PrepEmptyState: FC<PrepEmptyStateProps> = ({ icon: Icon, lottieSrc, title, body, ctaLabel, onCta, ctaHref, ctaBusy, bare, className }) => (
  <div className={cn(bare ? "" : PANEL, "px-6 flex flex-col items-center text-center", lottieSrc ? "gap-2 py-6" : "gap-3.5 py-10", className)}>
    {lottieSrc ? (
      <EmptyStateLottie src={lottieSrc} />
    ) : (
      Icon && (
        <span className="h-12 w-12 rounded-full bg-[#f0f0ea] flex items-center justify-center">
          <Icon className="h-4.5 w-4.5 text-black/40" />
        </span>
      )
    )}
    <div>
      <p className="text-sm font-bold text-primary mb-1">{title}</p>
      <p className="text-sm text-black/50 max-w-sm mx-auto leading-relaxed">{body}</p>
    </div>
    {ctaLabel && onCta && (
      <button type="button" onClick={onCta} disabled={ctaBusy} className={cn(BUTTON_SOLID, "disabled:opacity-50 disabled:pointer-events-none")}>
        {ctaBusy ? "Working…" : ctaLabel}
      </button>
    )}
    {ctaLabel && ctaHref && !onCta && (
      <Link href={ctaHref} className={BUTTON_SOLID}>
        {ctaLabel}
      </Link>
    )}
  </div>
);

export default PrepEmptyState;
