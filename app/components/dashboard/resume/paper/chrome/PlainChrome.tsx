import type { FC } from "react";
import type { ChromeProps } from "./types";

/**
 * The base "basic corporate" shell (spec §8): header full-width at top, no
 * fill, then main/side content below in a simple flex row when a side column
 * exists. Every color var this could reference (`--r-band-bg`, `--r-side-bg`,
 * `--r-border-c`) stays unused here on purpose — "plain" means no chrome fill
 * at all, regardless of what the Colors panel's application-area is set to.
 */
const PlainChrome: FC<ChromeProps> = ({ header, children, side }) => (
  <div className="flex flex-col gap-[var(--r-gap)]">
    {header}
    {side ? (
      <div className="flex gap-[var(--r-gap)]">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="w-[var(--r-side-w)] flex-none">{side}</div>
      </div>
    ) : (
      children
    )}
  </div>
);

export default PlainChrome;
