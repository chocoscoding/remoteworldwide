import type { FitAsk } from "./state";

/**
 * The asks a gap chip is read against (`askedFor`): the open ones, every one answered "No", and the
 * example asks on show. A "No" keeps its term's chip away for good: picking every chip would write in
 * what the person just said they do not have (review, 2026-10-22: a declined "Web3" or "PMM team
 * hiring" came back under "Missing from your resume"). The asks list on the page is not this list.
 */
export const chipAsks = (
  open: ReadonlyArray<Pick<FitAsk, "term">>,
  all: ReadonlyArray<Pick<FitAsk, "term" | "no">>,
  examples: ReadonlyArray<Pick<FitAsk, "term">>,
): Array<{ term: string }> => [...open, ...all.filter((ask) => ask.no), ...examples].map((ask) => ({ term: ask.term }));
