import type { FC } from "react";
import type { ChromeId } from "@/app/lib/dashboard/resume/design-types";
import type { ChromeProps } from "./types";
import PlainChrome from "./PlainChrome";
import BandTopChrome from "./BandTopChrome";
import SidebarFillChrome from "./SidebarFillChrome";
import HeaderBlockChrome from "./HeaderBlockChrome";
import RuleFrameChrome from "./RuleFrameChrome";

export type { ChromeProps } from "./types";
export { PlainChrome, BandTopChrome, SidebarFillChrome, HeaderBlockChrome, RuleFrameChrome };

/**
 * Closed lookup from `ChromeId` to its component — the ONE place that maps
 * the union to JSX, so ResumePaper never needs an if/switch and adding a 6th
 * chrome (if that ever happens) is a one-line addition here plus a new union
 * member, not a scattered set of call-site branches.
 */
export const CHROME_COMPONENTS: Record<ChromeId, FC<ChromeProps>> = {
  plain: PlainChrome,
  "band-top": BandTopChrome,
  "sidebar-fill": SidebarFillChrome,
  "header-block": HeaderBlockChrome,
  "rule-frame": RuleFrameChrome,
};
