"use client";

import type { FC } from "react";
import { Redo2, Undo2 } from "lucide-react";
import type { BlogSaveStatus } from "./useBlogAutosave";

const STATUS_TEXT: Record<BlogSaveStatus["kind"], string> = {
  idle: "Not saved yet",
  saving: "Saving…",
  saved: "Saved to draft",
  error: "Couldn't save",
};

const ICON_BTN = "inline-flex h-7 w-7 items-center justify-center rounded-full text-[#222325] transition-colors hover:bg-[#f1f1ee] disabled:opacity-30 disabled:hover:bg-transparent";

/** Undo, redo and the save state, pinned to the top centre of the screen while the editor scrolls. */
const BlogEditPill: FC<{
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  status: BlogSaveStatus;
  onRetry: () => void;
  savedLabel?: string;
}> = ({ canUndo, canRedo, onUndo, onRedo, status, onRetry, savedLabel }) => (
  <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4">
    <div className="pointer-events-auto flex items-center gap-1 br-shadow rounded-full bg-white py-1 pl-1 pr-3" data-blog-pill>
      <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)" className={ICON_BTN}>
        <Undo2 className="h-4 w-4" />
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" className={ICON_BTN}>
        <Redo2 className="h-4 w-4" />
      </button>
      <span aria-hidden className="mx-1 h-4 w-px bg-[#222325]/20" />
      <span role="status" aria-live="polite" className={`whitespace-nowrap text-[11px] font-semibold ${status.kind === "error" ? "text-[#b23c26]" : "text-[#222325]/60"}`}>
        {status.kind === "saved" && savedLabel ? savedLabel : STATUS_TEXT[status.kind]}
      </span>
      {status.kind === "error" && (
        <button type="button" onClick={onRetry} title={status.message} className="ml-1 text-[11px] font-bold text-[#222325] underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  </div>
);

export default BlogEditPill;
