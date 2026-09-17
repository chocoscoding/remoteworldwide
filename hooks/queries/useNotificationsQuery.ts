"use client";

// The bell, read through React Query.
//
// This is the one polling query in the app. Everything else is either written
// by the person looking at it or refetched when they act; a notification is by
// definition something that happened while they were doing something else, and
// there is no push channel in the product to deliver it any other way.
//
// Not persisted to disk — see PERSISTED_DOMAINS in app/lib/query/keys.ts. A
// disk-warm badge would show a count that was already cleared on another tab.

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/app/lib/api/client";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import type { NotificationFeed } from "@/app/lib/notifications/types";

export const NOTIFICATIONS_PATH = "/api/notifications";

/** How often the bell asks. Slow enough to be invisible on the backend's per-host budget. */
export const NOTIFICATIONS_POLL_MS = 60_000;

const EMPTY: NotificationFeed = { items: [], unreadCount: 0 };

export function useNotificationsQuery() {
  return useQuery({
    queryKey: qk.notifications.feed(),
    queryFn: ({ signal }) => apiGet<NotificationFeed>(NOTIFICATIONS_PATH, signal),
    staleTime: STALE_TIME.notifications,
    refetchInterval: NOTIFICATIONS_POLL_MS,
    // The bell is mounted on every dashboard screen and is never the reason someone is there, so a
    // failure is silent: the badge simply shows nothing rather than an error surface in the chrome.
    placeholderData: EMPTY,
    retry: 1,
  });
}
