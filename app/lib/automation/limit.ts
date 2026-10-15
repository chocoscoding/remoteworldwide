// The most jobs one automation run posts. The admin sets it on /heroshima/automation; the trigger
// route checks it and passes it to the bot as `?limit=`, and the bot (rwwbot/limit.js) holds the
// same bounds, so keep the two in step. The jobs themselves are the ones created today on the
// Lagos calendar, which the backend's /api/jobs/bot decides.

export const DEFAULT_POST_LIMIT = 2;
export const MAX_POST_LIMIT = 20;

/** A whole number from 1 to MAX_POST_LIMIT, or null for anything else. Absent means the default. */
export function parsePostLimit(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return DEFAULT_POST_LIMIT;
  const limit = typeof value === "number" ? value : typeof value === "string" && /^\s*\d+\s*$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(limit) && limit >= 1 && limit <= MAX_POST_LIMIT ? limit : null;
}
