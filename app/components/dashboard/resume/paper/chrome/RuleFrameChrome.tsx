import type { FC } from "react";
import type { ChromeProps } from "./types";

/**
 * Header at top, unfilled, then a full border/rule frame wraps the rest of
 * the page content area. `--r-border-c` resolves to "transparent" unless
 * Colors > Application area is set to "border", so the frame is invisible by
 * default and only appears once that control is chosen — same fill-gating
 * pattern as the other 4 chromes.
 */
const RuleFrameChrome: FC<ChromeProps> = ({ header, children, side }) => (
  <div className="flex flex-col gap-[var(--r-gap)]">
    {header}
    <div className="border border-[color:var(--r-border-c)] p-[var(--r-gap)]">
      {side ? (
        <div className="flex gap-[var(--r-gap)]">
          <div className="min-w-0 flex-1">{children}</div>
          <div className="w-[var(--r-side-w)] flex-none">{side}</div>
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

export default RuleFrameChrome;
