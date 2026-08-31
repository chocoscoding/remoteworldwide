// Invite credits — derived, never written down.
//
// There is exactly one way to earn a credit: someone you invited subscribes.
// No second level, no bonuses. Keeping the arithmetic here means the invites
// screen and the credit modal can't disagree about the number, which is what
// happened when each surface carried its own hardcoded total.

import { INVITES } from "./mock-data";

export const CREDITS_PER_SUBSCRIBER = 5;

export const SUBSCRIBED_INVITES = INVITES.filter((i) => i.status === "subscribed");

export const INVITE_CREDITS_EARNED = SUBSCRIBED_INVITES.length * CREDITS_PER_SUBSCRIBER;
