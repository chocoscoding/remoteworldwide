"use client";

import type { FC, ReactNode } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { BLOCK_LABELS, type Block } from "@/app/lib/mail/types";
import BlockFields, { type OfferContext } from "./content/BlockFields";
import { AddBlockMenu } from "./content/BlockOutline";
import { freshBlock } from "./content/blocks";

/**
 * A mail's blocks as a plain vertical list: every block's fields open, add at the end, move, remove.
 * The content editor falls back to it when the preview can't be drawn, so the mail stays editable.
 */
const BlockEditor: FC<{ blocks: Block[]; onChange: (blocks: Block[]) => void; offer?: OfferContext }> = ({ blocks, onChange, offer }) => {
  const set = (i: number, block: Block) => onChange(blocks.map((b, j) => (j === i ? block : b)));
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(blocks.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-3">
      {blocks.length ? (
        <ol className="flex flex-col gap-2">
          {blocks.map((block, i) => (
            <li key={i} className="rounded-md border border-gray-300 bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  {i + 1}. {BLOCK_LABELS[block.type]}
                </span>
                <span className="ml-auto flex gap-1">
                  <IconButton label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </IconButton>
                  <IconButton label="Move down" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}>
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </IconButton>
                  <IconButton label="Remove block" onClick={() => remove(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-[#b23c26]" aria-hidden />
                  </IconButton>
                </span>
              </div>
              <BlockFields block={block} onChange={(b) => set(i, b)} offer={offer} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">No blocks yet.</p>
      )}
      <AddBlockMenu onPick={(type) => onChange([...blocks, freshBlock(type)])} className="max-w-[220px]" />
    </div>
  );
};

export const IconButton: FC<{ label: string; onClick: () => void; disabled?: boolean; children: ReactNode }> = ({ label, onClick, disabled, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
    className="rounded border border-gray-300 bg-white p-1 hover:border-black disabled:opacity-40 disabled:hover:border-gray-300">
    {children}
  </button>
);

export default BlockEditor;
