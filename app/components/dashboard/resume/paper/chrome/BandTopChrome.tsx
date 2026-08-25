import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { ChromeProps } from "./types";

/**
 * Header sits inside a full-bleed colored band across the top — negative-
 * margined by exactly the paper's own padding so the fill reaches the true
 * page edge. The band's OWN internal vertical padding is a fifth of that same
 * margin (`--r-my`), not the full margin — reusing the page's outer-margin
 * value verbatim for a banner's internal padding read as far too much dead
 * space above/below a couple of short header lines. Horizontal padding still
 * reuses `--r-mx` unchanged (not flagged, no reason to touch it).
 *
 * The band only shows a visible fill when Colors > Application area is set to
 * "header" (`--r-band-bg` resolves to "transparent" otherwise) — chrome
 * (shape) and the Colors panel (fill) are independent controls by design; see
 * `design-to-css.ts`.
 *
 * `text-[color:var(--r-on-accent)]` on the wrapper alone does nothing: every
 * text node inside `HeaderBlock` sets its own `color` from a specific
 * `--r-c-*` var (`--r-c-name`, `--r-c-title`, …) or from the flat
 * `--r-text-muted` (the contact-line text itself, e.g. the email/phone/
 * location strings — the icons next to them separately read
 * `--r-c-header-icon`, already covered), so nothing actually inherits the
 * wrapper's `color`. When the band is genuinely filled, all of those are
 * overridden here to the same `--r-on-accent` value — otherwise a dark accent
 * (the common case) paints dark text on its own dark band, and even after
 * fixing the name/title fields specifically, the muted contact-line text
 * stayed low-contrast since it was never one of the 9 accent targets to begin
 * with. Static arbitrary-property classes (not `style={}`): the override
 * target is always the literal `var(--r-on-accent)`, never a runtime-computed
 * value.
 */
const BandTopChrome: FC<ChromeProps> = ({ design, header, children, side }) => (
  <div className="flex flex-col gap-[var(--r-gap)]">
    <div
      className={cn(
        "-mx-[var(--r-mx)] -mt-[var(--r-my)] bg-[color:var(--r-band-bg)] px-[var(--r-mx)] py-[calc(var(--r-my)*0.2)] text-[color:var(--r-on-accent)]",
        design.colors.area === "header" &&
          "[--r-c-name:var(--r-on-accent)] [--r-c-title:var(--r-on-accent)] [--r-c-header-icon:var(--r-on-accent)] [--r-c-link-icon:var(--r-on-accent)] [--r-text-muted:var(--r-on-accent)]"
      )}>
      {header}
    </div>
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

export default BandTopChrome;
