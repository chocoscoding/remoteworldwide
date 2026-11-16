"use client";

import { useCallback, useRef, useState, type FC, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { BLOCK_LABELS, BLOCK_TYPES, type Block, type BlockType } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import { BLOCK_ICONS, blockSummary } from "./blocks";
import { useDismiss } from "./useDismiss";

/**
 * The mail's blocks as a compact outline beside the canvas: a type icon and the first words. A row
 * selects its block; a slim "+" between rows (and "Add block" at the end) inserts a new one there.
 */
const BlockOutline: FC<{
  blocks: Block[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  onInsert: (at: number, type: BlockType) => void;
  className?: string;
}> = ({ blocks, selected, onSelect, onInsert, className }) => (
  <nav aria-label="Blocks" className={cn("flex flex-col", className)}>
    <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">Blocks</p>
    <ol className="flex flex-col">
      {blocks.map((block, i) => {
        const Icon = BLOCK_ICONS[block.type] ?? Plus;
        const on = selected === i;
        return (
          <li key={i} className="flex flex-col">
            {i > 0 ? <Between at={i} onInsert={onInsert} /> : null}
            <button
              type="button"
              aria-current={on ? "true" : undefined}
              onClick={() => onSelect(on ? null : i)}
              title={`${BLOCK_LABELS[block.type]}: ${blockSummary(block)}`}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs",
                on ? "border-black bg-white font-semibold text-black" : "border-transparent text-gray-700 hover:border-gray-300 hover:bg-white",
              )}>
              <span className={cn("flex h-5 w-5 flex-none items-center justify-center rounded", on ? "bg-[#e1f073] text-black" : "bg-gray-100 text-gray-600")}>
                <Icon className="h-3 w-3" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">{blockSummary(block)}</span>
            </button>
          </li>
        );
      })}
    </ol>
    <AddBlockMenu onPick={(type) => onInsert(blocks.length, type)} className="mt-2">
      {blocks.length ? "Add block" : "Add the first block"}
    </AddBlockMenu>
  </nav>
);

/** The thin gap between two rows; its "+" inserts a block there. */
const Between: FC<{ at: number; onInsert: (at: number, type: BlockType) => void }> = ({ at, onInsert }) => (
  <div className="group/gap relative flex h-2 items-center">
    <AddBlockMenu onPick={(type) => onInsert(at, type)} compact label={`Add a block before block ${at + 1}`} />
  </div>
);

/** A button that opens the list of block types. */
export const AddBlockMenu: FC<{
  onPick: (type: BlockType) => void;
  compact?: boolean;
  label?: string;
  className?: string;
  children?: ReactNode;
}> = ({ onPick, compact, label, className, children }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);

  return (
    <div ref={box} className={cn("relative", compact ? "w-full" : "", className)}>
      {compact ? (
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-1 opacity-0 transition-opacity focus:opacity-100 group-hover/gap:opacity-100",
            open ? "opacity-100" : "",
          )}>
          <span className="h-px flex-1 bg-gray-400" />
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-black bg-white">
            <Plus className="h-2.5 w-2.5" aria-hidden />
          </span>
          <span className="h-px flex-1 bg-gray-400" />
        </button>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-md border border-dashed border-gray-300 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:border-black hover:text-black">
          <Plus className="h-3.5 w-3.5" aria-hidden /> {children ?? "Add block"}
        </button>
      )}
      {open ? (
        <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-48 rounded-md border border-gray-300 bg-white py-1">
          {BLOCK_TYPES.map((type) => {
            const Icon = BLOCK_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onPick(type);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-black">
                <Icon className="h-3.5 w-3.5 text-gray-500" aria-hidden /> {BLOCK_LABELS[type]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default BlockOutline;
