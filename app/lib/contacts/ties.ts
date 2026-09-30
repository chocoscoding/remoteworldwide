// How warm a path to someone is, for sorting and for the pill on their row.
//
// Moved out of mock-data.ts, where it sat beside the sample network it once
// labelled: the ties are read off where a real contact came from (see
// ./people.ts) — someone you added yourself ranks above a LinkedIn connection
// only because typing them in says you know them, and a person found online is
// a stranger.

import type { TieKind } from "@/app/lib/dashboard/types";

export const TIE_META: Record<TieKind, { label: string; pillVariant: "positive" | "neutral"; rank: number }> = {
  added: { label: "Added by you", pillVariant: "positive", rank: 0 },
  connection: { label: "1st degree", pillVariant: "neutral", rank: 1 },
  cold: { label: "Found online", pillVariant: "neutral", rank: 2 },
};
