// The invites wire contract — what /api/invites/overview answers with.
//
// There are two states, not three: a row exists because someone signed up on
// your link, and it moves to `subscribed` when they pay. Nothing is written
// down for an invite you sent into the void, because a link that nobody used
// leaves no trace to write down.

export type InviteStatus = "joined" | "subscribed";

export interface InviteRow {
  id: string;
  name: string;
  status: InviteStatus;
  joinedAt: Date;
  subscribedAt: Date | null;
}

export interface InviteOverview {
  /** The tail of your link: /j/<code>. */
  code: string;
  creditsPerSubscriber: number;
  creditsEarned: number;
  joined: number;
  subscribed: number;
  rows: InviteRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * What /api/invites/summary answers with: the overview's counts and code
 * without the page of people. The sidebar meter and the win share read it on
 * every screen, so it carries no names. These are REFERRAL credits, a separate
 * currency from the plan credits on the billing screen.
 */
export interface InviteSummary {
  code: string;
  creditsPerSubscriber: number;
  creditsEarned: number;
  /** What the people who joined but have not subscribed would be worth if they did. */
  creditsPending: number;
  joined: number;
  subscribed: number;
}
