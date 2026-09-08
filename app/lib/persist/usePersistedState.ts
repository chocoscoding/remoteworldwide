"use client";

// A drop-in replacement for `useState` that survives a reload.
//
// For the dashboard providers that are still mock: their state is the user's
// actual work — a board they have been dragging cards around for ten minutes —
// and losing it to a refresh is indefensible. Adopting this is a one-line
// change per provider:
//
//   const [columns, setColumns] = useState(SEED);
//   const [columns, setColumns] = usePersistedState("tracker.board", 1, SEED);
//
// Once a domain moves to React Query (see app/lib/query/keys.ts), its provider
// drops this line and the query-cache persister takes over instead.
//
// Deliberately not Zustand, which is what the reference implementation uses.
// The providers here are a coherent, heavily commented house pattern; swapping
// the state library underneath all nine would be a large, risky refactor that
// buys nothing for the API work. This gets the same persistence with a one-line
// diff, and Zustand can still be added later for new client state without
// conflicting with it.

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/** Matches the existing `rww-intro-draft-*` convention in IntroQuestions.tsx. */
const PREFIX = "rww.";

interface Envelope<T> {
  v: number;
  data: T;
}

function storageKey(key: string) {
  return `${PREFIX}${key}`;
}

/**
 * Reads synchronously, in a lazy initialiser rather than an effect.
 *
 * `set-state-in-effect` is error-level in this repo, and beyond the lint rule
 * an effect would paint the seed first and then flip to the stored value —
 * a visible flash of the wrong board on every load.
 */
function read<T>(key: string, version: number): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Envelope<T>;
    // A version bump means the shape changed; the old payload is discarded
    // rather than hydrated into components that no longer understand it.
    if (!parsed || parsed.v !== version) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

function write<T>(key: string, version: number, data: T): void {
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify({ v: version, data } satisfies Envelope<T>));
  } catch {
    /* storage unavailable or full — the in-memory state still works */
  }
}

/**
 * @param key      Domain-scoped, no prefix: "tracker.board".
 * @param version  Bump whenever the persisted shape changes.
 * @param initial  The seed, as a value or a lazy factory.
 */
export function usePersistedState<T>(key: string, version: number, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const stored = read<T>(key, version);
    if (stored !== undefined) return stored;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });

  // Skips the very first write, so merely mounting doesn't rewrite an
  // identical payload back to disk on every page load.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    write(key, version, state);
  }, [key, version, state]);

  // Cross-tab: the `storage` event fires only in OTHER tabs, so this can't
  // loop back on the writer.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== storageKey(key) || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Envelope<T>;
        if (parsed && parsed.v === version) setState(parsed.data);
      } catch {
        /* another tab wrote something unreadable — keep what we have */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, version]);

  return [state, setState];
}

/** Forgets one persisted key — for sign-out, or a "reset this" affordance. */
export function clearPersisted(key: string): void {
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    /* nothing to clean */
  }
}
