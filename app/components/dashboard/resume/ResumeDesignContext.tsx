"use client";

import { createContext, useContext, useEffect, useReducer, type Dispatch, type FC, type ReactNode } from "react";
import { DEFAULT_DESIGN, DEFAULT_SECTIONS } from "@/app/lib/dashboard/resume/design-defaults";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { editorReducer, startEditor, TYPING_GROUP, type EditorAction, type EditorHistory } from "./editor-state";
import { createBlankContent, type ResumeCheck } from "./resume-document";

/**
 * The open resume's editable state and its one undo history (`editor-state.ts`),
 * split across TWO contexts rather than one.
 *
 * A panel that only ever dispatches (never reads `design`/`sections`
 * directly — most panels still read, but a future dispatch-only consumer
 * shouldn't have to) never re-renders when the document changes, because it
 * never subscribes to `ResumeDesignStateContext`. React Compiler is off in
 * this repo, so this split is real, cheap insurance rather than premature
 * optimisation — see `design-reducer.ts`'s header comment for the reducer
 * side of this design.
 */
const ResumeDesignStateContext = createContext<EditorHistory | undefined>(undefined);
const ResumeDesignDispatchContext = createContext<Dispatch<EditorAction> | undefined>(undefined);

/** How long typing has to stop before the words typed so far become one undo step. */
const TYPING_PAUSE_MS = 1000;

export interface ResumeDesignProviderProps {
  /** Seeds the initial design. Omitted -> the default "basic corporate" look. */
  initialDesign?: ResumeDesign;
  /** Seeds the initial section order/visibility. Omitted -> `DEFAULT_SECTIONS`. */
  initialSections?: SectionConfig[];
  /** Seeds the words. Omitted -> a blank resume. */
  initialContent?: ResumeContent;
  /** The check standing on the resume when it was opened, if one was run earlier this visit. */
  initialCheck?: ResumeCheck | null;
  children: ReactNode;
}

export const ResumeDesignProvider: FC<ResumeDesignProviderProps> = ({ initialDesign, initialSections, initialContent, initialCheck, children }) => {
  // Lazy 3-arg `useReducer` form: the seed is only ever built once, on mount.
  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    startEditor({
      design: initialDesign ?? DEFAULT_DESIGN,
      sections: initialSections ?? DEFAULT_SECTIONS,
      content: initialContent ?? createBlankContent(),
      check: initialCheck ?? null,
    }),
  );

  // A pause in typing closes the run, so the next word is a step of its own. Every keystroke moves
  // `present`, which restarts the wait. Drags are left alone: their own commit closes them.
  const typing = state.pending !== null && state.group?.startsWith(TYPING_GROUP) === true;
  useEffect(() => {
    if (!typing) return;
    const timer = window.setTimeout(() => dispatch({ type: "history/settle" }), TYPING_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [typing, state.present]);

  return (
    <ResumeDesignStateContext.Provider value={state}>
      <ResumeDesignDispatchContext.Provider value={dispatch}>{children}</ResumeDesignDispatchContext.Provider>
    </ResumeDesignStateContext.Provider>
  );
};

/** Throws outside `ResumeDesignProvider` — standard context-hook guard. */
export function useResumeDesignState(): EditorHistory {
  const ctx = useContext(ResumeDesignStateContext);
  if (ctx === undefined) throw new Error("useResumeDesignState must be used within a ResumeDesignProvider");
  return ctx;
}

/** Throws outside `ResumeDesignProvider` — standard context-hook guard. */
export function useResumeDesignDispatch(): Dispatch<EditorAction> {
  const ctx = useContext(ResumeDesignDispatchContext);
  if (ctx === undefined) throw new Error("useResumeDesignDispatch must be used within a ResumeDesignProvider");
  return ctx;
}
