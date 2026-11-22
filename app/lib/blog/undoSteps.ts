// How the blog editor's undo cuts the body into steps (owner, 2026-11-21: one
// undo must take back the last step, then the one before, never hours at once).
//
// Typing is the only thing that runs together, and only within one word: the
// space, tab or line break that ends a word closes the step, so each undo takes
// back about a word. A run of Backspace or Delete is one step until the writer
// pauses or types again. Everything else is a step of its own: bold, a heading,
// a link, a paste, an image, a table change, typing over a selection.
//
// Quill describes each change as a delta: `retain` skips text (with attributes
// it formats it), `insert` adds text or an embed, `delete` removes characters.

export interface DeltaOp {
  insert?: unknown;
  delete?: number;
  retain?: unknown;
  attributes?: Record<string, unknown> | null;
}

export type TypingStep = { kind: "insert"; endsWord: boolean } | { kind: "delete" };

/** At most one character as the writer sees it: a letter, a space, an emoji (two UTF-16 units). */
const isOneCharacter = (text: string) => text.length > 0 && Array.from(text).length === 1;

/** Ends a word: any whitespace, the no-break space browsers type at a line's end included, and a line break. */
const isWordEnd = (text: string) => /^\s$/u.test(text);

/**
 * What a change from the writer's own keyboard is: one typed character, or one
 * character deleted. Null for anything else, which then undoes on its own.
 */
export function typingStep(ops: readonly DeltaOp[]): TypingStep | null {
  let found: TypingStep | null = null;
  for (const op of ops) {
    if (op.retain !== undefined) {
      // Moving past text is fine; formatting it, or retaining an embed, is not typing.
      if (op.attributes || typeof op.retain !== "number") return null;
      continue;
    }
    if (found) return null;
    if (op.delete !== undefined) {
      if (op.delete !== 1) return null;
      found = { kind: "delete" };
      continue;
    }
    if (typeof op.insert !== "string" || !isOneCharacter(op.insert)) return null;
    found = { kind: "insert", endsWord: isWordEnd(op.insert) };
  }
  return found;
}

/**
 * Where the caret goes after an undo or redo, given the change from the body
 * before it to the body after (`before.diff(after)`): just after what came
 * back, where text went away, or the end of a reformatted stretch; the last
 * such place when there are several. Null when the body did not change. The
 * editor's own restore keeps the old position number instead, which in a
 * shorter or longer body lands inside another word.
 */
export function changeIndex(ops: readonly DeltaOp[]): number | null {
  let index = 0;
  let at: number | null = null;
  for (const op of ops) {
    if (op.delete !== undefined) {
      at = index;
    } else if (op.insert !== undefined) {
      index += typeof op.insert === "string" ? op.insert.length : 1;
      at = index;
    } else if (typeof op.retain === "number") {
      index += op.retain;
      if (op.attributes) at = index;
    } else if (op.retain !== undefined) {
      index += 1;
      if (op.attributes) at = index;
    }
  }
  return at;
}
