"use client";

import { FC, UIEvent, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A textarea that highlights the `{company}` token as you type it.
 *
 * A textarea can't contain styled spans, so this is the standard overlay
 * technique: a mirror div renders the highlighted text underneath, and the
 * real textarea sits on top with transparent text and a visible caret. The two
 * layers MUST share padding, font, size, line-height and wrapping or the
 * highlight drifts away from the glyphs — hence the single `TYPOGRAPHY`
 * constant applied to both, and why neither may be restyled independently.
 *
 * Deep green here, lime chip once rendered: while you're authoring, the
 * highlight marks text that is *not* literal; in the finished answer the lime
 * chip marks what it was replaced with.
 */

/** Capturing group, so `split` keeps the token as its own segment. */
const TOKEN = /(\{company\})/g;

/** Every metric that affects glyph position must be identical on both layers. */
const TYPOGRAPHY = "px-3.5 py-2.5 text-sm leading-relaxed tracking-normal font-sans";

export interface TokenTextareaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  "aria-label"?: string;
  className?: string;
}

const TokenTextarea: FC<TokenTextareaProps> = ({
  id,
  value,
  onChange,
  rows = 4,
  placeholder,
  required,
  className,
  "aria-label": ariaLabel,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Ref write in an event handler, never during render.
  const syncScroll = useCallback((e: UIEvent<HTMLTextAreaElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.scrollTop = e.currentTarget.scrollTop;
    overlay.scrollLeft = e.currentTarget.scrollLeft;
  }, []);

  const segments = value.split(TOKEN).filter((s) => s !== "");

  return (
    <div
      className={cn(
        "relative rounded-lg border border-black/15 bg-white transition-colors focus-within:border-[#222325]",
        className
      )}>
      <div
        ref={overlayRef}
        aria-hidden="true"
        className={cn(
          TYPOGRAPHY,
          "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-primary"
        )}>
        {segments.map((seg, i) =>
          seg === "{company}" ? (
            // PAINT-ONLY styling. No padding, no font-weight, no letter-spacing:
            // anything that changes this span's advance width shifts every
            // character after it in the mirror while the textarea underneath
            // keeps its own metrics, and the two layers visibly separate. The
            // fill hugs the token exactly, which also leaves the neighbouring
            // characters their own space instead of bleeding under them.
            <span key={i} className="rounded-[2px] bg-[#6c7a1e] text-white">
              {seg}
            </span>
          ) : (
            <span key={i}>{seg}</span>
          )
        )}
        {/* A trailing newline has no glyph, so the mirror would collapse a line
            short of the textarea and the last row would scroll out of sync. */}
        {value.endsWith("\n") && " "}
      </div>

      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        rows={rows}
        placeholder={placeholder}
        required={required}
        aria-label={ariaLabel}
        spellCheck
        className={cn(
          TYPOGRAPHY,
          "relative block w-full resize-none bg-transparent text-transparent caret-[#222325] outline-none placeholder:text-black/35"
        )}
      />
    </div>
  );
};

export default TokenTextarea;
