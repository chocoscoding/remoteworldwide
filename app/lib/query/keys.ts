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
    // The applications table. One list key: the board, the closed list, the log
    // dialog's duplicate check and every other reader derive from it, so a move
    // can never update one of them and not the rest.
    applications: () => [...qk.activity.all, "applications"] as const,
    gifts: () => [...qk.activity.all, "gifts"] as const,
    // Funnel, diagnosis, follow-ups owed and the weekly goal, computed server-side.
    summary: () => [...qk.activity.all, "summary"] as const,
    goals: () => [...qk.activity.all, "goals"] as const,
  },
  documents: {
    all: ["documents"] as const,
    list: () => [...qk.documents.all, "list"] as const,
  },
  pod: {
    all: ["pod"] as const,
    // One key, because the pod endpoint answers with the whole screen: feed,
    // goals, members and the pod itself move together on every action.
    overview: () => [...qk.pod.all, "overview"] as const,
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
  // Interview prep. Sessions are the AI service's saved interviews: a list per
  // track ("all" without one), and one session's detail, polled while its
  // analysis runs. `sessionLists()` is the prefix a create, finish or delete
  // invalidates, so every track's list refetches at once. `voiceConfig()` is
  // what the setup screen needs to offer and price a voice session.
  prep: {
    all: ["prep"] as const,
    tracks: () => [...qk.prep.all, "tracks"] as const,
    sessionLists: () => [...qk.prep.all, "sessions"] as const,
    sessions: (trackId?: string) => [...qk.prep.all, "sessions", trackId ?? "all"] as const,
    session: (id: string) => [...qk.prep.all, "session", id] as const,
    voiceConfig: () => [...qk.prep.all, "voiceConfig"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    // One key: the endpoint answers with the feed and the unread count together, and the bell
    // renders both, so splitting them would only create a state where they disagree.
    feed: () => [...qk.notifications.all, "feed"] as const,
  },
  // The user's plan. Services add to it without asking (follow-ups falling due,
  // prep reports), so it is refetched rather than trusted from disk.
  tasks: {
    all: ["tasks"] as const,
    list: (period: string, status?: string) => [...qk.tasks.all, "list", period, status ?? "any"] as const,
  },
  // Career coach conversations, from the AI service. Personal enough that they
  // stay out of the disk persister.
  coach: {
    all: ["coach"] as const,
    sessions: () => [...qk.coach.all, "sessions"] as const,
    session: (id: string) => [...qk.coach.all, "session", id] as const,
  },
  // The job picker. Saved jobs are this user's own list, written from every
  // job-aware screen; `lists()` is the prefix a save invalidates so every
  // search of it refetches at once. Listings are keyed by the text searched, so
  // each query caches on its own. An import is a progress record only the modal
  // watching it cares about.
  savedJobs: {
    all: ["savedJobs"] as const,
    lists: () => [...qk.savedJobs.all, "list"] as const,
    list: (q: string) => [...qk.savedJobs.all, "list", q] as const,
    detail: (id: string) => [...qk.savedJobs.all, "detail", id] as const,
  },
  platformJobs: {
    all: ["platformJobs"] as const,
    search: (q: string, limit: number) => [...qk.platformJobs.all, "search", q, limit] as const,
  },
  jobImports: {
    all: ["jobImports"] as const,
    detail: (id: string) => [...qk.jobImports.all, "detail", id] as const,
  },
  // Ask about a job, from the AI service: one thread per saved job, holding its
  // answers. Keyed by the saved job's id, not the thread's, because the screen's
  // only read is "open this job's thread", which finds or creates the thread for
  // the posting's current text and returns it. Kept out of the disk persister,
  // like `coach`: answers quote the user's resume.
  jobThreads: {
    all: ["jobThreads"] as const,
    forSavedJob: (savedJobId: string) => [...qk.jobThreads.all, "savedJob", savedJobId] as const,
  },
  // The resume editor's documents, from the AI service. One key: the list
  // carries every document whole. Kept out of the disk persister — it is
  // someone's CV, contact details and all.
  resumes: {
    all: ["resumes"] as const,
    list: () => [...qk.resumes.all, "list"] as const,
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
  notifications: 30_000, // the bell polls; anything longer and a badge lags a visible action
  tasks: 30_000, // services add to it; a follow-up due today should appear without a reload
  coach: 60_000, // only this user writes it, and every send updates the cache directly
  savedJobs: 30_000, // written from every job-aware screen, and each save invalidates it anyway
  platformJobs: 5 * 60_000, // admins post a few listings a day; a search minutes old is still true
  jobImports: 0, // a progress snapshot is stale the moment it lands, so a poll must always ask
  jobThreads: 5 * 60_000, // only this user writes it, each answer lands in the cache directly, and every refetch spends a rate-limited open
  resumes: 0, // the editor is seeded from it once per visit and autosaves past it, so a cached copy is always behind
};

/**
 * Which domains may be written to localStorage by the cache persister.
 *
 * This is the security-relevant decision in the data layer, so it is an
 * explicit allowlist rather than "persist whatever happens to be cached".
 * `billing` is excluded deliberately — it carries plan and payment identifiers
 * and has no business sitting on disk. `pod` is excluded for a different
 * reason: other people write it, so a disk-warm feed would present someone
 * else's stale activity as current. `documents` is excluded on the same
 * grounds as billing — a list of someone's CV, passport and work-permit
 * filenames has no business sitting on disk. The job picker's domains
 * (`savedJobs`, `platformJobs`, `jobImports`) stay out too: a saved job carries
 * the full text of postings someone is applying to, and an import snapshot
 * means nothing to anyone but the modal polling it. `prep` stays out as well:
 * its sessions hold the transcripts of recorded interviews and the reports on
 * them, and a signed playback link has no business outliving the page.
 */
export const PERSISTED_DOMAINS: ReadonlySet<QueryDomain> = new Set<QueryDomain>([
  "settings",
  "tracker",
  "activity",
  "network",
  "answers",
]);

/**
 * Keys inside a persisted domain that still stay in memory only. `activity` is
 * persisted for the header streak pill, but its server-backed lists are someone's
 * real job search — every company applied to, the funnel, the goal — and a
 * shared computer would hand them to whoever opens the dashboard next.
 */
const MEMORY_ONLY_KEYS: ReadonlySet<string> = new Set(
  [qk.activity.applications(), qk.activity.summary(), qk.activity.goals()].map((key) => key.join("/")),
);

/** True when a query's key belongs to a domain cleared for disk persistence. */
export function isPersistable(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  if (typeof root !== "string" || !PERSISTED_DOMAINS.has(root as QueryDomain)) return false;
  return !MEMORY_ONLY_KEYS.has(queryKey.slice(0, 2).join("/"));
}
