// Invite credits — derived, never written down.
//
// There is exactly one way to earn a credit: someone you invited subscribes.
// No second level, no bonuses.
//
// The invites screen reads the real total from the backend now; what is left
// here feeds the sidebar meter, which is still on mock data. Only the total is
// exported, so nothing can start treating this file as the rate card.

import { INVITES } from "./mock-data";

const CREDITS_PER_SUBSCRIBER = 5;

const SUBSCRIBED_INVITES = INVITES.filter((i) => i.status === "subscribed");

export const INVITE_CREDITS_EARNED = SUBSCRIBED_INVITES.length * CREDITS_PER_SUBSCRIBER;
