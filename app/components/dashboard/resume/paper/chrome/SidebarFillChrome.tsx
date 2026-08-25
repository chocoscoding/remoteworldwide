import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { ChromeProps } from "./types";

/**
 * FlowCV puts name/photo/contact INSIDE the filled sidebar, stacked above the
 * side-column sections, with the main column filling the remaining white
 * area — this is the shape spec §5 sketched, extended with the `header` slot
 * (see chrome/types.ts). The sidebar bleeds to the paper edge via negative
 * margins equal to the paper's own padding, then reapplies that padding
 * internally.
 *
 * Known limitation: `min-h-full` only resolves against a parent with a
 * DEFINITE height. ResumePaper's root sets `min-height` (via `--r-page-h`),
 * not `height`, so per spec a child's `height: 100%` isn't guaranteed to
 * resolve against it — worst case the fill hugs the sidebar's own content
 * height rather than stretching to match a taller main column. Pixel-accurate
 * page geometry is chunk A4's job; follows the spec-sanctioned structure as
 * given rather than guessing at a fix.
 *
 * Same contrast bug as `BandTopChrome`/`HeaderBlockChrome`, now fixed here
 * too: `text-[color:var(--r-side-fg)]` on the wrapper alone does nothing —
 * `HeaderBlock`'s text nodes each set their own `color` from a specific
 * `--r-c-*` var or the flat `--r-text-muted`, never inherited `color`. When
 * the sidebar is genuinely filled (`colors.area === "full"`, the condition
 * `--r-side-bg` itself already keys off in `design-to-css.ts`), those vars
 * are overridden to `--r-side-fg` — the correctly-computed contrast color for
 * *this* fill, not `--r-on-accent` (that one's paired with `--r-band-bg`,
 * the top-band fill, which can differ from the sidebar fill under Multi
 * color mode). Static arbitrary-property classes, not `style={}` — see that
 * file's comment for why that distinction matters here.
 */
const SidebarFillChrome: FC<ChromeProps> = ({ design, header, children, side }) => (
  <div className="flex min-h-full -mx-[var(--r-mx)] -my-[var(--r-my)]">
    <aside
      className={cn(
        "flex w-[var(--r-side-w)] flex-none flex-col gap-[var(--r-gap)] bg-[color:var(--r-side-bg)] px-[var(--r-mx)] py-[var(--r-my)] text-[color:var(--r-side-fg)]",
        design.colors.area === "full" &&
          "[--r-c-name:var(--r-side-fg)] [--r-c-title:var(--r-side-fg)] [--r-c-header-icon:var(--r-side-fg)] [--r-c-link-icon:var(--r-side-fg)] [--r-text-muted:var(--r-side-fg)] [--r-c-heading:var(--r-side-fg)] [--r-c-heading-rule:var(--r-side-fg)] [--r-c-bullet:var(--r-side-fg)] [--r-c-date:var(--r-side-fg)] [--r-c-subtitle:var(--r-side-fg)]"
      )}>
      {header}
      {side}
    </aside>
    <div className="min-w-0 flex-1 px-[var(--r-mx)] py-[var(--r-my)]">{children}</div>
  </div>
);

export default SidebarFillChrome;
