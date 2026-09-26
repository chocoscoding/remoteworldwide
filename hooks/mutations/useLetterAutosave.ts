"use client";

// Autosave for the cover letter on screen, once it is in the library.
//
// Every letter the writer produces is saved by the service (see
// `app/lib/cover/api.ts`), but only as the words it wrote. What the person then
// does — edits in the rich editor, the theme, font, spacing and letterhead —
// lived nowhere but the page. This keeps it with the letter, so reopening it
// (`?letter=`), the extension's pickers and the server-rendered PDF all see the
// letter as it was left.
//
// Modelled on `useResumeAutosave` (read its header for the rules): one save at
// a time, in order; a 1s debounce; `pagehide` and unmount flush with
// `keepalive`; a 4xx is shown and not retried, anything else retries on a timer.
// Two things differ, because the letter on screen can CHANGE under it:
//
//  1. The letter is identified by `id`, and a tone switch, a new letter written
//     or one opened by link moves it. The letter being left is flushed first —
//     its own snapshot and baseline pinned at that moment — and the one arriving
//     starts clean: what it arrived with is what the library holds.
//  2. Content and design are sent separately. `design` goes with every save
//     (four short strings); `content` only once the editor has reported an edit
//     for this letter. A letter nobody has typed in keeps whatever text and HTML
//     the library already has, instead of being overwritten with none.
//
// The HTML is sanitised before it is sent (`sanitizeLetterHtml`, the print
// frame's allowlist). The service stores it as given and every renderer
// sanitises again; sending it clean means the library never holds a paste's
// scripts in the first place.

import { useCallback, useEffect, useRef, useState } from "react";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import { updateLetter, type LetterPatch } from "@/app/lib/cover/api";
import { DEFAULT_LETTER_DESIGN } from "@/app/lib/cover/presentation";
import type { CoverLetterContent, LetterDesign } from "@/app/lib/dashboard/types";
import { sanitizeLetterHtml } from "@/app/lib/export/cover";

const DEBOUNCE_MS = 1_000;
const RETRY_MS = 8_000;

/** What the editor reported for the letter on screen. */
export interface EditedLetter {
  text: string;
  html: string;
}

export interface LetterAutosaveOptions {
  /** The library letter on screen; null when it is not in the library (a blank draft, or a save that failed). */
  id: string | null;
  /** Its words, as written or reopened. */
  letter: CoverLetterContent | null;
  /** What the editor last reported for THIS letter; null until it reports. A new object per edit. */
  edited: EditedLetter | null;
  design: LetterDesign;
  /** The design the library holds for this letter, when it is known (one reopened by link). Null reads as the default. */
  storedDesign: LetterDesign | null;
  /** When the library last took a save of it, when known. */
  savedAt: Date | null;
}

export type LetterSaveStatus =
  | { kind: "off" }
  | { kind: "saved" }
  | { kind: "saving" }
  | { kind: "error"; message: string; retrying: boolean };

export interface LetterAutosave {
  status: LetterSaveStatus;
  savedAt: Date | null;
  /** Save now rather than after the debounce. Also what the error's Retry calls. */
  flush: () => void;
}

interface Snapshot {
  id: string;
  letter: CoverLetterContent;
  edited: EditedLetter | null;
  design: LetterDesign;
}

/** What the library is known to hold for one letter. */
interface Held {
  id: string | null;
  edited: EditedLetter | null;
  design: LetterDesign;
}

const sameDesign = (a: LetterDesign, b: LetterDesign): boolean =>
  a.theme === b.theme && a.font === b.font && a.spacing === b.spacing && a.letterhead === b.letterhead;

const contentChanged = (now: Snapshot, held: Held): boolean => now.edited !== null && now.edited !== held.edited;
const isDirty = (now: Snapshot, held: Held): boolean => now.id === held.id && (contentChanged(now, held) || !sameDesign(now.design, held.design));

/** The writer's fields, by name — never whatever else rides on the object on screen (a library id, a notice). */
const wordsOf = (letter: CoverLetterContent): CoverLetterContent => ({
  company: letter.company,
  role: letter.role,
  draftLabel: letter.draftLabel,
  greeting: letter.greeting,
  paragraphs: letter.paragraphs,
  signOff: letter.signOff,
  wordCount: letter.wordCount,
});

function patchFor(now: Snapshot, held: Held): LetterPatch {
  const patch: LetterPatch = { design: now.design };
  if (now.edited && contentChanged(now, held)) {
    patch.content = { ...wordsOf(now.letter), text: now.edited.text, html: sanitizeLetterHtml(now.edited.html) };
  }
  return patch;
}

/** A 4xx is a refusal (a letter past the service's limits); everything else may pass on its own. */
const isTransient = (error: unknown): boolean => !(error instanceof BackendError && error.status >= 400 && error.status < 500);

export function useLetterAutosave({ id, letter, edited, design, storedDesign, savedAt: loadedAt }: LetterAutosaveOptions): LetterAutosave {
  const snapshot: Snapshot | null = id && letter ? { id, letter, edited, design } : null;

  // What the library holds for the letter on screen. State, because "is there
  // anything to save" is read during render.
  const [held, setHeld] = useState<Held>(() => ({ id, edited, design: storedDesign ?? DEFAULT_LETTER_DESIGN }));
  const [savedAt, setSavedAt] = useState<Date | null>(loadedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ id: string; message: string; transient: boolean } | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Another letter on screen: it starts from what it arrived with. Set while
  // rendering, the React way to reset state when an input changes.
  if (held.id !== id) {
    setHeld({ id, edited, design: storedDesign ?? DEFAULT_LETTER_DESIGN });
    setSavedAt(loadedAt);
  }

  // The queue's copies. It runs outside render, and a save for the letter just
  // left can still be finishing when the next one is on screen.
  const latest = useRef<Snapshot | null>(snapshot);
  const heldRef = useRef<Held>(held);
  const idRef = useRef<string | null>(id);
  useEffect(() => {
    latest.current = snapshot;
    heldRef.current = held;
    idRef.current = id;
  });

  const queue = useRef<Promise<void>>(Promise.resolve());

  const save = useCallback((options: { keepalive?: boolean; pinned?: { now: Snapshot | null; held: Held } } = {}) => {
    queue.current = queue.current.then(async () => {
      // A flush for the letter being left saves that letter against its own
      // baseline; any other save reads the latest when its turn comes, so typing
      // through a slow request costs one more save, not one per keystroke.
      const now = options.pinned ? options.pinned.now : latest.current;
      const base = options.pinned ? options.pinned.held : heldRef.current;
      if (!now || !isDirty(now, base)) return;

      const patch = patchFor(now, base);
      const onScreen = () => idRef.current === now.id;
      setSaving(true);
      try {
        const result = await updateLetter(now.id, patch, { keepalive: options.keepalive });
        const next: Held = { id: now.id, edited: patch.content ? now.edited : base.edited, design: now.design };
        if (heldRef.current.id === now.id) heldRef.current = next;
        setHeld((prev) => (prev.id === now.id ? next : prev));
        if (onScreen()) {
          setSavedAt(result.updatedAt);
          setError(null);
        }
      } catch (caught) {
        if (onScreen()) setError({ id: now.id, message: apiMessage(caught), transient: isTransient(caught) });
      } finally {
        setSaving(false);
      }
    });
  }, []);

  const dirty = snapshot !== null && isDirty(snapshot, held);

  // The debounce: every edit restarts the clock. `retryTick` re-arms it after a
  // transient failure, when nothing else in the dependency list would change.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => save(), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, edited, design, retryTick, save]);

  const shownError = error && error.id === id ? error : null;
  useEffect(() => {
    if (!shownError?.transient) return;
    const timer = window.setTimeout(() => setRetryTick((n) => n + 1), RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [shownError]);

  // Leaving this letter — another tone, a route change, the tab closing. The
  // cleanup runs before this render's effects refresh the refs, so it pins the
  // snapshot and baseline of the letter being left, not of the one arriving.
  useEffect(() => {
    if (!id) return;
    const onPageHide = () => save({ keepalive: true });
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      save({ keepalive: true, pinned: { now: latest.current, held: heldRef.current } });
    };
  }, [id, save]);

  const status: LetterSaveStatus = !snapshot
    ? { kind: "off" }
    : shownError
      ? { kind: "error", message: shownError.message, retrying: shownError.transient }
      : saving || dirty
        ? { kind: "saving" }
        : { kind: "saved" };

  const flush = useCallback(() => save(), [save]);

  return { status, savedAt, flush };
}
