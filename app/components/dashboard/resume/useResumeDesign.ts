"use client";

import { useCallback, type Dispatch } from "react";
import { canRedo, canUndo } from "@/app/lib/dashboard/resume/history";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import type { EditorAction, EditorMarks } from "./editor-state";
import type { ResumeCheck } from "./resume-document";
import { useResumeDesignDispatch, useResumeDesignState } from "./ResumeDesignContext";

export interface UseResumeDesignResult {
  design: ResumeDesign;
  sections: SectionConfig[];
  content: ResumeContent;
  check: ResumeCheck | null;
  marks: EditorMarks;
  dispatch: Dispatch<EditorAction>;
  /** Undo and redo cover the whole editor: words, look, AI results and the check's removal alike. */
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Convenience hook combining both halves of the split context. Subscribes to
 * state, so any component calling this re-renders on every change —
 * every Customize panel needs that (every control it renders is a controlled
 * component reflecting live state), so this is the hook all the panels use.
 * A component that only ever dispatches and should never re-render would use
 * `useResumeDesignDispatch()` directly instead.
 */
export function useResumeDesign(): UseResumeDesignResult {
  const state = useResumeDesignState();
  const dispatch = useResumeDesignDispatch();

  const undo = useCallback(() => dispatch({ type: "history/undo" }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: "history/redo" }), [dispatch]);

  return {
    design: state.present.design,
    sections: state.present.sections,
    content: state.present.content,
    check: state.present.check,
    marks: state.present.marks,
    dispatch,
    undo,
    redo,
    canUndo: canUndo(state),
    canRedo: canRedo(state),
  };
}
