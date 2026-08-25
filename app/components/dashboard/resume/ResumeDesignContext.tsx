"use client";

import { createContext, useContext, useReducer, type Dispatch, type FC, type ReactNode } from "react";
import {
  historyReducer,
  initHistory,
  type DesignAction,
  type HistoryState,
} from "@/app/lib/dashboard/resume/design-reducer";
import type { ResumeDesign, SectionConfig } from "@/app/lib/dashboard/resume/design-types";

/**
 * Design state, split across TWO contexts rather than one.
 *
 * A panel that only ever dispatches (never reads `design`/`sections`
 * directly — most panels still read, but a future dispatch-only consumer
 * shouldn't have to) never re-renders when the document changes, because it
 * never subscribes to `ResumeDesignStateContext`. React Compiler is off in
 * this repo, so this split is real, cheap insurance rather than premature
 * optimisation — see `design-reducer.ts`'s header comment for the reducer
 * side of this design.
 */
const ResumeDesignStateContext = createContext<HistoryState | undefined>(undefined);
const ResumeDesignDispatchContext = createContext<Dispatch<DesignAction> | undefined>(undefined);

export interface ResumeDesignProviderProps {
  /** Seeds the initial design. Omitted -> the default "basic corporate" look. */
  initialDesign?: ResumeDesign;
  /** Seeds the initial section order/visibility. Omitted -> `DEFAULT_SECTIONS`. */
  initialSections?: SectionConfig[];
  children: ReactNode;
}

/**
 * `initHistory` only accepts a `ResumeTemplateId | ResumeDesign` seed, so it
 * has no way to express a custom `initialSections` alongside a custom
 * `initialDesign` on its own — this folds the two optional seeds together
 * into one `HistoryState` before the reducer ever sees them.
 */
function buildInitialState(initialDesign?: ResumeDesign, initialSections?: SectionConfig[]): HistoryState {
  const base = initHistory(initialDesign);
  if (!initialSections) return base;
  return { ...base, present: { ...base.present, sections: initialSections } };
}

export const ResumeDesignProvider: FC<ResumeDesignProviderProps> = ({ initialDesign, initialSections, children }) => {
  // Lazy 3-arg `useReducer` form: `buildInitialState` only ever runs once, on
  // mount, never on every render.
  const [state, dispatch] = useReducer(historyReducer, undefined, () =>
    buildInitialState(initialDesign, initialSections)
  );

  return (
    <ResumeDesignStateContext.Provider value={state}>
      <ResumeDesignDispatchContext.Provider value={dispatch}>{children}</ResumeDesignDispatchContext.Provider>
    </ResumeDesignStateContext.Provider>
  );
};

/** Throws outside `ResumeDesignProvider` — standard context-hook guard. */
export function useResumeDesignState(): HistoryState {
  const ctx = useContext(ResumeDesignStateContext);
  if (ctx === undefined) throw new Error("useResumeDesignState must be used within a ResumeDesignProvider");
  return ctx;
}

/** Throws outside `ResumeDesignProvider` — standard context-hook guard. */
export function useResumeDesignDispatch(): Dispatch<DesignAction> {
  const ctx = useContext(ResumeDesignDispatchContext);
  if (ctx === undefined) throw new Error("useResumeDesignDispatch must be used within a ResumeDesignProvider");
  return ctx;
}
