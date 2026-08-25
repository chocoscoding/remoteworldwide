"use client";

// Compatibility shim.
//
// The streak used to own its own state here. It is now a derivation of the
// activity log — a day is logged because an artifact exists, not because a
// button was pressed — so the state lives in `ActivityProvider`.
//
// This file stays as the import path the streak components already use, so the
// ownership change didn't have to touch every consumer at once.

export { useStreak, useStreakTier, useActivity, ActivityProvider } from "../activity/ActivityProvider";
export type { GoalsState, LogApplicationInput, LogApplicationResult } from "../activity/ActivityProvider";
