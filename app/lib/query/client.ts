// One QueryClient. Not two.
//
// The reference implementation has a pair of near-identical factories — one
// mounted by the provider, one used by server prefetch — and they disagree:
// the browser one is missing `retry` and `retryDelay` entirely, so the retry
// policy everyone believes is configured has never once applied to a
// client-side query. Collapsing to a single factory is the fix.
//
// This must stay a module singleton in the browser. The React Compiler is off
// in this repo, so nothing is auto-memoised; a client constructed during
// render would be thrown away and rebuilt on every re-render, discarding the
// cache each time.

import { QueryClient, defaultShouldDehydrateQuery, isServer } from "@tanstack/react-query";
import { shouldRetry } from "@/app/lib/api/core";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A floor, not the real value — each hook sets its own from
        // STALE_TIME in keys.ts. Non-zero so a query hydrated from the server
        // doesn't immediately refetch on the client.
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        // Never retries a 4xx: the request itself is wrong, so repeating it
        // just delays the error the user needs to see.
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
        // A job dashboard that refetches every time you come back from your
        // email tab is noise; staleTime already covers freshness.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        // Mutations are user-initiated and often not idempotent — a silent
        // retry could double-post. Failures surface instead.
        retry: false,
      },
      dehydrate: {
        // Include in-flight queries so a streamed RSC can hand the client a
        // promise rather than making it start the request over.
        shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Server: a fresh client per request, so one user's data can never be handed
 * to another. Browser: the singleton, created once.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
