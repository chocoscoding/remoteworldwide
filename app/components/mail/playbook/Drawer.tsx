"use client";

import type { FC, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// A right-side panel over a dim backdrop, for what is needed only now and then (the triggers, a
// playbook's rules). Radix runs the dialog part: focus moves into the panel and stays there,
// Escape and a click on the backdrop close it, and focus goes back to what opened it.
// The panel is portalled to <body>, so its inputs are outside any <form> around the opener: a
// form inside it must stop its submit event, because React still bubbles it to that outer form.

const Drawer: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Sticks to the bottom of the panel: the main buttons. */
  footer?: ReactNode;
  className?: string;
}> = ({ open, onOpenChange, title, description, children, footer, className }) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
      <DialogPrimitive.Content
        // No description: say so, or Radix warns. With one, Radix links it itself.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-black bg-white focus:outline-none",
          "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right motion-reduce:animate-none",
          className,
        )}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-base font-bold">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="mt-0.5 text-xs text-gray-500">{description}</DialogPrimitive.Description> : null}
          </div>
          <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md bg-white text-[#222325] br-shadow-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-1">
            <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-5 py-3">{footer}</div> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

export default Drawer;
