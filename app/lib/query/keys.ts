// The only place query keys are allowed to come from.
//
// ONE RULE: no literal key arrays anywhere in the app. Always `qk.something()`.
//
// That rule is not stylistic. The reference implementation this was ported from
// has a key factory that only three files actually use; everywhere else inlines
// arrays, and they have drifted far enough apart that some `invalidateQueries`
// calls can no longer match the query they are meant to refresh — a mutation
// succeeds, the cache is never busted, and the screen quietly shows stale data.
// A grep for `queryKey: [` in review is enough to keep that from happening here.
//
// Every dashboard domain has its namespace reserved below, including the ones
// still backed by mock providers. They are cheap to declare now and they mean
// each later migration picks up a key shape that already agrees with everything
// else, rather than inventing its own.

export const qk = {
  // --- live against the Express backend today ------------------------------
  settings: {
    all: ["settings"] as const,
    me: () => [...qk.settings.all, "me"] as const,
  },
  billing: {
    all: ["billing"] as const,
    overview: () => [...qk.billing.all, "overview"] as const,
  },

  // --- reserved; used as each domain's endpoints land ----------------------
  tracker: {
    all: ["tracker"] as const,
    board: () => [...qk.tracker.all, "board"] as const,
    closed: () => [...qk.tracker.all, "closed"] as const,
    card: (id: string) => [...qk.tracker.all, "card", id] as const,
  },
  activity: {
    all: ["activity"] as const,
    streak: () => [...qk.activity.all, "streak"] as const,
    applications: () => [...qk.activity.all, "applications"] as const,
    gifts: () => [...qk.activity.all, "gifts"] as const,
  },
  documents: {
    all: ["documents"] as const,
    list: () => [...qk.documents.all, "list"] as const,
  },
  pod: {
    all: ["pod"] as const,
    feed: () => [...qk.pod.all, "feed"] as const,
    goals: () => [...qk.pod.all, "goals"] as const,
  },
  network: {
    all: ["network"] as const,
    contacts: () => [...qk.network.all, "contacts"] as const,
    pipeline: () => [...qk.network.all, "pipeline"] as const,
  },
  answers: {
    all: ["answers"] as const,
    list: () => [...qk.answers.all, "list"] as const,
  },
  prep: {
    all: ["prep"] as const,
    tracks: () => [...qk.prep.all, "tracks"] as const,
    session: (id: string) => [...qk.prep.all, "session", id] as const,
  },
} as const;

/** Every domain's root segment — the persister's allowlist is keyed on these. */
export type QueryDomain = keyof typeof qk;

/**
 * How long each domain's data stays fresh before a background refetch.
 *
 * Decided in one table rather than per hook so nine separate judgment calls
 * don't produce nine different answers. The number is a function of how fast
 * the data actually changes and how wrong it looks when stale.
 */
export const STALE_TIME: Record<QueryDomain, number> = {
  settings: 5 * 60_000, // rarely edited, and fit scoring reads it on first paint
  billing: 5 * 60_000, // changes only at checkout
  tracker: 30_000, // the user edits it constantly
  activity: 60_000, // drives the header streak pill; stale reads as broken
  documents: 2 * 60_000, // changes only on upload
  pod: 30_000, // other people write it
  network: 5 * 60_000, // contact list moves slowly
  answers: 5 * 60_000, // the extension reads it; stale is harmless
  prep: 2 * 60_000, // in-flight session work
};

/**
 * Which domains may be written to localStorage by the cache persister.
 *
 * This is the security-relevant decision in the data layer, so it is an
 * explicit allowlist rather than "persist whatever happens to be cached".
 * `billing` is excluded deliberately — it carries plan and payment identifiers
 * and has no business sitting on disk. `pod` is excluded for a different
 * reason: other people write it, so a disk-warm feed would present someone
 * else's stale activity as current.
 */
export const PERSISTED_DOMAINS: ReadonlySet<QueryDomain> = new Set<QueryDomain>([
  "settings",
  "tracker",
  "activity",
  "documents",
  "network",
  "answers",
]);

/** True when a query's key belongs to a domain cleared for disk persistence. */
export function isPersistable(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return typeof root === "string" && PERSISTED_DOMAINS.has(root as QueryDomain);
}
