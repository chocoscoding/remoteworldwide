"use client";

import { FC, useEffect, useRef, useState, type ReactNode } from "react";
import { Bold, Italic, List, ListOrdered, Redo2, Underline, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small rich-text editor for documents the user actually writes in.
 *
 * Uncontrolled by design: a `contenteditable` driven by React state fights
 * the caret on every keystroke, so React owns the element's *identity* and
 * the DOM owns its content. `docKey` is the seam — change it (a new tone, a
 * new draft) and the editor reloads from `initialHtml`; leave it alone and
 * typing is never interrupted.
 *
 * Formatting uses `document.execCommand`. It is formally deprecated and has
 * no replacement with comparable browser support; swapping in a real editor
 * (Lexical, TipTap) means replacing `exec()` and the toolbar below, and
 * nothing else on the page.
 */
export interface RichTextEditorProps {
  /** Initial HTML. Re-applied whenever `docKey` changes. */
  initialHtml: string;
  /** Change this to load different content into the editor. */
  docKey: string;
  onChange?: (payload: { html: string; text: string }) => void;
  /** Rendered to the left of the formatting buttons, in the same bar. */
  toolbarLeading?: ReactNode;
  /** Non-editable block rendered on the page itself, above the editable body
   *  — a letterhead lives here so it reads as part of the document. */
  pageHeader?: ReactNode;
  /** Classes for the page surface — theme background/border treatments. */
  surfaceClassName?: string;
  /** Classes for the editable body — fonts, spacing, marker styles. */
  contentClassName?: string;
  ariaLabel?: string;
  className?: string;
}

type Cmd = "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList" | "undo" | "redo";

const TOOLS: { cmd: Cmd; icon: typeof Bold; label: string; group: number }[] = [
  { cmd: "bold", icon: Bold, label: "Bold", group: 0 },
  { cmd: "italic", icon: Italic, label: "Italic", group: 0 },
  { cmd: "underline", icon: Underline, label: "Underline", group: 0 },
  { cmd: "insertUnorderedList", icon: List, label: "Bulleted list", group: 1 },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Numbered list", group: 1 },
  { cmd: "undo", icon: Undo2, label: "Undo", group: 2 },
  { cmd: "redo", icon: Redo2, label: "Redo", group: 2 },
];

/** Commands whose on/off state is worth reflecting in the toolbar. */
const STATEFUL: Cmd[] = ["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList"];

const RichTextEditor: FC<RichTextEditorProps> = ({
  initialHtml,
  docKey,
  onChange,
  toolbarLeading,
  pageHeader,
  surfaceClassName,
  contentClassName,
  ariaLabel = "Document body",
  className,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});

  // Load content only when the document identity changes — never on every
  // keystroke, which would reset the caret to the start of the field.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== initialHtml) el.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  function emit() {
    const el = ref.current;
    if (!el || !onChange) return;
    onChange({ html: el.innerHTML, text: el.innerText });
  }

  function refreshActive() {
    if (typeof document === "undefined") return;
    const next: Record<string, boolean> = {};
    for (const cmd of STATEFUL) {
      try {
        next[cmd] = document.queryCommandState(cmd);
      } catch {
        next[cmd] = false;
      }
    }
    setActive(next);
  }

  function exec(cmd: Cmd) {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand(cmd);
    } catch {
      // Nothing sensible to fall back to — the surface stays editable either way.
    }
    refreshActive();
    emit();
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-center gap-2 rounded-t-2xl border border-b-0 border-black/10 bg-[#fbfbf7] px-3 py-2">
        {toolbarLeading}

        <div className="ml-auto flex items-center gap-0.5">
          {TOOLS.map((t, i) => {
            const prev = TOOLS[i - 1];
            const isOn = active[t.cmd];
            return (
              <span key={t.cmd} className="flex items-center">
                {prev && prev.group !== t.group && <span aria-hidden className="mx-1.5 h-4 w-px bg-black/12" />}
                <button
                  type="button"
                  // Keep the selection: mousedown would blur the editor first,
                  // and the command would apply to nothing.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec(t.cmd)}
                  aria-label={t.label}
                  aria-pressed={STATEFUL.includes(t.cmd) ? Boolean(isOn) : undefined}
                  title={t.label}
                  className={cn(
                    "grid h-7 w-7 place-content-center rounded-md cursor-pointer transition-colors",
                    isOn ? "bg-[#222325] text-white" : "text-black/50 hover:bg-black/[0.06] hover:text-primary"
                  )}>
                  <t.icon className="h-3.5 w-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {/* The page: header (if any) and body share one surface, so a
          letterhead reads as part of the document rather than a note about it. */}
      <div className={cn("rounded-b-2xl border border-black/10 overflow-hidden", surfaceClassName)}>
        {pageHeader}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          onInput={emit}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          onFocus={refreshActive}
          className={cn(
            "min-h-[320px] px-8 py-7 outline-none",
            "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5",
            contentClassName
          )}
        />
      </div>
    </div>
  );
};

export default RichTextEditor;
