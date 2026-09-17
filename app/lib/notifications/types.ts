// The notification wire contract, mirroring `notificationSerializers.ts` in the backend.

export type NotificationKind =
  | "pod.joined"
  | "pod.left"
  | "pod.owner-changed"
  | "pod.inactivity-warning"
  | "pod.removed"
  | "pod.deleted"
  | "pod.rotated";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Where clicking it goes. Null for anything with nowhere left to point. */
  href: string | null;
  /** Rendered server-side, like the pod feed's timestamps, so the two read alike. */
  time: string;
  read: boolean;
}

export interface NotificationFeed {
  items: NotificationItem[];
  /** Drives the badge. Counted server-side against an index rather than derived from `items`,
   *  which is only the most recent page. */
  unreadCount: number;
}
