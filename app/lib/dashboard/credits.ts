// Streak-system constants that survived the credit economy's removal.
//
// The spend catalogue, prices and ledger that used to live here are gone:
// the streak pays GIFTS now (see ./gifts), and referral credits are the
// invites page's own story. What remains is timing — when the at-risk banner
// fires, how often the streak may prompt, and the repair windows.

/** Hour after which the in-app at-risk banner may appear. */
export const AT_RISK_HOUR = 20;

/** Hard cap on streak prompts per day, per §8. */
export const MAX_STREAK_PROMPTS_PER_DAY = 2;

/** How long after a break a streak can still be bought back — one day, max.
 *  A longer window made the break feel negotiable for most of a week. */
export const REPAIR_WINDOW_HOURS = 24;

/** A free half-restore is available once every this many days. */
export const FREE_RESTORE_COOLDOWN_DAYS = 30;
