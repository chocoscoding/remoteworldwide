import type { Quill, RangeStatic } from "react-quill-new";

// Quill 2 table cells are single lines: a "\n" there makes a new cell, and Enter inside a
// table does nothing. Shift+Enter puts a soft break (<br class="ql-soft-break">) in the line
// instead. The page keeps it as a plain <br>: render.ts drops the class.
export const SOFT_BREAK = "softbreak";

let registered = false;

export function registerSoftBreak(QuillClass: typeof Quill) {
  if (registered) return;
  registered = true;
  // parchment is Quill's own dependency, not the site's, so it is typed here by hand.
  const { EmbedBlot } = QuillClass.import("parchment") as { EmbedBlot: new (...args: never[]) => object };
  class SoftBreak extends EmbedBlot {
    static blotName = SOFT_BREAK;
    static tagName = "BR";
    static className = "ql-soft-break";
    value() {
      return true;
    }
  }
  QuillClass.register({ [`formats/${SOFT_BREAK}`]: SoftBreak }, true);
}

type DeltaLike = { constructor: new () => DeltaLike; insert(value: unknown): DeltaLike };

/**
 * Clipboard matcher: Quill's own <br> matcher turns a break into a new line, which in a
 * table is a new cell. Ours runs after it and keeps a saved soft break a soft break.
 */
export const softBreakMatcher: [string, (node: Node, delta: DeltaLike) => DeltaLike] = [
  "br.ql-soft-break",
  (_node, delta) => new delta.constructor().insert({ [SOFT_BREAK]: true }),
];

/**
 * Puts a soft break at the cursor. A break that ends a line draws nothing in a browser, so
 * one typed at the end gets a second to hold the new, still-empty line open.
 */
export function insertSoftBreak(quill: Quill, range: RangeStatic) {
  if (range.length > 0) quill.deleteText(range.index, range.length, "user");
  const atLineEnd = quill.getText(range.index, 1) === "\n";
  quill.insertEmbed(range.index, SOFT_BREAK, true, "user");
  if (atLineEnd) quill.insertEmbed(range.index + 1, SOFT_BREAK, true, "user");
  quill.setSelection(range.index + 1, 0, "user");
}

type BindingThis = { quill: Quill };
type TableEnterHandler = (this: BindingThis, range: RangeStatic, context: { event: KeyboardEvent }) => unknown;

/**
 * Replaces Quill's "table enter" binding (same name, so it keeps that binding's place ahead of
 * the plain Enter handler): Shift+Enter breaks the line inside the cell, plain Enter does what
 * Quill always did there (a line above or below the table at its edges, nothing in between).
 */
export const tableEnterBinding = {
  key: "Enter",
  shiftKey: null,
  format: ["table"],
  handler(this: BindingThis, range: RangeStatic, context: { event: KeyboardEvent }) {
    if (context.event.shiftKey) {
      insertSoftBreak(this.quill, range);
      return false;
    }
    const QuillClass = this.quill.constructor as unknown as { import(path: string): { DEFAULTS: { bindings: Record<string, { handler: TableEnterHandler }> } } };
    return QuillClass.import("modules/keyboard").DEFAULTS.bindings["table enter"].handler.call(this, range, context);
  },
};
