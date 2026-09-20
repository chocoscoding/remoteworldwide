"use client";

// Autosave for the open resume.
//
// The editor never mutates: every edit to `content`, `design` or `sections`
// produces a new object, so "has this slice changed since the last save" is a
// reference comparison, and a save sends exactly the slices that did — whole,
// never a field-level diff, which is what lets the server be last-write-wins
// with nothing to merge.
//
// Three rules the rest follows from:
//
//  1. One save at a time, in order. Saves queue on a promise chain, and each
//     reads the LATEST slices when its turn comes rather than the ones that
//     scheduled it — so typing through a slow request costs one more save, not
//     one per keystroke, and an older save can never land after a newer one.
//  2. Leaving flushes. Switching document, going back to the landing and
//     closing the tab all unmount this hook or fire `pagehide`; both save
//     immediately, with `keepalive` so the request survives the page.
//  3. A refusal is not retried, a failure is. A 4xx is the server saying this
//     document cannot be saved as it is (a summary past the limit): repeating
//     it changes nothing, and the next edit will try again anyway. Anything
//     else — offline, a 502 — is retried on a timer until it lands.

import { useCallback, useEffect, useRef, useState } from "react";
import { BackendError, apiMessage } from "@/app/lib/api/core";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { saveResumeDocument, type ResumeDocumentPatch } from "@/app/lib/resume/api";

/** Long enough that a sentence is one save, short enough that closing the laptop loses nothing. */
const DEBOUNCE_MS = 1_000;
const RETRY_MS = 8_000;

interface Slices {
  content: ResumeContent;
  design: ResumeDesign;
  sections: SectionConfig[];
}

export type SaveStatus = { kind: "saved" } | { kind: "saving" } | { kind: "error"; message: string; retrying: boolean };

export interface ResumeAutosaveOptions extends Slices {
  id: string;
  /** When the library last took a save of this document, as loaded. */
  savedAt: Date;
  /** Told of every save that lands — including the flush that outlives this hook's component. */
  onSaved: (id: string, updatedAt: Date) => void;
}

export interface ResumeAutosave {
  status: SaveStatus;
  savedAt: Date;
  /** Save now rather than after the debounce. Also what the error's Retry button calls. */
  flush: () => void;
}

const changedSlices = (base: Slices, now: Slices): ResumeDocumentPatch => ({
  ...(now.content !== base.content ? { content: now.content } : {}),
  ...(now.design !== base.design ? { design: now.design } : {}),
  ...(now.sections !== base.sections ? { sections: now.sections } : {}),
});

/** A 4xx is a refusal; everything else (no response at all included) may pass on its own. */
const isTransient = (error: unknown): boolean => !(error instanceof BackendError && error.status >= 400 && error.status < 500);

export function useResumeAutosave({ id, content, design, sections, savedAt: loadedAt, onSaved }: ResumeAutosaveOptions): ResumeAutosave {
  // What the server is known to hold. State, because "is there anything to
  // save" is read during render; mirrored in a ref for the save queue, which
  // runs outside render and must see the value the previous save left.
  const [saved, setSaved] = useState<Slices>({ content, design, sections });
  const savedRef = useRef(saved);
  const [savedAt, setSavedAt] = useState(loadedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; transient: boolean } | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const latest = useRef<Slices>({ content, design, sections });
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    latest.current = { content, design, sections };
    onSavedRef.current = onSaved;
  });

  const queue = useRef<Promise<void>>(Promise.resolve());

  const save = useCallback(
    (options: { keepalive?: boolean } = {}) => {
      queue.current = queue.current.then(async () => {
        const now = latest.current;
        const patch = changedSlices(savedRef.current, now);
        if (Object.keys(patch).length === 0) return;

        setSaving(true);
        try {
          const result = await saveResumeDocument(id, patch, options);
          savedRef.current = now;
          setSaved(now);
          setSavedAt(result.updatedAt);
          setError(null);
          onSavedRef.current(id, result.updatedAt);
        } catch (caught) {
          setError({ message: apiMessage(caught), transient: isTransient(caught) });
        } finally {
          setSaving(false);
        }
      });
    },
    [id],
  );

  const dirty = content !== saved.content || design !== saved.design || sections !== saved.sections;

  // The debounce: every edit restarts the clock. `retryTick` re-arms it after a
  // transient failure, when nothing else in the dependency list would change.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => save(), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, content, design, sections, retryTick, save]);

  useEffect(() => {
    if (!error?.transient) return;
    const timer = window.setTimeout(() => setRetryTick((n) => n + 1), RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [error]);

  // Leaving. The cleanup is the document switch and the route change; `pagehide`
  // is the tab closing, where no cleanup runs. With nothing unsaved both are
  // no-ops, which is also what makes StrictMode's extra mount harmless.
  useEffect(() => {
    const onPageHide = () => save({ keepalive: true });
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      save({ keepalive: true });
    };
  }, [save]);

  const status: SaveStatus = error
    ? { kind: "error", message: error.message, retrying: error.transient }
    : saving || dirty
      ? // "Unsaved" and "saving" are one state to the person typing: not there yet.
        { kind: "saving" }
      : { kind: "saved" };

  const flush = useCallback(() => save(), [save]);

  return { status, savedAt, flush };
}
