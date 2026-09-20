"use client";

// The bullet list under one Experience entry — one row per bullet, behaving
// like an outliner rather than a stack of unrelated boxes: Enter splits the
// bullet at the caret into a new row, Backspace in an empty row folds it back
// into the one above, and pasting several lines lands as several bullets
// (which is how a bullet list arrives from an old resume or a doc).
//
// `bullets` is a plain `string[]` with no ids, so rows are addressed by array
// index, same as `LinksEditor`. An empty row is a real empty string in the
// content while it is being typed into; the paper skips blank bullets
// (`EntryBullets`), so it never reaches the page.

import { useEffect, useRef, type FC, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELD_CLASS, FIELD_TONE } from "./FormField";

export interface BulletsEditorProps {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  isActive?: boolean;
}

// A pasted list brings its own markers ("• Shipped…", "- Led…"); the paper
// draws the glyph, so a marker kept in the text would print twice. The
// trailing whitespace is required so "-5% churn" keeps its minus sign.
const LEADING_MARKER = /^\s*[•●◦▪■*\-–—]\s+/;

const BulletsEditor: FC<BulletsEditorProps> = ({ bullets, onChange, isActive = false }) => {
  const rowRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  // Where the caret should land once the rows for the NEXT render exist — a
  // row added by this keystroke has no element to focus until React commits it.
  const pendingFocus = useRef<{ index: number; caret: "start" | "end" } | null>(null);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    const el = rowRefs.current[pending.index];
    if (!el) return;
    el.focus();
    const at = pending.caret === "start" ? 0 : el.value.length;
    el.setSelectionRange(at, at);
  });

  const replace = (index: number, next: string[]) => onChange([...bullets.slice(0, index), ...next, ...bullets.slice(index + 1)]);

  const handleChange = (index: number, value: string) => {
    if (!/[\r\n]/.test(value)) {
      replace(index, [value]);
      return;
    }
    // Only a paste gets a newline this far — Enter is taken in `handleKeyDown`.
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.replace(LEADING_MARKER, "").trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    replace(index, lines);
    pendingFocus.current = { index: index + lines.length - 1, caret: "end" };
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLTextAreaElement>) => {
    // An Enter that confirms an IME composition is the input method's, not ours.
    if (event.nativeEvent.isComposing) return;
    const el = event.currentTarget;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      // Nothing to split off an empty row — a second empty one helps nobody.
      if (!el.value.trim()) return;
      const before = el.value.slice(0, el.selectionStart).trimEnd();
      const after = el.value.slice(el.selectionEnd).trimStart();
      replace(index, [before, after]);
      pendingFocus.current = { index: index + 1, caret: "start" };
      return;
    }

    if (event.key === "Backspace" && el.value === "" && bullets.length > 1) {
      event.preventDefault();
      replace(index, []);
      pendingFocus.current = { index: Math.max(0, index - 1), caret: "end" };
    }
  };

  const add = () => {
    onChange([...bullets, ""]);
    pendingFocus.current = { index: bullets.length, caret: "end" };
  };

  return (
    <div className="flex flex-col gap-1.5">
      {bullets.map((bullet, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span aria-hidden className="w-2 flex-none pt-1.5 text-center text-sm leading-relaxed text-black/45">
            •
          </span>
          <textarea
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            value={bullet}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            placeholder="What you did, and what it changed"
            aria-label={`Bullet ${i + 1}`}
            // `field-sizing` grows the row with its text, so a one-line bullet
            // is one line tall. Where it is unsupported the row stays at
            // `rows` and scrolls, which is how the other textareas behave.
            rows={2}
            className={cn(
              FIELD_CLASS,
              "min-w-0 flex-1 resize-none rounded-md leading-relaxed [field-sizing:content] [scrollbar-width:none] hover:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden hover:[&::-webkit-scrollbar]:block",
              isActive ? FIELD_TONE.active : FIELD_TONE.idle,
            )}
          />
          <button
            type="button"
            onClick={() => replace(i, [])}
            aria-label={`Remove bullet ${i + 1}`}
            className="mt-0.5 grid h-6 w-6 flex-none place-content-center rounded-md border border-black/30 bg-white text-black/50 transition-all hover:border-[#222325] hover:bg-[#222325] hover:text-white hover:shadow-[2px_2px_0_0_#e1f073] cursor-pointer">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 self-start rounded-lg px-1.5 py-1 text-xs font-semibold text-black/55 transition-colors hover:text-primary cursor-pointer">
        <Plus className="h-3.5 w-3.5" />
        Add a bullet
      </button>
    </div>
  );
};

export default BulletsEditor;
