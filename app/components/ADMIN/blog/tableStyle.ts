import type { Quill } from "react-quill-new";

// Quill 2 tables are bare <td data-row> cells, so a post table's style rides on its cells as
// a class: none = Full (first row is the heading), ql-table-rows = Rows only,
// ql-table-rows-head = Rows only with column labels. renderPost reads it (see shapeTables).
export type TableStyle = "full" | "rows" | "rows-head";

type TableBlot = { offset(): number; length(): number; domNode: HTMLElement };
type TableModule = {
  getTable(range?: unknown): [TableBlot | null, unknown, unknown, number];
  insertTable(rows: number, columns: number): void;
  insertRowBelow(): void;
  insertColumnRight(): void;
  deleteRow(): void;
  deleteColumn(): void;
  deleteTable(): void;
};

let registered = false;

export function registerTableStyle(QuillClass: typeof Quill) {
  if (registered) return;
  registered = true;
  // parchment is Quill's own dependency, not the site's, so it is typed here by hand.
  const { ClassAttributor, Scope } = QuillClass.import("parchment") as {
    ClassAttributor: new (name: string, keyName: string, options: { scope: number; whitelist: string[] }) => object;
    Scope: { BLOCK: number };
  };
  const register = QuillClass.register.bind(QuillClass) as (defs: Record<string, object>, overwrite: boolean) => void;
  register({ "formats/tableStyle": new ClassAttributor("tableStyle", "ql-table", { scope: Scope.BLOCK, whitelist: ["rows", "rows-head"] }) }, true);
}

const tableModule = (quill: Quill) => quill.getModule("table") as TableModule;

/** The table holding the cursor, or null. */
export function currentTable(quill: Quill): TableBlot | null {
  const range = quill.getSelection();
  return range ? tableModule(quill).getTable(range)[0] : null;
}

/** The first classed cell decides, so rows Quill adds later (always bare) don't change it. */
export function tableStyleOf(table: HTMLElement): TableStyle {
  const cell = table.querySelector("td.ql-table-rows, td.ql-table-rows-head");
  if (!cell) return "full";
  return cell.classList.contains("ql-table-rows-head") ? "rows-head" : "rows";
}

export function setTableStyle(quill: Quill, table: TableBlot, style: TableStyle) {
  const range = quill.getSelection();
  quill.formatLine(table.offset(), table.length(), "tableStyle", style === "full" ? false : style, "user");
  if (range) quill.setSelection(range, "silent");
}

/** Puts the cursor in `cell` (a <td> in the editor), so table commands act on its row and column. */
export function focusCell(quill: Quill, cell: HTMLElement): boolean {
  const blot = (quill.scroll as unknown as { find(node: Node): unknown }).find(cell);
  if (!blot) return false;
  quill.setSelection(quill.getIndex(blot as Parameters<Quill["getIndex"]>[0]), 0, "silent");
  return true;
}

/** A 3×3 Full table on its own line: text after the cursor would otherwise become its first cell. */
export function insertTable(quill: Quill) {
  const range = quill.getSelection(true);
  if (tableModule(quill).getTable(range)[0]) return;
  const [line, offset] = quill.getLine(range.index);
  let index = range.index;
  if (line && line.length() > 1) {
    index = range.index - offset + line.length() - 1;
    quill.insertText(index, "\n", "user");
    index += 1;
  }
  quill.formatLine(index, 1, { header: false, blockquote: false, list: false, "code-block": false, align: false, indent: false }, "user");
  quill.setSelection(index, 0, "silent");
  tableModule(quill).insertTable(3, 3);
}

export type TableAction = "insertRowBelow" | "insertColumnRight" | "deleteRow" | "deleteColumn" | "deleteTable";

/** Runs a table command at the cursor; new cells take the table's style so it stays whole. */
export function runTableAction(quill: Quill, action: TableAction) {
  const before = currentTable(quill);
  const style = before ? tableStyleOf(before.domNode) : "full";
  tableModule(quill)[action]();
  const after = currentTable(quill);
  if (after && style !== "full") setTableStyle(quill, after, style);
}
