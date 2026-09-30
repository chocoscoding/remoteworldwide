// The one-time move of a browser board into the applications table, as pure
// functions: no React, no network, and no storage access of its own. What may
// reach someone's real applications is decided here and nowhere else.
//
// Until Part 2 Phase B the tracker lived in localStorage, written by
// `usePersistedState` as `{ v, data }` envelopes under `rww.tracker.board` (the
// five columns) and `rww.tracker.closed` (the closed cards). That board was
// SEEDED from `mock-data.ts`, so a stored copy holds the user's own cards and
// fabricated ones side by side: Linear, Deel, a rejection from Render three
// rounds in. Importing those would hand the career coach invented facts about
// someone's search, and the server cannot tell the two apart, so every card
// whose id belongs to the seed is dropped before anything is posted.

import { TRACKER_CLOSED_CARDS, TRACKER_COLUMNS } from "@/app/lib/dashboard/mock-data";
import {
  APPLICATION_LIMITS,
  APPLICATION_STAGES,
  CLOSED_REASONS,
  type ApplicationStage,
  type ApplicationStatus,
  type BoardImportCard,
  type ClosedReason,
} from "./types";

/** The stored board's keys as `usePersistedState` and `clearPersisted` name them, without the prefix. */
export const STORED_BOARD_KEYS = { board: "tracker.board", closed: "tracker.closed" } as const;

/** `usePersistedState`'s prefix, which makes the raw keys `rww.tracker.board` and `rww.tracker.closed`. */
export const STORAGE_PREFIX = "rww.";

/** The envelope version the board was written with: the old TrackerProvider's BOARD_VERSION. */
export const STORED_BOARD_VERSION = 1;

/** Every card id the seed board shipped with, open and closed. */
export const SEED_CARD_IDS: ReadonlySet<string> = new Set([
  ...TRACKER_COLUMNS.flatMap((column) => column.cards.map((card) => card.id)),
  ...TRACKER_CLOSED_CARDS.map((card) => card.id),
]);

/**
 * Far enough back for any real search. A stored number beyond it is corrupt,
 * and one card the server refuses would fail the import for every card.
 */
const MAX_DAYS_AGO = 3_650;

/** Room left in the backend's 120-character idempotency key once `board:` and a `~N` suffix are added. */
const CLIENT_ID_MAX = 100;

export interface StoredBoard {
  /** Whether this browser kept a board at all, readable or not. */
  found: boolean;
  /** The stored columns' data, or undefined when missing, unreadable or another version. */
  board: unknown;
  /** The stored closed cards' data, likewise. */
  closed: unknown;
}

/**
 * The stored board, read from `storage`. Null storage (Safari private mode,
 * storage blocked by policy) and a throwing read both come back as nothing
 * found: a browser that cannot keep storage never kept a board either.
 */
export function readStoredBoard(storage: Pick<Storage, "getItem"> | null): StoredBoard {
  if (!storage) return { found: false, board: undefined, closed: undefined };
  try {
    const rawBoard = storage.getItem(STORAGE_PREFIX + STORED_BOARD_KEYS.board);
    const rawClosed = storage.getItem(STORAGE_PREFIX + STORED_BOARD_KEYS.closed);
    return {
      found: rawBoard !== null || rawClosed !== null,
      board: unwrapStoredEnvelope(rawBoard),
      closed: unwrapStoredEnvelope(rawClosed),
    };
  } catch {
    return { found: false, board: undefined, closed: undefined };
  }
}

/** The data inside one stored envelope, or undefined when it is missing, unreadable or another version. */
export function unwrapStoredEnvelope(raw: string | null, version = STORED_BOARD_VERSION): unknown {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== version) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

/**
 * The stored board as import cards: seed cards dropped, malformed cards
 * dropped, text fitted to the backend's limits, at most `importMax` cards.
 *
 * `board` is the stored columns (`TrackerColumn[]`) and `closed` the stored
 * closed cards (`TrackerCard[]`), both as parsed JSON and trusted for nothing.
 *
 * Client ids are made unique. The old board numbered new cards `trk-added-1`,
 * `app-1` and so on from one on every page load, so a board used across two
 * sessions can hold two different applications under one id. The import keys
 * each row by that id, and the second would be skipped as already imported.
 * Repeats get a `~2`, `~3` suffix in board order, which is the same on every
 * retry of the same stored board, so a retried import still writes once.
 */
export function boardImportCards(board: unknown, closed: unknown): BoardImportCard[] {
  const cards: BoardImportCard[] = [];
  const usedIds = new Set<string>();

  const add = (raw: unknown, status: ApplicationStatus, closedFrom: ApplicationStage | null) => {
    if (!isRecord(raw) || typeof raw.id !== "string") return;
    const id = raw.id.trim();
    if (!id || SEED_CARD_IDS.has(id)) return;
    const company = text(raw.company, APPLICATION_LIMITS.companyMax);
    const role = text(raw.title, APPLICATION_LIMITS.roleMax);
    if (!company || !role) return;

    const base = id.slice(0, CLIENT_ID_MAX);
    let clientId = base;
    for (let repeat = 2; usedIds.has(clientId); repeat += 1) clientId = `${base}~${repeat}`;
    usedIds.add(clientId);

    const card: BoardImportCard = {
      clientId,
      company,
      role,
      status,
      daysAgo: days(raw.daysAgo),
      lastTouchedDaysAgo: days(raw.lastTouchedDaysAgo),
      roundsReached: whole(raw.roundsReached),
      rww: raw.rww === true,
    };
    if (isClosedReason(status)) {
      card.closedFrom = closedFrom;
      card.closedDaysAgo = days(raw.closedDaysAgo);
    }
    cards.push(card);
  };

  if (Array.isArray(board)) {
    for (const column of board) {
      if (!isRecord(column)) continue;
      const { id: stage, cards: columnCards } = column;
      if (!isStage(stage) || !Array.isArray(columnCards)) continue;
      for (const card of columnCards) add(card, stage, null);
    }
  }

  if (Array.isArray(closed)) {
    for (const card of closed) {
      if (!isRecord(card)) continue;
      const { closedReason, closedFrom } = card;
      if (!isClosedReason(closedReason)) continue;
      add(card, closedReason, isStage(closedFrom) ? closedFrom : null);
    }
  }

  // Past the backend's cap the tail stays behind rather than the whole import
  // failing. Nobody's own board is that long; the seed was 42 cards.
  return cards.slice(0, APPLICATION_LIMITS.importMax);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStage(value: unknown): value is ApplicationStage {
  return typeof value === "string" && (APPLICATION_STAGES as readonly string[]).includes(value);
}

function isClosedReason(value: unknown): value is ClosedReason {
  return typeof value === "string" && (CLOSED_REASONS as readonly string[]).includes(value);
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function days(value: unknown): number | null {
  const n = whole(value);
  return n === null ? null : Math.min(n, MAX_DAYS_AGO);
}

function whole(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}
