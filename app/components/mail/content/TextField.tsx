"use client";

import { useCallback, useId, useRef, useState, type FC } from "react";
import { Braces } from "lucide-react";
import { TEMPLATE_VARS } from "@/app/lib/mail/types";
import { INPUT } from "../ui";
import { cn } from "@/lib/utils";
import { useDismiss } from "./useDismiss";

/**
 * A labelled text input (or textarea) with a small "Variable" menu that puts {{name}} where the
 * caret was. Short fields show how many characters are left. `lines`: a short text that may break
 * into lines (a heading, an offer line), drawn as a textarea that many rows tall.
 */
const TextField: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  hint?: string;
  vars?: boolean;
  className?: string;
  inputClassName?: string;
  lines?: number;
}> = ({ label, value, onChange, placeholder, maxLength, multiline, hint, vars = true, className, inputClassName, lines }) => {
  const id = useId();
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const caret = useRef<[number, number] | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(menu, open, close);

  const remember = () => {
    const el = field.current;
    if (el && el.selectionStart !== null && el.selectionEnd !== null) caret.current = [el.selectionStart, el.selectionEnd];
  };

  const insert = (name: string) => {
    const token = `{{${name}}}`;
    const [start, end] = caret.current ?? [value.length, value.length];
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    if (maxLength && next.length > maxLength) {
      setOpen(false);
      return;
    }
    onChange(next);
    setOpen(false);
    const at = start + token.length;
    caret.current = [at, at];
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(at, at);
    });
  };

  const left = maxLength && maxLength <= 120 ? maxLength - value.length : null;
  const common = {
    id,
    ref: field,
    value,
    maxLength,
    placeholder,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onSelect: remember,
    onKeyUp: remember,
    onBlur: remember,
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-gray-600">
          {label}
        </label>
        {left !== null && left <= 15 ? <span className={cn("text-[11px] tabular-nums", left <= 0 ? "text-[#b23c26]" : "text-gray-500")}>{left} left</span> : null}
        {vars ? (
          <div ref={menu} className="relative ml-auto">
            <button
              type="button"
              aria-expanded={open}
              aria-haspopup="menu"
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded px-1 text-[11px] font-semibold text-gray-500 hover:text-black">
              <Braces className="h-3 w-3" aria-hidden /> Variable
            </button>
            {open ? <VarMenu onPick={insert} className="right-0" /> : null}
          </div>
        ) : null}
      </div>
      {multiline ? (
        <textarea {...common} rows={5} className={cn(INPUT, "min-h-[110px] font-[inherit] leading-relaxed", inputClassName)} />
      ) : lines ? (
        <textarea {...common} rows={lines} className={cn(INPUT, "resize-y font-[inherit] leading-snug", inputClassName)} />
      ) : (
        <input {...common} className={cn(INPUT, inputClassName)} />
      )}
      {hint ? <p className="text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  );
};

/**
 * The variables as a dropdown: each on its own line with what it becomes under it, so nothing is cut
 * off in a narrow panel. `keepFocus`: pressing an item doesn't take the focus (the canvas keeps its caret).
 */
export const VarMenu: FC<{ onPick: (name: string) => void; className?: string; keepFocus?: boolean }> = ({ onPick, className, keepFocus }) => (
  <div role="menu" className={cn("absolute top-full z-30 mt-1 max-h-[60vh] w-64 overflow-y-auto rounded-md border border-gray-300 bg-white py-1", className)}>
    {TEMPLATE_VARS.map((v) => (
      <button
        key={v.name}
        type="button"
        role="menuitem"
        onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
        onClick={() => onPick(v.name)}
        className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-gray-50">
        <span className="break-all font-mono text-[11px] text-black">{`{{${v.name}}}`}</span>
        <span className="text-[11px] leading-snug text-gray-500">{v.hint}</span>
      </button>
    ))}
  </div>
);

export default TextField;
