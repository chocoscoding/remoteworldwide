"use client";

import { useCallback, useRef, useState, type FC, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDismiss } from "../content/useDismiss";

/** Puts the caret in the panel's first field (else its first button) once, when it opens (a module function, so the ref never changes). */
const focusFirst = (el: HTMLDivElement | null) => {
  if (!el) return;
  const field = el.querySelector<HTMLElement>("input, select, textarea") ?? el.querySelector<HTMLElement>("button");
  field?.focus();
};

/** A small panel under its trigger, closed by a press outside or Escape. */
export const Popover: FC<{
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  label: string;
  align?: "left" | "right";
  className?: string;
  panelClassName?: string;
}> = ({ open, onClose, trigger, children, label, align = "left", className, panelClassName }) => {
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, open, onClose);
  return (
    <div ref={box} className={cn("relative", className)}>
      {trigger}
      {open ? (
        <div
          ref={focusFirst}
          role="dialog"
          aria-label={label}
          className={cn("absolute top-full z-30 mt-1.5 w-max min-w-56 max-w-[min(22rem,calc(100vw-2rem))] rounded-md bg-white p-3 br-shadow", align === "right" ? "right-0" : "left-0", panelClassName)}>
          {children}
        </div>
      ) : null}
    </div>
  );
};

/** A small (i) that shows a sentence on press. */
export const InfoTip: FC<{ label: string; children: ReactNode }> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Popover
      open={open}
      onClose={close}
      label={label}
      panelClassName="text-xs leading-relaxed text-gray-700"
      trigger={
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn("flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:text-black", open && "text-black")}>
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      }>
      {children}
    </Popover>
  );
};
