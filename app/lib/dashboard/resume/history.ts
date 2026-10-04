// One undo history for the resume editor — generic over what a point in it
// holds, so it knows nothing about resumes and can be tested on its own.
//
// -- Steps, runs and facts --------------------------------------------------
// A STEP is one undoable change: a toggle, a template, an AI tool's result.
//
// A RUN is a burst of changes that undo as one step: typing into one field, or
// one slider drag. Each change in a run names its `group` (the field's path,
// the slider), and changes keep folding into the open run while the group
// stays the same. Anything else closes it first, and so does `settle` — the
// editor calls it when typing pauses, and a slider's commit event does it by
// arriving as a plain step. `pending` holds the point from before the run, so
// closing it pushes exactly one entry: a 12-step drag is one undo.
//
// A FACT is something learned rather than done — a check landing, a tool
// finding nothing to change. It is true of every point in the history, so
// `everywhere` writes it into all of them instead of adding a step: undoing
// an edit never brings back an older score. A step a fact leaves changing
// nothing is dropped, so Undo never lands on a press that does nothing.
//
// Every function returns the IDENTICAL history when nothing changed, which is
// what keeps no-ops out of the history and out of the render path.

export interface History<S> {
  past: S[];
  present: S;
  future: S[];
  /** The point from before the open run, or null when no run is open. */
  pending: S | null;
  /** What the open run is folding together; null with no run open. */
  group: string | null;
}

/** Steps kept in each direction. Typing pauses make steps, so this is generous. */
export const HISTORY_LIMIT = 100;

export function startHistory<S>(present: S): History<S> {
  return { past: [], present, future: [], pending: null, group: null };
}

/** Closes the open run: the point it started from becomes one undo step. */
export function settle<S>(h: History<S>): History<S> {
  if (h.pending === null) return h;
  if (h.pending === h.present) return { ...h, pending: null, group: null };
  return { past: [...h.past, h.pending].slice(-HISTORY_LIMIT), present: h.present, future: [], pending: null, group: null };
}

/**
 * Moves to `next`: one step, or part of the open run when `group` continues it.
 * A step with nothing in it (the same point) still closes an open run — that is
 * a slider's commit landing on the value its drag already showed.
 */
export function record<S>(h: History<S>, next: S, group: string | null = null): History<S> {
  if (next === h.present) return group === null ? settle(h) : h;
  if (group !== null) {
    if (h.pending !== null && h.group === group) return { ...h, present: next };
    const base = settle(h);
    return { past: base.past, present: next, future: [], pending: base.present, group };
  }
  const base = settle(h);
  return { past: [...base.past, base.present].slice(-HISTORY_LIMIT), present: next, future: [], pending: null, group: null };
}

export function undo<S>(h: History<S>): History<S> {
  const base = settle(h);
  if (base.past.length === 0) return h;
  return {
    past: base.past.slice(0, -1),
    present: base.past[base.past.length - 1],
    future: [base.present, ...base.future].slice(0, HISTORY_LIMIT),
    pending: null,
    group: null,
  };
}

export function redo<S>(h: History<S>): History<S> {
  const base = settle(h);
  if (base.future.length === 0) return h;
  const [next, ...rest] = base.future;
  return { past: [...base.past, base.present].slice(-HISTORY_LIMIT), present: next, future: rest, pending: null, group: null };
}

export const canUndo = <S>(h: History<S>): boolean => h.past.length > 0 || (h.pending !== null && h.pending !== h.present);

export const canRedo = <S>(h: History<S>): boolean => h.future.length > 0;

/**
 * Writes a fact into every point of the history. `same` says when two points
 * no longer differ; a step that became one of those is dropped.
 */
export function everywhere<S>(h: History<S>, learn: (s: S) => S, same: (a: S, b: S) => boolean): History<S> {
  const present = learn(h.present);
  const past = h.past.map(learn);
  const future = h.future.map(learn);
  const learnedPending = h.pending === null ? null : learn(h.pending);
  const changed =
    present !== h.present ||
    learnedPending !== h.pending ||
    past.some((s, i) => s !== h.past[i]) ||
    future.some((s, i) => s !== h.future[i]);
  if (!changed) return h;

  // Walk away from the present in both directions, keeping a point only where it still differs from its neighbour.
  const keptPast: S[] = [];
  let after = learnedPending ?? present;
  for (let i = past.length - 1; i >= 0; i--) {
    if (same(past[i], after)) continue;
    keptPast.unshift(past[i]);
    after = past[i];
  }
  const keptFuture: S[] = [];
  let before = present;
  for (const s of future) {
    if (same(s, before)) continue;
    keptFuture.push(s);
    before = s;
  }
  // A run whose start now reads like where it is has nothing left to undo, though it stays open.
  const pending = learnedPending !== null && same(learnedPending, present) ? present : learnedPending;
  return { past: keptPast, present, future: keptFuture, pending, group: h.group };
}

const isContainer = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * Where two plain-data trees differ, when they differ in exactly one leaf of
 * the same shape: "/summary", "/experience/0/bullets/2". Undefined when they
 * are the same, null when the shape changed (an entry added, removed or moved)
 * or more than one leaf did. Typing changes one leaf at a time, which is how
 * a run of it is told from a structural edit that should be its own step.
 */
export function soleLeafPath(a: unknown, b: unknown, path = ""): string | null | undefined {
  if (Object.is(a, b)) return undefined;
  if (!isContainer(a) || !isContainer(b)) return isContainer(a) || isContainer(b) ? null : path;
  if (Array.isArray(a) !== Array.isArray(b)) return null;
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return null;
  let found: string | undefined;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const at = soleLeafPath(a[key], b[key], `${path}/${key}`);
    if (at === undefined) continue;
    if (at === null || found !== undefined) return null;
    found = at;
  }
  return found;
}
