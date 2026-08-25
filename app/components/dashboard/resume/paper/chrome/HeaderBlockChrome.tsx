import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { ChromeProps } from "./types";

/**
 * Like BandTopChrome, but the band is a CONTAINED, inset rounded/bordered
 * block rather than a full-bleed strip — gives the gallery a 4th, visually
 * distinct option instead of a near-duplicate of band-top. The neutral
 * `--r-rule` border keeps the block legible as "a block" even when Colors >
 * Application area isn't set to "header" (i.e. `--r-band-bg` is transparent
 * and there's no fill to define its edges).
 *
 * Same fix as `BandTopChrome`: `text-[color:var(--r-on-accent)]` alone is
 * inert since `HeaderBlock`'s text nodes each set their own `--r-c-*`-sourced
 * color (or, for the contact-line text itself, the flat `--r-text-muted`,
 * not an accent target) rather than inherited `color` — see that file's
 * comment for the full reasoning. Only overridden when the block is
 * genuinely filled.
 */
const HeaderBlockChrome: FC<ChromeProps> = ({ design, header, children, side }) => (
  <div className="flex flex-col gap-[var(--r-gap)]">
    <div
      className={cn(
        "rounded-xl border border-[color:var(--r-rule)] bg-[color:var(--r-band-bg)] px-[var(--r-gap)] py-[var(--r-gap)] text-[color:var(--r-on-accent)]",
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

export default HeaderBlockChrome;
