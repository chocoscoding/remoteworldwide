"use client";

import { useState, type FC, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { BLOCK_LABELS, BLOCK_TYPES, TEMPLATE_VARS, type Block, type BlockType } from "@/app/lib/mail/types";
import { INPUT, LABEL } from "./ui";

const fresh = (type: BlockType): Block => {
  switch (type) {
    case "heading":
      return { type, text: "" };
    case "paragraph":
      return { type, text: "" };
    case "button":
      return { type, label: "", url: "{{appUrl}}/dashboard" };
    case "image":
      return { type, src: "", alt: "" };
    default:
      return { type } as Block;
  }
};

const NOTE: Partial<Record<BlockType, string>> = {
  divider: "A thin line.",
  signature: "Theo's sign-off, name from Outreach settings.",
  feedback: "\"How is it going?\" with four faces. Each tap is recorded.",
  offer: "The discount, its expiry, the code and a button. Left out when the mail carries no offer.",
};

/** A mail's blocks as a vertical list: add, edit, move up or down, remove. No canvas. */
const BlockEditor: FC<{ blocks: Block[]; onChange: (blocks: Block[]) => void }> = ({ blocks, onChange }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const set = (i: number, block: Block) => onChange(blocks.map((b, j) => (j === i ? block : b)));
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(blocks.filter((_, j) => j !== i));
  const copy = (name: string) => {
    void navigator.clipboard?.writeText(`{{${name}}}`).then(
      () => {
        setCopied(name);
        setTimeout(() => setCopied((c) => (c === name ? null : c)), 1200);
      },
      () => undefined,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-gray-500">Variables (press to copy):</span>
        {TEMPLATE_VARS.map((v) => (
          <button
            key={v.name}
            type="button"
            title={v.hint}
            onClick={() => copy(v.name)}
            className="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-[11px] text-gray-700 hover:border-black">
            {copied === v.name ? "Copied" : `{{${v.name}}}`}
          </button>
        ))}
      </div>

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
              <BlockFields block={block} onChange={(b) => set(i, b)} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">No blocks yet. Add one below.</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-gray-500">Add</span>
        {BLOCK_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange([...blocks, fresh(type)])}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:border-black">
            + {BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
};

const IconButton: FC<{ label: string; onClick: () => void; disabled?: boolean; children: ReactNode }> = ({ label, onClick, disabled, children }) => (
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

const BlockFields: FC<{ block: Block; onChange: (block: Block) => void }> = ({ block, onChange }) => {
  switch (block.type) {
    case "heading":
      return <input aria-label="Heading text" className={INPUT} value={block.text} maxLength={200} onChange={(e) => onChange({ ...block, text: e.target.value })} placeholder="Hi {{firstName|there}}" />;
    case "paragraph":
      return (
        <div>
          <textarea
            aria-label="Paragraph text"
            className={`${INPUT} min-h-[96px] font-[inherit]`}
            value={block.text}
            maxLength={5000}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Text. **bold**, [label](https://...), a blank line starts a new paragraph."
          />
          <p className="mt-1 text-[11px] text-gray-500">**bold** · [label](url) · blank line = new paragraph</p>
        </div>
      );
    case "button":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={LABEL}>
            Label
            <input className={INPUT} value={block.label} maxLength={80} onChange={(e) => onChange({ ...block, label: e.target.value })} placeholder="Open my dashboard" />
          </label>
          <label className={LABEL}>
            Link
            <input className={INPUT} value={block.url} maxLength={500} onChange={(e) => onChange({ ...block, url: e.target.value })} placeholder="{{appUrl}}/dashboard or {{offerUrl}}" />
          </label>
        </div>
      );
    case "image":
      return (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className={LABEL}>
            Image address (https)
            <input className={INPUT} value={block.src} maxLength={500} onChange={(e) => onChange({ ...block, src: e.target.value })} placeholder="https://..." />
          </label>
          <label className={LABEL}>
            Description
            <input className={INPUT} value={block.alt} maxLength={200} onChange={(e) => onChange({ ...block, alt: e.target.value })} />
          </label>
          <label className={LABEL}>
            Link (optional)
            <input className={INPUT} value={block.href ?? ""} maxLength={500} onChange={(e) => onChange({ ...block, href: e.target.value || undefined })} />
          </label>
        </div>
      );
    default:
      return <p className="text-xs text-gray-500">{NOTE[block.type]}</p>;
  }
};

export default BlockEditor;
