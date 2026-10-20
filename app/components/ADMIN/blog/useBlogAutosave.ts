"use client";

// Autosave for the blog editor, after useResumeAutosave: one save at a time in
// order, each sending the LATEST snapshot when its turn comes; a refusal (the
// server's `{ error }`) waits for the next edit, a thrown failure retries on a
// timer. The first save of a new post creates its draft, so nothing exists on
// the server until the writer types.
//
// `pristine` holds the baseline while nobody has edited yet: the rich-text
// editor rewrites loaded HTML into its own shape on mount, and that must not
// count as an edit (on a published post it would show "Not updated").

import { useCallback, useEffect, useRef, useState } from "react";
import { autosaveBlog, createBlogDraft, type BlogInput } from "@/libs/query";
import { actionErrorMessage } from "@/app/lib/auth/action-error";
import type { EditableBlog } from "@/app/lib/blog/types";

const DEBOUNCE_MS = 1_000;
const RETRY_MS = 8_000;

export type BlogSaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string; retrying: boolean };

export interface BlogAutosaveOptions<S> {
  /** The post's id, or null for a new post that has no draft yet. */
  id: string | null;
  snapshot: S;
  /** True until the writer's first edit. */
  pristine: boolean;
  toPayload: (snapshot: S) => Promise<Partial<BlogInput>>;
  /** Every save that lands, with the post as the server now holds it. */
  onSaved: (post: EditableBlog, created: boolean) => void;
}

export interface BlogAutosave<S> {
  status: BlogSaveStatus;
  dirty: boolean;
  /** Saves now and resolves once everything queued has landed (or failed). Returns the saved post's id. */
  flush: () => Promise<string | null>;
  /** Takes `snapshot` as what the server holds, e.g. after discarding edits. */
  markSaved: (snapshot: S) => void;
}

export function useBlogAutosave<S>({ id: initialId, snapshot, pristine, toPayload, onSaved }: BlogAutosaveOptions<S>): BlogAutosave<S> {
  const [saved, setSaved] = useState<S>(snapshot);
  const savedRef = useRef(saved);
  const idRef = useRef(initialId);
  const [saving, setSaving] = useState(false);
  const [everSaved, setEverSaved] = useState(Boolean(initialId));
  const [error, setError] = useState<{ message: string; transient: boolean } | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const latest = useRef(snapshot);
  const callbacks = useRef({ toPayload, onSaved });
  useEffect(() => {
    latest.current = snapshot;
    callbacks.current = { toPayload, onSaved };
  });

  // Before the first edit the baseline follows the editor's own rewrites.
  useEffect(() => {
    if (!pristine || savedRef.current === snapshot) return;
    savedRef.current = snapshot;
    setSaved(snapshot);
  }, [pristine, snapshot]);

  const queue = useRef<Promise<void>>(Promise.resolve());

  const save = useCallback(() => {
    queue.current = queue.current.then(async () => {
      const now = latest.current;
      if (now === savedRef.current) return;
      setSaving(true);
      try {
        const payload = await callbacks.current.toPayload(now);
        const created = idRef.current === null;
        const res = created ? await createBlogDraft(payload) : await autosaveBlog(idRef.current!, payload);
        if ("error" in res) {
          setError({ message: res.error, transient: false });
          return;
        }
        idRef.current = res.data.id;
        savedRef.current = now;
        setSaved(now);
        setEverSaved(true);
        setError(null);
        callbacks.current.onSaved(res.data, created);
      } catch (caught) {
        setError({ message: actionErrorMessage(caught), transient: true });
      } finally {
        setSaving(false);
      }
    });
    return queue.current;
  }, []);

  const dirty = !pristine && snapshot !== saved;

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void save(), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, snapshot, retryTick, save]);

  useEffect(() => {
    if (!error?.transient) return;
    const timer = window.setTimeout(() => setRetryTick((n) => n + 1), RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [error]);

  // Server actions can't outlive the page, so leaving with unsaved text asks first.
  useEffect(() => {
    if (!dirty && !saving) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      void save();
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saving, save]);

  const flush = useCallback(async () => {
    await save();
    return idRef.current;
  }, [save]);

  const markSaved = useCallback((next: S) => {
    savedRef.current = next;
    setSaved(next);
    setError(null);
  }, []);

  const status: BlogSaveStatus = error
    ? { kind: "error", message: error.message, retrying: error.transient }
    : saving || dirty
      ? { kind: "saving" }
      : everSaved
        ? { kind: "saved" }
        : { kind: "idle" };

  return { status, dirty, flush, markSaved };
}
