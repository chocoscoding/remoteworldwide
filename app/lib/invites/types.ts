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
