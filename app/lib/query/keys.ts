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
    // The server's duplicate check for one job (the apply wizard's warning).
    // Nested under `applications()` on purpose: it stays memory-only with the
    // list, and every write that refreshes the list refreshes it too.
    applicationDuplicate: (company: string, role: string, url: string) =>
      [...qk.activity.applications(), "duplicate", company, role, url] as const,
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
    // Reserved and unused: the real contact list lives in `contacts` below,
    // which stays off disk. `network` is persisted, so don't cache people here.
    contacts: () => [...qk.network.all, "contacts"] as const,
    pipeline: () => [...qk.network.all, "pipeline"] as const,
  },
  // The saved-answer library and its use log, from the AI service. `history()`
  // is the "By application" view: which answers went out on which application.
  answers: {
    all: ["answers"] as const,
    list: () => [...qk.answers.all, "list"] as const,
    history: () => [...qk.answers.all, "history"] as const,
  },
  // Application drafts, from the AI service: what the extension kept of a form
  // left before applying. `list(status)` is one read per filter ("all" feeds
  // both of the drafts page's tabs); `all` is the prefix a delete or a fuse
  // invalidates. Kept out of the disk persister: a draft is someone's answers,
  // salary and phone number included, for jobs they have not applied to yet.
  drafts: {
    all: ["drafts"] as const,
    list: (status: string) => [...qk.drafts.all, "list", status] as const,
  },
  // Interview prep. Sessions are the AI service's saved interviews: a list per
  // track ("all" without one), and one session's detail, polled while its
  // analysis runs. `sessionLists()` is the prefix a create, finish or delete
  // invalidates, so every track's list refetches at once. `voiceConfig()` is
  // what the setup screen needs to offer and price a voice session.
  prep: {
    all: ["prep"] as const,
    // The user's saved tracks (backend), one list with each track's plan tasks
    // joined in; a track's detail adds the pasted posting, for the editor.
    tracks: () => [...qk.prep.all, "tracks"] as const,
    track: (id: string) => [...qk.prep.all, "track", id] as const,
    // A track's likely questions (AI service), written from its posting and the resume.
    questions: (trackId: string) => [...qk.prep.all, "questions", trackId] as const,
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
    /** The saved-jobs screen reads more rows than the picker; its own key so the two lengths never share a cache entry. */
    listUpTo: (q: string, limit: number) => [...qk.savedJobs.all, "list", q, limit] as const,
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
  // Referral search, from the AI service: the stored web search for one saved
  // job (people at the company, open roles, how to reach them). Kept out of the
  // disk persister: it is a list of real people's names and likely addresses.
  referrals: {
    all: ["referrals"] as const,
    forSavedJob: (savedJobId: string) => [...qk.referrals.all, "savedJob", savedJobId] as const,
  },
  // The user's own network (backend): LinkedIn connections, people kept from a
  // referral search, people added by hand — and the referral asks they have
  // sent, which is what "Asked" reads. Its own domain rather than `network`,
  // because `network` is persisted and this is personal data about people who
  // never signed up: names, employers, emails. `lists()` is the prefix every
  // write invalidates, so each page and filter of the list refetches at once.
  contacts: {
    all: ["contacts"] as const,
    lists: () => [...qk.contacts.all, "list"] as const,
    list: (params: object) => [...qk.contacts.all, "list", params] as const,
    detail: (id: string) => [...qk.contacts.all, "detail", id] as const,
    // Which of a search's people are already kept; keyed by the people asked about.
    lookup: (key: string) => [...qk.contacts.all, "lookup", key] as const,
    requests: () => [...qk.contacts.all, "requests"] as const,
  },
  // The resume editor's documents, from the AI service. One key: the list
  // carries every document whole. Kept out of the disk persister — it is
  // someone's CV, contact details and all.
  resumes: {
    all: ["resumes"] as const,
    list: () => [...qk.resumes.all, "list"] as const,
    // The same list read by the cover letter screen, which only needs the
    // newest one to write from. Its own key so a copy cached there is never
    // what the editor seeds itself from on the next visit.
    forCover: () => [...qk.resumes.all, "for-cover"] as const,
  },
  // The ATS scorer. `ingested()` is the list of CVs that have been parsed and
  // embedded — what a scan can name, which is NOT the same set as `documents`
  // (files) or `resumes` (things being written in the editor). A report is not
  // cached here: the screen holds the one on show, and the AI service caches
  // the scan itself against the resume version and the posting.
  ats: {
    all: ["ats"] as const,
    ingested: () => [...qk.ats.all, "ingested"] as const,
    // One ingested resume with its parsed content: what the apply wizard's
    // tailor and keyword tools run against.
    resume: (resumeId: string) => [...qk.ats.all, "resume", resumeId] as const,
    /** The latest stored scan against one posting, keyed by a hash of its text (`storedScanKey`) — never the text itself. */
    storedScan: (jdKey: string) => [...qk.ats.all, "stored-scan", jdKey] as const,
  },
  // Spoken conversations: whether talk mode is on per feature, and today's minutes.
  voice: {
    all: ["voice"] as const,
    config: () => [...qk.voice.all, "config"] as const,
  },
  // Referral credits from the invite link (backend): counts and the code only,
  // for the sidebar meter and the win share's link. Not persisted — it is
  // cheap, and a disk-warm copy would show last week's credits as current.
  // The invites page reads its own paged overview server-side, not this.
  invites: {
    all: ["invites"] as const,
    summary: () => [...qk.invites.all, "summary"] as const,
  },
  // The account itself (backend): which providers it signs in with, and whether a
  // deletion is scheduled. Not persisted — a disk-warm copy of "no deletion
  // scheduled" is exactly the answer that must never be stale.
  account: {
    all: ["account"] as const,
    signIn: () => [...qk.account.all, "sign-in"] as const,
    deletion: () => [...qk.account.all, "deletion"] as const,
  },
  // Recommendations (backend): the companies reviewers put this user in front
  // of, the company's questions and the answers sent. Its own domain rather than
  // `network.pipeline`, because `network` is persisted and this holds what the
  // user wrote to a hiring team and a reviewer's note about them — neither
  // belongs on a shared machine's disk. The "worth watching" listings are
  // `platformJobs` searches, scored in the browser, so they need no key here.
  recommendations: {
    all: ["recommendations"] as const,
    list: () => [...qk.recommendations.all, "list"] as const,
    detail: (id: string) => [...qk.recommendations.all, "detail", id] as const,
    eligibility: () => [...qk.recommendations.all, "eligibility"] as const,
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
  answers: 5 * 60_000, // only this user edits it, and every edit writes the cache directly
  drafts: 30_000, // the extension writes it from other tabs while a form is filled, and refetches on focus as well
  prep: 2 * 60_000, // in-flight session work
  notifications: 30_000, // the bell polls; anything longer and a badge lags a visible action
  tasks: 30_000, // services add to it; a follow-up due today should appear without a reload
  coach: 60_000, // only this user writes it, and every send updates the cache directly
  savedJobs: 30_000, // written from every job-aware screen, and each save invalidates it anyway
  platformJobs: 5 * 60_000, // admins post a few listings a day; a search minutes old is still true
  jobImports: 0, // a progress snapshot is stale the moment it lands, so a poll must always ask
  jobThreads: 5 * 60_000, // only this user writes it, each answer lands in the cache directly, and every refetch spends a rate-limited open
  referrals: 10 * 60_000, // only a search this user runs changes it, and that search writes the cache directly
  contacts: 60_000, // only this user writes it, and every write invalidates it; the hiring flag moves with live listings
  resumes: 0, // the editor is seeded from it once per visit and autosaves past it, so a cached copy is always behind
  ats: 2 * 60_000, // grows only when a CV is imported, which is the same cadence as documents
  voice: 60_000, // minutes drain during every call, and a switched-off feature must stop being offered
  invites: 5 * 60_000, // moves only when someone signs up or pays on your link, which is days apart
  account: 60_000, // read on one screen, and a connect made in another tab should show up on the next visit
  recommendations: 60_000, // reviewers write it from the admin screens; a company's questions should appear within a minute of the bell
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
 * filenames has no business sitting on disk, and `ats` is excluded for exactly
 * the same reason: it is the same filenames, one store further along. The job picker's domains
 * (`savedJobs`, `platformJobs`, `jobImports`) stay out too: a saved job carries
 * the full text of postings someone is applying to, and an import snapshot
 * means nothing to anyone but the modal polling it. `prep` stays out as well:
 * its sessions hold the transcripts of recorded interviews and the reports on
 * them, and a signed playback link has no business outliving the page.
 * `answers` came out once it held real rows: the library carries salary
 * expectations, work authorisation and self-identified race, gender and
 * disability, and its history names every company applied to — none of which
 * belongs on a shared machine's disk.
 */
export const PERSISTED_DOMAINS: ReadonlySet<QueryDomain> = new Set<QueryDomain>([
  "settings",
  "tracker",
  "activity",
  "network",
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
