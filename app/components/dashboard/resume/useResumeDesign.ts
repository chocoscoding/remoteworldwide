"use client";

import { useCallback, type Dispatch } from "react";
import { canRedo, canUndo, type DesignAction } from "@/app/lib/dashboard/resume/design-reducer";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import { useResumeDesignDispatch, useResumeDesignState } from "./ResumeDesignContext";

export interface UseResumeDesignResult {
  design: ResumeDesign;
  sections: SectionConfig[];
  dispatch: Dispatch<DesignAction>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Convenience hook combining both halves of the split context. Subscribes to
 * state, so any component calling this re-renders on every design change —
 * every Customize panel needs that (every control it renders is a controlled
 * component reflecting live state), so this is the hook all 14 panels use.
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
    dispatch,
    undo,
    redo,
    canUndo: canUndo(state),
    canRedo: canRedo(state),
  };
}
