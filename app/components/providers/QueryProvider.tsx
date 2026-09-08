"use client";

// React Query, mounted once for the whole app, with a persisted cache.
//
// The persistence half is not a port — the reference implementation persists no
// query cache at all and re-warms from server prefetch on every load. Here the
// cache is written to localStorage so a reload paints real data immediately and
// revalidates behind it, which matters most on the dashboard where a cold load
// otherwise shows five skeletons at once.
//
// Two things make that safe:
//
//  1. `isPersistable` is an ALLOWLIST (see query/keys.ts). Only domains cleared
//     for disk get written. Billing is excluded because it carries plan and
//     payment identifiers; pod is excluded because other people write it and a
//     disk-warm feed would show stale activity as current.
//
//  2. Restored entries are re-revived. `JSON.stringify` turns a Date into an
//     ISO string, so without this every `createdAt` would come back as a string
//     and the first `date-fns` call downstream would throw.

import { useState, type FC, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider, type PersistedClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { getQueryClient } from "@/app/lib/query/client";
import { isPersistable } from "@/app/lib/query/keys";
import { revive } from "@/app/lib/api/core";

const CACHE_KEY = "rww.query-cache";
const MAX_AGE = 24 * 60 * 60_000;

/**
 * Bumping this discards every persisted cache entry. Change it whenever a
 * response shape changes, so a returning user can't hydrate last week's object
 * into this week's component.
 */
const CACHE_BUSTER = "v1";

/**
 * localStorage can throw outright — Safari private mode, storage disabled by
 * policy, quota exceeded. Every access is guarded and the failure mode is
 * simply "no persistence this session", never a broken app.
 */
function safeStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const probe = "__rww_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const QueryProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // The client itself is a module singleton; this only holds the persister,
  // which must be created in the browser and only once.
  const [persister] = useState(() => {
    const storage = safeStorage();
    if (!storage) return null;
    return createSyncStoragePersister({
      storage,
      key: CACHE_KEY,
      // Dates survive the round trip: stringify wrote them as ISO strings, so
      // parse has to turn them back. Same reviver the fetch layer uses.
      deserialize: (cached) => revive(JSON.parse(cached)) as PersistedClient,
    });
  });

  const queryClient = getQueryClient();

  // No usable storage — behave exactly like a normal QueryClientProvider.
  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: MAX_AGE,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === "success" && isPersistable(query.queryKey),
        },
      }}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </PersistQueryClientProvider>
  );
};

export default QueryProvider;
