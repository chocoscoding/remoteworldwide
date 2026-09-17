"use client";

// Marking notifications read.
//
// Both are optimistic, for the same reason the fire reaction is: opening the
// bell is a glance, and a badge that lingers for a round trip after you have
// plainly read the thing reads as broken rather than as loading.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/app/lib/api/client";
import { qk } from "@/app/lib/query/keys";
import type { NotificationFeed } from "@/app/lib/notifications/types";

type Context = { previous?: NotificationFeed };

/** Shared shape: apply locally, send, replace with the server's answer, roll back on failure. */
function useReadAction<V>(request: (vars: V) => Promise<NotificationFeed>, apply: (feed: NotificationFeed, vars: V) => NotificationFeed) {
  const queryClient = useQueryClient();

  return useMutation<NotificationFeed, unknown, V, Context>({
    mutationFn: request,

    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: qk.notifications.feed() });
      const previous = queryClient.getQueryData<NotificationFeed>(qk.notifications.feed());
      queryClient.setQueryData<NotificationFeed>(qk.notifications.feed(), (old) => (old ? apply(old, vars) : old));
      return { previous };
    },

    // Silent on failure. Nobody asked for this action explicitly enough to be told it did not work;
    // the next poll restores the truth.
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(qk.notifications.feed(), context.previous);
    },

    onSuccess: (data) => queryClient.setQueryData(qk.notifications.feed(), data),
  });
}

export const useMarkAllRead = () =>
  useReadAction<void>(
    () => apiPost<NotificationFeed>("/api/notifications/read"),
    (feed) => ({ items: feed.items.map((item) => ({ ...item, read: true })), unreadCount: 0 }),
  );

export const useMarkRead = () =>
  useReadAction<string>(
    (id) => apiPost<NotificationFeed>(`/api/notifications/${id}/read`),
    (feed, id) => {
      const target = feed.items.find((item) => item.id === id);
      if (!target || target.read) return feed;
      return {
        items: feed.items.map((item) => (item.id === id ? { ...item, read: true } : item)),
        unreadCount: Math.max(0, feed.unreadCount - 1),
      };
    },
  );
