// Which words a correction changes, as character ranges in the line it corrects — what the paper
// underlines in red while "Fix tone & grammar" proposes it (owner, 2026-10-04).
//
// Compared word by word (a longest common subsequence of whitespace-separated words), so a fixed
// typo underlines its word, a reworded phrase its run of words, and neighbouring changed words
// merge into one underline across the space between them. A correction that only ADDS words or a
// mark ("led" -> "led, and") has nothing of the old line to stand on, so it underlines the word it
// lands next to: an underline that points nowhere would say nothing.
//
// Pure, with no imports, so the tests load it directly.

interface Word {
  text: string;
  start: number;
  end: number;
}

const wordsOf = (line: string): Word[] => [...line.matchAll(/\S+/g)].map((m) => ({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));

/** Character ranges [start, end) in `before` that `after` changes, merged and in order. */
export function changedRanges(before: string, after: string): [number, number][] {
  if (before === after) return [];
  const a = wordsOf(before);
  const b = wordsOf(after);
  if (a.length === 0) return [];

  // Longest common subsequence of words, then walk it to see which of `before`'s words survive.
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i].text === b[j].text ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const changed = new Array<boolean>(a.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].text === b[j].text) {
      i += 1;
      j += 1;
    } else if (i < a.length && (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
      // A word only `before` has: removed or replaced, so it is underlined itself. Taken before an
      // insertion, so a replaced word's new spelling lands on the word it replaced, not its neighbour.
      changed[i] = true;
      i += 1;
    } else {
      // A word only `after` has: an insertion, marked on the old word it lands after (or the first).
      changed[Math.max(i - 1, 0)] = true;
      j += 1;
    }
  }

  const ranges: [number, number][] = [];
  a.forEach((word, index) => {
    if (!changed[index]) return;
    const last = ranges[ranges.length - 1];
    if (last && index > 0 && changed[index - 1]) last[1] = word.end;
    else ranges.push([word.start, word.end]);
  });
  return ranges;
}

/** A line cut at `ranges` into runs, each saying whether it is changed — what a renderer maps over. */
export function splitAt(line: string, ranges: [number, number][]): { text: string; changed: boolean }[] {
  const out: { text: string; changed: boolean }[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) out.push({ text: line.slice(at, start), changed: false });
    out.push({ text: line.slice(start, end), changed: true });
    at = end;
  }
  if (at < line.length) out.push({ text: line.slice(at), changed: false });
  return out;
}
