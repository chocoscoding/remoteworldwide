// Browser-side calls for the applications table and the user's goals: the
// tracker board, logging an application, the funnel summary, the one-time
// board import, and goals.
//
// Every path is relative and goes through the `/api/applications/:path*` and
// `/api/goals/:path*` rewrites in `next.config.mjs`, so the Auth.js cookie
// rides along first-party and the backend's session guard sees the user.
// Nothing here reads the session or sends a token, which also makes this
// module browser-only, exactly like `app/lib/api/client.ts` beneath it.
//
// Plain functions rather than hooks, so the board importer can post once
// outside a mutation's lifecycle. `hooks/queries/useApplicationsQuery.ts` and
// `hooks/mutations/useApplicationMutations.ts` wrap them for caching. The pure
// helpers below the calls are how the tracker and the activity state read and
// change the same cached rows without either keeping a copy of its own.

import { apiDelete, apiGet, apiPatch, apiPost } from "@/app/lib/api/client";
import type { Application } from "@/app/lib/dashboard/activity";
import type { TrackerCard } from "@/app/lib/dashboard/types";
import {
  APPLICATION_LIMITS,
  CLOSED_REASONS,
  type ApplicationItem,
  type ApplicationStatus,
  type ApplicationSummary,
  type BoardImportInput,
  type BoardImportResult,
  type ClosedReason,
  type CreateApplicationInput,
  type DuplicateCheckQuery,
  type GoalsItem,
  type UpdateApplicationInput,
  type UpdateGoalsInput,
} from "./types";

export const APPLICATIONS_PATH = "/api/applications";
export const GOALS_PATH = "/api/goals";

// Ids go into the path, so they are encoded. An id is only ever an ObjectId
// from our own responses, but a "../" reaching here through a bad caller would
// otherwise address a different route behind the same rewrite.
const at = (id: string) => `${APPLICATIONS_PATH}/${encodeURIComponent(id)}`;

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

/** Every application, in board order: stage, then position. */
export function listApplications(signal?: AbortSignal) {
  return apiGet<ApplicationItem[]>(APPLICATIONS_PATH, signal);
}

/**
 * 201 with the new row, or 200 with the first one when `idempotencyKey` was
 * seen before. Both mean "this is the application", so callers treat every
 * 2xx alike. A new row goes on top of its column.
 */
export function createApplication(input: CreateApplicationInput) {
  return apiPost<ApplicationItem>(APPLICATIONS_PATH, input);
}

/** Any move, a touch, or a field edit. Another user's id is a 404, never a 403, so ids cannot be probed. */
export function updateApplication(id: string, input: UpdateApplicationInput) {
  return apiPatch<ApplicationItem>(at(id), input);
}

/** The response body is not part of the contract, so nothing reads it. */
export function deleteApplication(id: string) {
  return apiDelete<unknown>(at(id));
}

/**
 * The earlier application this one looks like, or null: `activity.ts`
 * `findDuplicate`'s rules, run over every row rather than the ones loaded. A
 * warning to show, never a reason to refuse the save.
 */
export function findDuplicateApplication(query: DuplicateCheckQuery, signal?: AbortSignal) {
  const search = new URLSearchParams({ company: query.company, role: query.role });
  if (query.url) search.set("url", query.url);
  return apiGet<ApplicationItem | null>(`${APPLICATIONS_PATH}/duplicate?${search.toString()}`, signal);
}

/** The funnel, `diagnose()`'s sentence, follow-ups owed and the week's goal, all counted server-side. */
export function getApplicationSummary(signal?: AbortSignal) {
  return apiGet<ApplicationSummary>(`${APPLICATIONS_PATH}/summary`, signal);
}

/**
 * The one-time board import. Seed cards must already be gone (see
 * `boardImport.ts`). Answers `alreadyImported: true` and writes nothing when
 * this user's board came over before, so a second tab posting too is harmless.
 */
export function importBoard(input: BoardImportInput) {
  return apiPost<BoardImportResult>(`${APPLICATIONS_PATH}/import`, input);
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

/** One row per user. */
export function getGoals(signal?: AbortSignal) {
  return apiGet<GoalsItem>(GOALS_PATH, signal);
}

/** Validated and clamped server-side, and answered with the whole row as stored. */
export function updateGoals(input: UpdateGoalsInput) {
  return apiPatch<GoalsItem>(GOALS_PATH, input);
}

// ---------------------------------------------------------------------------
// Preparing a write
// ---------------------------------------------------------------------------

/**
 * Limits the backend enforces that the frontend contract (./types.ts) does not
 * mirror yet. Their source is `APPLICATION_LIMITS` in
 * remoteworldwidebackend/src/types/applications.ts.
 */
const LOCATION_MAX = 120;
const URL_MAX = 2_000;

/**
 * An id for a row the browser shows before the server has written it. It is
 * also the create's idempotency key, so a retried create writes once. Random,
 * not a counter: the old `app-1` and `trk-added-1` restarted on every reload,
 * and two different applications could end up sharing one.
 */
export function newClientId(prefix: string): string {
  // randomUUID exists only in secure contexts, and a dev server reached over a
  // LAN address is not one.
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${random}`;
}

/** A backend id. Anything else in `savedJobId` would be refused, and take the whole create with it. */
export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

/**
 * A link the backend will store (http or https, protocol included), or null.
 * An application never fails to save over its link: something that is not a
 * URL is dropped here rather than sent to be refused, which would lose the row.
 */
export function applicationUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value || value.length > URL_MAX) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/**
 * A create, trimmed and fitted to the backend's limits, so a long company name
 * from a scraped posting is shortened rather than refused.
 */
export function applicationInput(input: CreateApplicationInput): CreateApplicationInput {
  return {
    ...input,
    company: input.company.trim().slice(0, APPLICATION_LIMITS.companyMax),
    role: input.role.trim().slice(0, APPLICATION_LIMITS.roleMax),
    location: input.location?.trim().slice(0, LOCATION_MAX) || null,
    url: applicationUrl(input.url),
  };
}

/**
 * The row a create will produce, for the cache to show before the server
 * answers: on top of its column, logged and touched now. The server's copy
 * replaces it on the next read.
 */
export function draftApplication(id: string, input: CreateApplicationInput, rows: readonly ApplicationItem[], now: Date): ApplicationItem {
  const status = input.status ?? "applied";
  const loggedAt = input.loggedAt ?? now.toISOString();
  return {
    id,
    company: input.company,
    role: input.role,
    location: input.location ?? null,
    url: input.url ?? null,
    savedJobId: input.savedJobId ?? null,
    // Joined by the server from the saved job; initials until its answer lands.
    companyLogo: null,
    source: input.source ?? "external",
    status,
    closedFrom: null,
    closedAt: null,
    loggedAt,
    lastTouchedAt: loggedAt,
    roundsReached: null,
    duplicateOf: input.duplicateOf ?? null,
    atsScore: input.atsScore ?? null,
    resumeId: input.resumeId ?? null,
    position: topPosition(rows, status),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * What a PATCH will do to a row, for the cache to show first. It mirrors the
 * backend's transition table, which is the tracker's own `setStatus`: stage to
 * stage restarts the silence clock; stage to outcome records the stage it died
 * in and when; outcome back to a stage clears both and restarts the clock; and
 * outcome to outcome corrects the reason and keeps the rest.
 */
export function applyApplicationUpdate(row: ApplicationItem, input: UpdateApplicationInput, now: Date): ApplicationItem {
  const iso = now.toISOString();
  const next: ApplicationItem = { ...row, updatedAt: now };
  if (input.company !== undefined) next.company = input.company;
  if (input.role !== undefined) next.role = input.role;
  if (input.location !== undefined) next.location = input.location;
  if (input.url !== undefined) next.url = input.url;
  if (input.roundsReached !== undefined) next.roundsReached = input.roundsReached;
  if (input.atsScore !== undefined) next.atsScore = input.atsScore;
  if (input.resumeId !== undefined) next.resumeId = input.resumeId;
  if (input.position !== undefined) next.position = input.position;
  if (input.touch) next.lastTouchedAt = iso;

  const to = input.status;
  if (to === undefined || to === row.status) return next;
  next.status = to;
  if (!isClosedApplicationStatus(to)) {
    next.closedFrom = null;
    next.closedAt = null;
    next.lastTouchedAt = iso;
  } else if (!isClosedApplicationStatus(row.status)) {
    next.closedFrom = row.status;
    next.closedAt = iso;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Reading the list
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function isClosedApplicationStatus(status: ApplicationStatus): status is ClosedReason {
  return (CLOSED_REASONS as readonly ApplicationStatus[]).includes(status);
}

/**
 * Whether a row is an application someone sent. A saved job is not one yet,
 * and neither is a saved job closed without ever being applied to.
 */
export function wasApplied(row: ApplicationItem): boolean {
  return row.status !== "saved" && row.closedFrom !== "saved";
}

/**
 * Whole days from `iso` to `now`. Never negative: a row stamped by a server
 * clock a few seconds ahead of this one was logged today, not tomorrow.
 */
export function daysSince(iso: string | null, now: number): number | undefined {
  if (!iso) return undefined;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return undefined;
  return Math.max(0, Math.floor((now - time) / DAY_MS));
}

/**
 * Column order: position ascending (a new row is written one below the lowest,
 * so it lands on top), then newest, then id, so two cards with equal positions
 * never trade places between renders.
 */
export function compareByPosition(a: ApplicationItem, b: ApplicationItem): number {
  return a.position - b.position || b.loggedAt.localeCompare(a.loggedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Outcome order: the latest verdict first, the order the closed list has always read in. */
export function compareByClosedAt(a: ApplicationItem, b: ApplicationItem): number {
  return (b.closedAt ?? "").localeCompare(a.closedAt ?? "") || compareByPosition(a, b);
}

/** Where a row lands when it arrives in `status`: one below the lowest position there, the backend's rule for a new row. */
export function topPosition(rows: readonly ApplicationItem[], status: ApplicationStatus): number {
  let lowest: number | null = null;
  for (const row of rows) {
    if (row.status === status && (lowest === null || row.position < lowest)) lowest = row.position;
  }
  return lowest === null ? 0 : lowest - 1;
}

export interface PositionWrite {
  id: string;
  position: number;
}

type Positioned = Pick<ApplicationItem, "id" | "position">;

/**
 * The position writes that leave `movedId` where it sits in `column` (a column
 * as it should read after a drop, the moved card included), changing as few
 * other cards as possible. The moved card's write is always first.
 *
 * Almost always that is one write: the midpoint of its neighbours, or one past
 * an end. Two cases need more, because a position equal to a neighbour's would
 * let the next read put the card back where it came from. Neighbours with EQUAL
 * positions have no number between them, so the moved card and the run of
 * equal cards below it are spread evenly up to the next larger position. And
 * every drop into the same gap halves it; after about fifty a double cannot
 * split it again, and the column is renumbered 0…n−1.
 */
export function planDropPositions(column: readonly Positioned[], movedId: string): PositionWrite[] {
  const index = column.findIndex((card) => card.id === movedId);
  if (index === -1) return [];

  if (index === 0) {
    const below = column[1];
    if (!below) return [{ id: movedId, position: 0 }];
    const position = below.position - 1;
    return position < below.position ? [{ id: movedId, position }] : renumber(column, movedId);
  }

  const floor = column[index - 1].position;
  // The moved card, then every card after it that does not sit above `floor`.
  let end = index + 1;
  while (end < column.length && !(column[end].position > floor)) end += 1;
  const run = column.slice(index, end);
  const ceiling = end < column.length ? column[end].position : null;
  const step = ceiling === null ? 1 : (ceiling - floor) / (run.length + 1);

  const writes: PositionWrite[] = [];
  let previous = floor;
  for (let k = 0; k < run.length; k += 1) {
    const position = floor + step * (k + 1);
    if (!(position > previous) || (ceiling !== null && !(position < ceiling))) return renumber(column, movedId);
    previous = position;
    if (k === 0 || position !== run[k].position) writes.push({ id: run[k].id, position });
  }
  return writes;
}

function renumber(column: readonly Positioned[], movedId: string): PositionWrite[] {
  const moved: PositionWrite[] = [];
  const others: PositionWrite[] = [];
  column.forEach((card, position) => {
    if (card.id === movedId) moved.push({ id: card.id, position });
    else if (card.position !== position) others.push({ id: card.id, position });
  });
  return [...moved, ...others];
}

/**
 * A row as a tracker card. `now` is a timestamp in milliseconds, passed in
 * because reading the clock during render is impure.
 */
export function toTrackerCard(row: ApplicationItem, now: number): TrackerCard {
  const card: TrackerCard = {
    id: row.id,
    title: row.role,
    company: row.company,
    daysAgo: daysSince(row.loggedAt, now),
    lastTouchedDaysAgo: daysSince(row.lastTouchedAt, now),
    rww: row.source === "internal",
  };
  if (row.roundsReached !== null) card.roundsReached = row.roundsReached;
  if (isClosedApplicationStatus(row.status)) {
    card.closedReason = row.status;
    card.closedDaysAgo = daysSince(row.closedAt, now);
    if (row.closedFrom) card.closedFrom = row.closedFrom;
  }
  return card;
}

/** A row as `activity.ts` records it, which is what the streak, the weekly count and the duplicate check read. */
export function toActivityApplication(row: ApplicationItem): Application {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    location: row.location ?? undefined,
    url: row.url ?? undefined,
    source: row.source,
    loggedAt: row.loggedAt,
    // `Application.status` is a column. A closed row sits in none, so it
    // reports the stage it was closed from.
    status: isClosedApplicationStatus(row.status) ? (row.closedFrom ?? "applied") : row.status,
    duplicateOf: row.duplicateOf ?? undefined,
    atsScore: row.atsScore ?? undefined,
  };
}
