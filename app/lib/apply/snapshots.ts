// The apply wizard's latest state per session, kept for the life of the page, so a remount picks up
// where the wizard was rather than where the session was when the page opened.
//
// Why (fix plan Phase 6, 2026-10-22): ApplyWizard reads its state once, from the session fetched
// when the application was opened. A remount (a dev hot reload, seen with an Impact step that went
// missing from history) ran that read again on the old session, and the next autosave wrote the
// older state back over the newer one. The session query is never updated instead, on purpose:
// a new session object would re-run the wizard's job memo and every effect that hangs off it.
//
// The rule a restore follows: the snapshot wins, unless the server holds a save made after the last
// one this page knows of (another tab went on with the same application). Both times are the
// server's own `updatedAt`, so no client clock is compared with a server one.

export interface ApplySnapshot<S> {
  step: number;
  visited: number[];
  state: S;
  /** The server's `updatedAt` for the save this snapshot builds on: the session's as opened, then each save's. */
  serverAt: number;
  /** False while the state is newer than the last save: a restore that takes it saves it again. */
  saved: boolean;
}

/** Sessions remembered at once; the oldest goes first. A page rarely opens more than a few. */
const MAX_SESSIONS = 20;

const snapshots = new Map<string, ApplySnapshot<unknown>>();

const timeOf = (value: Date | string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * What a wizard opening `id` should start from: the snapshot, or null for the session as fetched.
 * `sessionUpdatedAt` is the fetched session's own `updatedAt`.
 */
export function restoreApplySnapshot<S>(id: string, sessionUpdatedAt: Date | string | number | null | undefined): ApplySnapshot<S> | null {
  const snap = snapshots.get(id) as ApplySnapshot<S> | undefined;
  if (!snap) return null;
  if (timeOf(sessionUpdatedAt) > snap.serverAt) {
    // Saved elsewhere after this page's last word: the server's copy is the newer one.
    snapshots.delete(id);
    return null;
  }
  return snap;
}

/**
 * Every change the wizard makes, as it makes it. `serverAt` is only used for the first one, when
 * nothing is remembered yet: the session's `updatedAt` as it was opened.
 */
export function rememberApplySnapshot<S>(
  id: string,
  snap: { step: number; visited: Iterable<number>; state: S },
  serverAt: Date | string | number | null | undefined,
): void {
  const prev = snapshots.get(id);
  const same = prev !== undefined && prev.state === snap.state;
  const visited = [...snap.visited];
  const next: ApplySnapshot<unknown> = {
    step: snap.step,
    visited,
    state: snap.state,
    serverAt: prev ? prev.serverAt : timeOf(serverAt),
    // The first word is the session as opened, which the server holds. After that a new state is
    // unsaved, and so is the same state with the step moved, as the step is part of the save.
    saved: prev ? same && prev.saved && prev.step === snap.step && sameList(prev.visited, visited) : true,
  };
  snapshots.delete(id);
  snapshots.set(id, next);
  while (snapshots.size > MAX_SESSIONS) {
    const oldest = snapshots.keys().next().value;
    if (oldest === undefined) break;
    snapshots.delete(oldest);
  }
}

/**
 * A save went through: `state` is what it sent, `updatedAt` what the server answered. The snapshot
 * counts as saved only while it still holds that state (a change after the save began is not).
 */
export function savedApplySnapshot<S>(
  id: string,
  sent: { step: number; visited: Iterable<number>; state: S },
  updatedAt: Date | string | number | null | undefined,
): void {
  const snap = snapshots.get(id);
  if (!snap) return;
  const at = timeOf(updatedAt);
  if (at > snap.serverAt) snap.serverAt = at;
  if (snap.state === sent.state && snap.step === sent.step && sameList(snap.visited, [...sent.visited])) snap.saved = true;
}

type Recipe<S> = (current: S) => S;

/** The mounted wizard of each session: where a change made by an unmounted one is sent. */
const live = new Map<string, (recipe: Recipe<unknown>) => void>();

/**
 * The mounted wizard of `id` takes changes from earlier wizards of the same session. Answers the
 * detach, which only lets go while this wizard is still the one attached (a remount attaches the
 * new one before or after the old one's cleanup runs).
 */
export function attachApplyWizard<S>(id: string, apply: (recipe: Recipe<S>) => void): () => void {
  const entry = apply as (recipe: Recipe<unknown>) => void;
  live.set(id, entry);
  return () => {
    if (live.get(id) === entry) live.delete(id);
  };
}

/**
 * A change from a wizard that is no longer mounted (review, 2026-10-22). A tool's run saves its
 * draft version on the server and only then writes its step into the state; when the wizard was
 * remounted meanwhile (a hot reload, or leaving and reopening the application while Impact still
 * ran), that write went to the old wizard and was dropped, so the history lost the step while the
 * server's draft went one version ahead of it. Now it reaches the mounted wizard, or, with none, the
 * snapshot, marked unsaved, so the next wizard to open the session starts from it and saves it.
 * Answers false when there is nowhere to put it.
 */
export function updateApplySnapshot<S>(id: string, recipe: Recipe<S>): boolean {
  const target = live.get(id);
  if (target) {
    target(recipe as Recipe<unknown>);
    return true;
  }
  const snap = snapshots.get(id) as ApplySnapshot<S> | undefined;
  if (!snap) return false;
  snap.state = recipe(snap.state);
  snap.saved = false;
  return true;
}

/** For tests. */
export function forgetApplySnapshots(): void {
  snapshots.clear();
  live.clear();
}

function sameList(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
