// The users screen's Export (/heroshima/users): which fields it offers, how a selection is sent,
// and how the backend's rows become a CSV or TXT file. The backend
// (services/admin/analyticsService.ts exportUsers) reads the values; the labels and the file are
// made here, in the browser, so nothing is written to disk on a server.

import { PLAN_TIER_NAMES, isPlanTier } from "@/app/lib/settings/types";
import { MAIL_LEVEL_LABELS, isMailLevel } from "@/app/lib/mail/userMail";

/** Same keys, same order as the backend's EXPORT_FIELDS. */
export const EXPORT_FIELDS = [
  "id",
  "name",
  "firstName",
  "lastName",
  "email",
  "role",
  "verified",
  "createdAt",
  "tier",
  "planStatus",
  "interval",
  "periodEnd",
  "creditBalance",
  "lastSeenAt",
  "firstSeenAt",
  "lastFeature",
  "lastPath",
  "device",
  "events30d",
  "eventCount",
  "applications",
  "headline",
  "location",
  "timezone",
  "phone",
  "linkedin",
  "targetRoles",
  "experienceLevel",
  "emailOffers",
  "emailProductNews",
  "emailWeeklyDigest",
  "mailLevel",
  "mailLastClickAt",
  "mailSent30d",
] as const;
export type ExportField = (typeof EXPORT_FIELDS)[number];
export type ExportValue = string | number | boolean | null;

export const isExportField = (value: unknown): value is ExportField => typeof value === "string" && (EXPORT_FIELDS as readonly string[]).includes(value);

/** The column name in the file and the tick box's label. Dates are UTC, so their names say so. */
export const EXPORT_FIELD_LABELS: Record<ExportField, string> = {
  id: "User id",
  name: "Name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  role: "Role",
  verified: "Email verified",
  createdAt: "Joined (UTC)",
  tier: "Plan",
  planStatus: "Plan status",
  interval: "Billing",
  periodEnd: "Plan renews or ends (UTC)",
  creditBalance: "Credits left",
  lastSeenAt: "Last active (UTC)",
  firstSeenAt: "First seen (UTC)",
  lastFeature: "Last on",
  lastPath: "Last page",
  device: "Device",
  events30d: "Actions, 30 days",
  eventCount: "Actions, all time",
  applications: "Applications",
  headline: "Headline",
  location: "Location",
  timezone: "Time zone",
  phone: "Phone",
  linkedin: "LinkedIn",
  targetRoles: "Target roles",
  experienceLevel: "Experience",
  emailOffers: "Offer emails on",
  emailProductNews: "Product news on",
  emailWeeklyDigest: "Weekly digest on",
  mailLevel: "Mail engagement",
  mailLastClickAt: "Last mail click (UTC)",
  mailSent30d: "Mails, 30 days",
};

export const EXPORT_FIELD_GROUPS: { title: string; fields: ExportField[] }[] = [
  {
    title: "Account",
    fields: ["name", "firstName", "lastName", "email", "id", "role", "verified", "createdAt"],
  },
  {
    title: "Plan",
    fields: ["tier", "planStatus", "interval", "periodEnd", "creditBalance"],
  },
  {
    title: "Activity",
    fields: ["lastSeenAt", "firstSeenAt", "lastFeature", "lastPath", "device", "events30d", "eventCount", "applications"],
  },
  {
    title: "Profile",
    fields: ["headline", "location", "timezone", "phone", "linkedin", "targetRoles", "experienceLevel"],
  },
  {
    title: "Email choices",
    fields: ["emailOffers", "emailProductNews", "emailWeeklyDigest"],
  },
  {
    title: "Mail",
    fields: ["mailLevel", "mailLastClickAt", "mailSent30d"],
  },
];

export const DEFAULT_EXPORT_FIELDS: ExportField[] = ["name", "email", "tier", "createdAt", "lastSeenAt"];

const DATE_FIELDS = new Set<ExportField>(["createdAt", "periodEnd", "lastSeenAt", "firstSeenAt", "mailLastClickAt"]);

export type ExportFormat = "csv" | "txt";

/** Who goes in the file: people ticked one by one, or everyone the search (and mail level) matches less the unticked. */
export type UserSelection = { mode: "ids"; ids: string[] } | { mode: "all"; q: string; mail?: string; except: string[] };

export interface UserExport {
  fields: ExportField[];
  rows: Record<string, ExportValue>[];
  truncated: boolean;
}

/** One value as the file shows it: "2026-11-06 14:03" for dates (UTC), Yes/No, the plan's name. */
export function exportCell(field: ExportField, value: ExportValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (DATE_FIELDS.has(field) && typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(0, 16).replace("T", " ");
  }
  if (field === "tier" && isPlanTier(value)) return PLAN_TIER_NAMES[value];
  if (field === "mailLevel" && isMailLevel(value)) return MAIL_LEVEL_LABELS[value];
  return String(value);
}

/**
 * A CSV cell. Quoted when it holds a comma, quote or line break. Text a spreadsheet would run as
 * a formula (a name typed as "=HYPERLINK(...)") gets a leading apostrophe, so opening the file
 * runs nothing; numbers are left alone.
 */
function csvCell(text: string, raw: ExportValue): string {
  const safe = typeof raw === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A TXT cell: tabs and line breaks inside a value become spaces, so one person stays one line. */
const txtCell = (text: string): string => text.replace(/[\t\r\n]+/g, " ");

/**
 * The file's text. CSV: comma separated, CRLF, with a byte-order mark so Excel reads accents right.
 * TXT: one person per line, values separated by tabs (a single field gives a plain list, one per
 * line, ready to paste). `header` puts the column names on the first line.
 */
export function buildUserExport(data: Pick<UserExport, "fields" | "rows">, format: ExportFormat, header = true): string {
  const { fields, rows } = data;
  if (format === "csv") {
    const lines = rows.map((row) => fields.map((f) => csvCell(exportCell(f, row[f] ?? null), row[f] ?? null)).join(","));
    if (header) lines.unshift(fields.map((f) => csvCell(EXPORT_FIELD_LABELS[f], EXPORT_FIELD_LABELS[f])).join(","));
    return `﻿${lines.join("\r\n")}\r\n`;
  }
  const lines = rows.map((row) => fields.map((f) => txtCell(exportCell(f, row[f] ?? null))).join("\t"));
  if (header) lines.unshift(fields.map((f) => EXPORT_FIELD_LABELS[f]).join("\t"));
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------------------------
// Picking people (the users table's checkboxes)

/**
 * Who is ticked. `picked` holds rows ticked by hand and stays as the admin pages and searches, so
 * "some" can be gathered from anywhere. `every` is the banner's "Select all N": everyone the search
 * `q` matches (within the mail level `mail`, when one is picked), on every page, less the rows
 * unticked after (`except`). It belongs to its search and level, so a different one shows it as
 * nothing picked.
 */
export interface UsersPick {
  picked: string[];
  every: { q: string; mail?: string; except: string[] } | null;
}

export const NO_PICK: UsersPick = { picked: [], every: null };

export type PickAction = { type: "row"; id: string } | { type: "page" } | { type: "every" } | { type: "clear" };

export interface PickView {
  /** The pick in force for this search (a stale "everyone" reads as nothing). */
  state: UsersPick;
  /** Ticked rows on this page. */
  checked: ReadonlySet<string>;
  allOnPage: boolean;
  /** Some but not all: the header checkbox's indeterminate state. */
  someOnPage: boolean;
  every: boolean;
  /** How many people the file would hold. */
  count: number;
  /** The whole page is ticked and the search has more: offer "Select all N". */
  offerEvery: boolean;
}

const OBJECT_ID = /^[a-f\d]{24}$/i;
const idsOf = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === "string" && OBJECT_ID.test(v)))] : [];

/** A pick read back from storage, or nothing when it isn't one. */
export function parsePick(raw: string | null): UsersPick {
  if (!raw) return NO_PICK;
  try {
    const value = JSON.parse(raw) as {
      picked?: unknown;
      every?: { q?: unknown; mail?: unknown; except?: unknown } | null;
    };
    const every =
      value.every && typeof value.every.q === "string"
        ? { q: value.every.q, ...(isMailLevel(value.every.mail) ? { mail: value.every.mail } : {}), except: idsOf(value.every.except) }
        : null;
    return { picked: every ? [] : idsOf(value.picked), every };
  } catch {
    return NO_PICK;
  }
}

/** `mail` is the list's mail level, "" for anyone. */
export function pickView(stored: UsersPick, pageIds: readonly string[], q: string, total: number, mail = ""): PickView {
  const state = stored.every && (stored.every.q !== q || (stored.every.mail ?? "") !== mail) ? NO_PICK : stored;
  const except = new Set(state.every?.except ?? []);
  const picked = new Set(state.picked);
  const checked = new Set(pageIds.filter((id) => (state.every ? !except.has(id) : picked.has(id))));
  const allOnPage = pageIds.length > 0 && checked.size === pageIds.length;
  // Never fewer than the page shows ticked, should the total lag the rows.
  const count = state.every ? Math.max(checked.size, total - except.size) : picked.size;
  return {
    state,
    checked,
    allOnPage,
    someOnPage: checked.size > 0 && !allOnPage,
    every: Boolean(state.every),
    count,
    offerEvery: !state.every && allOnPage && total > picked.size,
  };
}

/** The next pick, after a checkbox, the banner or Clear. */
export function nextPick(stored: UsersPick, action: PickAction, pageIds: readonly string[], q: string, total: number, mail = ""): UsersPick {
  const view = pickView(stored, pageIds, q, total, mail);
  const { state } = view;
  const toggle = (list: string[], ids: readonly string[], on: boolean) => {
    const set = new Set(list);
    for (const id of ids) {
      if (on) set.add(id);
      else set.delete(id);
    }
    return [...set];
  };
  switch (action.type) {
    case "clear":
      return NO_PICK;
    case "every":
      return { picked: [], every: { q, ...(mail ? { mail } : {}), except: [] } };
    case "page":
      // Ticked means "in the file": in every-mode that is NOT being in `except`.
      if (state.every)
        return {
          picked: [],
          every: {
            ...state.every,
            except: toggle(state.every.except, pageIds, view.allOnPage),
          },
        };
      return {
        picked: toggle(state.picked, pageIds, !view.allOnPage),
        every: null,
      };
    case "row": {
      if (!pageIds.includes(action.id)) return state;
      const on = !view.checked.has(action.id);
      if (state.every)
        return {
          picked: [],
          every: {
            ...state.every,
            except: toggle(state.every.except, [action.id], !on),
          },
        };
      return { picked: toggle(state.picked, [action.id], on), every: null };
    }
    default:
      return state;
  }
}

/** What the export action is sent for a pick. */
export const selectionOf = (state: UsersPick): UserSelection =>
  state.every
    ? { mode: "all", q: state.every.q, ...(state.every.mail ? { mail: state.every.mail } : {}), except: state.every.except }
    : { mode: "ids", ids: state.picked };

/** rww-users-2026-11-06.csv */
export const exportFileName = (format: ExportFormat, now = new Date()): string => `rww-users-${now.toISOString().slice(0, 10)}.${format}`;
