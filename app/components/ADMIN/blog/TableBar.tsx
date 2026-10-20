"use client";

import { useEffect, useRef, useState, type FC, type MouseEvent, type ReactNode, type RefObject } from "react";
import type { Quill } from "react-quill-new";
import { Trash2 } from "lucide-react";
import type { QuillRef } from "./QuillEditor";
import { currentTable, focusCell, runTableAction, setTableStyle, tableStyleOf, type TableAction, type TableStyle } from "./tableStyle";

const NEXT_STYLE: Record<TableStyle, TableStyle> = { full: "rows", rows: "rows-head", "rows-head": "full" };
const STYLE_LETTER: Record<TableStyle, string> = { full: "F", rows: "R", "rows-head": "L" };
const STYLE_TITLE: Record<TableStyle, string> = {
  full: "Full table (first row is the heading). Click for Rows only",
  rows: "Rows only. Click to add column labels",
  "rows-head": "Rows only with column labels. Click for Full",
};

type Hover = { cell: HTMLElement; top: number; right: number; style: TableStyle };

// Where the pill goes: the table's top-right corner, relative to the editor wrapper.
function measure(wrap: HTMLElement | null, cell: HTMLElement | null): Hover | null {
  const table = cell?.closest("table");
  if (!wrap || !cell || !table || !cell.isConnected) return null;
  const w = wrap.getBoundingClientRect();
  const t = table.getBoundingClientRect();
  return { cell, top: t.top - w.top, right: t.right - w.left, style: tableStyleOf(table) };
}

// A small pill on the top-right corner of the table under the mouse. Buttons act on the
// hovered cell's row and column; they work on mousedown with the default prevented, so the
// editor keeps focus and the pill doesn't flicker away.
const TableBar: FC<{ quillRef: QuillRef; wrapRef: RefObject<HTMLDivElement | null> }> = ({ quillRef, wrapRef }) => {
  const [hover, setHover] = useState<Hover | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const cancelHide = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
    };
    const onMove = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-table-pill]")) return cancelHide();
      const root = quillRef.current?.getEditor().root;
      const table = root?.contains(target) ? target.closest("table") : null;
      if (!table) {
        if (!hideTimer.current) hideTimer.current = setTimeout(() => setHover(null), 250);
        return;
      }
      cancelHide();
      const cell = target.closest("td") ?? table.querySelector("td");
      setHover(measure(wrap, cell));
    };
    const onLeave = () => {
      cancelHide();
      hideTimer.current = setTimeout(() => setHover(null), 250);
    };
    wrap.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", onLeave);
    return () => {
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", onLeave);
      cancelHide();
    };
  }, [quillRef, wrapRef]);

  if (!hover) return null;

  const act = (e: MouseEvent, run: (quill: Quill) => void) => {
    e.preventDefault();
    const quill = quillRef.current?.getEditor();
    if (!quill || !focusCell(quill, hover.cell)) return;
    run(quill);
    // Re-anchor on the cell the cursor is in now (a deleted row or table takes the old one with it).
    const range = quill.getSelection();
    const line = range && currentTable(quill) ? (quill.getLine(range.index)[0] as { domNode?: HTMLElement } | null) : null;
    const cell = hover.cell.isConnected ? hover.cell : line?.domNode?.tagName === "TD" ? line.domNode : null;
    setHover(measure(wrapRef.current, cell));
  };
  const restyle = (e: MouseEvent) =>
    act(e, (quill) => {
      const table = currentTable(quill);
      if (table) setTableStyle(quill, table, NEXT_STYLE[hover.style]);
    });
  const command = (e: MouseEvent, action: TableAction) => act(e, (quill) => runTableAction(quill, action));

  return (
    <div
      data-table-pill
      role="toolbar"
      aria-label="Table"
      style={{ top: hover.top - 6, left: hover.right }}
      className="br-shadow absolute z-10 flex -translate-x-full -translate-y-full items-center gap-0.5 rounded-full bg-white px-1 py-0.5">
      <Btn title={STYLE_TITLE[hover.style]} onMouseDown={restyle}>
        <span className="font-mono text-[11px] font-bold leading-none">{STYLE_LETTER[hover.style]}</span>
      </Btn>
      <Btn title="Add a row below" onMouseDown={(e) => command(e, "insertRowBelow")}>
        <LineIcon axis="row" sign="+" />
      </Btn>
      <Btn title="Add a column to the right" onMouseDown={(e) => command(e, "insertColumnRight")}>
        <LineIcon axis="col" sign="+" />
      </Btn>
      <Btn title="Remove this row" onMouseDown={(e) => command(e, "deleteRow")}>
        <LineIcon axis="row" sign="-" />
      </Btn>
      <Btn title="Remove this column" onMouseDown={(e) => command(e, "deleteColumn")}>
        <LineIcon axis="col" sign="-" />
      </Btn>
      <Btn title="Delete table" danger onMouseDown={(e) => command(e, "deleteTable")}>
        <Trash2 className="h-3.5 w-3.5" />
      </Btn>
    </div>
  );
};

const Btn: FC<{ title: string; onMouseDown: (e: MouseEvent) => void; danger?: boolean; children: ReactNode }> = ({ title, onMouseDown, danger, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onMouseDown={onMouseDown}
    className={`grid h-6 w-6 place-items-center rounded-full text-[#222325] transition-colors ${danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-[#e1f073]"}`}>
    {children}
  </button>
);

// A row (wide bar) or column (tall bar) with a + or − beside it.
const LineIcon: FC<{ axis: "row" | "col"; sign: "+" | "-" }> = ({ axis, sign }) => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
    {axis === "row" ? <rect x="1.5" y="2.5" width="13" height="5" rx="1" /> : <rect x="2.5" y="1.5" width="5" height="13" rx="1" />}
    {axis === "row" ? (
      <>
        <path d="M5.5 12h5" />
        {sign === "+" && <path d="M8 9.5v5" />}
      </>
    ) : (
      <>
        <path d="M10 8h5" />
        {sign === "+" && <path d="M12.5 5.5v5" />}
      </>
    )}
  </svg>
);

export default TableBar;
