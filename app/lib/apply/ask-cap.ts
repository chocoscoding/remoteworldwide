// The Yes/No asks on the apply page's fixes list (Tailor's asks and the posting's examples, "Java",
// "Azure"), at most four at a time. Fix plan Phase 6 (2026-10-22): the two kinds share one list and
// could pile up past the rest of the fixes; the others stay a click away behind "Show N more".

/** Asks shown before "Show N more". */
export const ASK_ROWS_SHOWN = 4;

export interface AskCap<T> {
  /** The rows to draw, in their order: every row that is not an ask, and the asks that fit. */
  rows: T[];
  /** Asks left out while closed; 0 when they all fit. */
  hidden: number;
  /** Index in `rows` the toggle goes after (the last ask drawn), or -1 when there is no toggle. */
  toggleAfter: number;
}

/**
 * The list with its asks capped. `open` shows every ask (the toggle then reads "Show less"). Rows
 * that are not asks are never hidden and keep their places.
 */
export function capAsks<T>(rows: readonly T[], isAsk: (row: T) => boolean, open: boolean, max: number = ASK_ROWS_SHOWN): AskCap<T> {
  const asks = rows.filter(isAsk).length;
  if (asks <= max) return { rows: [...rows], hidden: 0, toggleAfter: -1 };
  const out: T[] = [];
  let seen = 0;
  let lastAsk = -1;
  for (const row of rows) {
    if (isAsk(row)) {
      seen += 1;
      if (!open && seen > max) continue;
      lastAsk = out.length;
    }
    out.push(row);
  }
  return { rows: out, hidden: open ? 0 : asks - max, toggleAfter: lastAsk };
}
