"use client";

// The cover letter screen's one piece of async state: write a letter, keep the
// ones already written.
//
// A plain hook with local state rather than a React Query mutation, for the
// same reason `useScanResume` is one — the letter is only ever shown on the
// screen that asked for it, and leaving the screen abandons the draft.
//
// ── Why it keeps a letter per tone ─────────────────────────────────────────
// Tone is not a filter over one letter. Each tone is a different letter at a
// different LENGTH, so switching tone means generating, and generating costs a
// credit. Without this cache, flicking between "Warm" and "Short" to compare
// them would charge for every flick and hand back a different letter each time,
// so the comparison the control invites would be impossible to make.
//
// Cached in the hook and not in React Query on purpose: these are drafts, not
// server state. Nothing else reads them, they are superseded by the user's own
// edits the moment the editor is touched, and they must not outlive the screen
// or survive to disk — a cover letter quotes someone's career history.

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  describeCoverFailure,
  generateCoverLetter,
  type CoverFailure,
  type CoverLetterContent,
  type CoverLetterInput,
  type CoverTone,
} from "@/app/lib/cover/api";
import { qk } from "@/app/lib/query/keys";

export type CoverStatus = "idle" | "writing" | "done" | "failed";

export interface CoverState {
  status: CoverStatus;
  /** The letter on screen — the one for the tone most recently asked for. */
  letter: CoverLetterContent | null;
  failure: CoverFailure | null;
}

const IDLE: CoverState = { status: "idle", letter: null, failure: null };

/** One job's letters, keyed by tone. A different job starts an empty set. */
type Drafts = Partial<Record<CoverTone, CoverLetterContent>>;

export function useCoverLetter() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<CoverState>(IDLE);
  const [drafts, setDrafts] = useState<Drafts>({});

  // Only the newest request may write back. Changing job or tone starts a new
  // one, and a slow earlier request must not land on top of it.
  const runIdRef = useRef(0);

  /** A new job, or "write from scratch" — the drafts belonged to the old one. */
  const reset = useCallback(() => {
    runIdRef.current += 1;
    setDrafts({});
    setState(IDLE);
  }, []);

  /**
   * Shows the letter already written for this tone, if there is one.
   *
   * Returns false when there is not, which is the caller's signal that showing
   * this tone means spending a credit.
   */
  const show = useCallback(
    (tone: CoverTone): boolean => {
      const existing = drafts[tone];
      if (!existing) return false;
      runIdRef.current += 1;
      setState({ status: "done", letter: existing, failure: null });
      return true;
    },
    [drafts],
  );

  /**
   * Writes one letter. Resolves with it, or null when it failed or was
   * superseded — so a caller can seed the editor with the result without
   * reading state back during a render.
   */
  const run = useCallback(
    async (input: CoverLetterInput): Promise<CoverLetterContent | null> => {
      runIdRef.current += 1;
      const runId = runIdRef.current;
      const current = () => runId === runIdRef.current;

      setState((prev) => ({ status: "writing", letter: prev.letter, failure: null }));

      try {
        const letter = await generateCoverLetter(input);
        if (!current()) return null;

        setDrafts((prev) => ({ ...prev, [input.tone]: letter }));
        setState({ status: "done", letter, failure: null });

        // A letter spends a credit, so the balance in the header is now behind.
        void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
        return letter;
      } catch (error) {
        if (!current()) return null;
        // The previous letter stays on screen. A failed regenerate at a new
        // tone is a tone that did not change, not a page that goes blank.
        setState((prev) => ({ status: "failed", letter: prev.letter, failure: describeCoverFailure(error) }));
        return null;
      }
    },
    [queryClient],
  );

  /** True for a tone that has not been written yet — the ones that cost a credit. */
  const isUnwritten = useCallback((tone: CoverTone) => drafts[tone] === undefined, [drafts]);

  return { ...state, run, show, reset, isUnwritten, writing: state.status === "writing" };
}
