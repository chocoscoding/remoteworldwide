"use client";

import { FC, TextareaHTMLAttributes, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A textarea that fits its content: a two-line note takes two lines, a long
 * letter takes the space it needs. No inner scrollbar, no dead space.
 *
 * Height is measured in an effect keyed on `value` (not just onInput) because
 * the content can change without a keystroke — e.g. the draft panel's
 * full/short toggle swaps the whole text. Inline height is unavoidable here:
 * it's a runtime measurement, not a design token.
 */
export interface AutoGrowTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Floor, in rows — the box never collapses below this. */
  minRows?: number;
}

const AutoGrowTextarea: FC<AutoGrowTextareaProps> = ({ value, minRows = 3, className, ...rest }) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Collapse first so shrinking content shrinks the box too.
    el.style.height = "auto";
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + border}px`;
  }, [value]);

  return <textarea ref={ref} value={value} rows={minRows} className={cn("resize-none overflow-hidden", className)} {...rest} />;
};

export default AutoGrowTextarea;
