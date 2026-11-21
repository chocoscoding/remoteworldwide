// The audience filters as short phrases: the chips in the editor, the add-filter menu, and the
// one-line summaries in lists. Pure, so the server list page and the client editor share it.

import { ENGAGEMENT_LABELS, type AudienceBuiltIn, type AudienceFilter, type AudiencePeopleCounts } from "@/app/lib/mail/types";
import { n } from "../format";

export const AUDIENCE_HREF = "/heroshima/outreach/audience";
export const UNTITLED_AUDIENCE = "Untitled audience";
/** The fixed audiences' names, should the backend send none. */
export const BUILT_IN_NAMES: Record<AudienceBuiltIn, string> = { all_users: "All users", all_outreachable: "All outreachable users" };

export type FilterKind = AudienceFilter["kind"];
export type FilterId = "plan" | "signedUp" | "active" | "away" | "resume" | "applications" | "credits" | "engagement" | "clicked" | "neverOpened" | "tag" | "source";
export type FilterContext = { campaigns: ReadonlyArray<{ id: string; name: string }> };

/** The filter keys a chip owns. includeIds, excludeIds and pickOnly are the hand picks, not filters. */
type FilterKey = Exclude<keyof AudienceFilter, "kind" | "includeIds" | "excludeIds" | "pickOnly">;

export type FilterDef = {
  id: FilterId;
  /** In the add-filter menu. */
  label: (kind: FilterKind) => string;
  kinds: readonly FilterKind[];
  keys: readonly FilterKey[];
  /** The chip's words, once it holds a value. */
  text: (f: AudienceFilter, ctx: FilterContext) => string;
  /** Set when the filter is added: a yes/no filter starts on, the rest start empty and open their popover. */
  start?: Partial<AudienceFilter>;
  /** No popover: the chip is only the phrase and its x. */
  fixed?: boolean;
};

const BOTH: readonly FilterKind[] = ["users", "subscribers"];
const USERS: readonly FilterKind[] = ["users"];
const SUBSCRIBERS: readonly FilterKind[] = ["subscribers"];

export const days = (value: number) => `${n(value)} day${value === 1 ? "" : "s"}`;
const cap = (word: string) => (word ? word[0].toUpperCase() + word.slice(1) : word);
const list = (values: readonly string[]) => values.join(", ");

/** "last 30 days", "over 90 days ago", "30 to 90 days ago". */
const sinceText = (within: number | undefined, before: number | undefined) => {
  if (within !== undefined && before !== undefined) return `${n(before)} to ${days(within)} ago`;
  if (within !== undefined) return `last ${days(within)}`;
  return `over ${days(before ?? 0)} ago`;
};

const applicationsText = (min: number | undefined, max: number | undefined) => {
  if (min !== undefined && max !== undefined) return min === max ? n(min) : `${n(min)} to ${n(max)}`;
  if (min !== undefined) return `${n(min)} or more`;
  return `${n(max ?? 0)} or fewer`;
};

export const FILTER_DEFS: readonly FilterDef[] = [
  {
    id: "plan",
    label: () => "Plan",
    kinds: USERS,
    keys: ["plans"],
    text: (f) => `Plan: ${list((f.plans ?? []).map(cap))}`,
  },
  {
    id: "signedUp",
    label: (kind) => (kind === "subscribers" ? "Joined" : "Signed up"),
    kinds: BOTH,
    keys: ["signedUpWithinDays", "signedUpBeforeDays"],
    text: (f) => `${f.kind === "subscribers" ? "Joined" : "Signed up"}: ${sinceText(f.signedUpWithinDays, f.signedUpBeforeDays)}`,
  },
  {
    id: "active",
    label: () => "Active lately",
    kinds: USERS,
    keys: ["activeWithinDays"],
    text: (f) => `Active: last ${days(f.activeWithinDays ?? 0)}`,
  },
  {
    id: "away",
    label: () => "Away",
    kinds: USERS,
    keys: ["inactiveForDays"],
    text: (f) => `Away ${n(f.inactiveForDays ?? 0)}+ days`,
  },
  {
    id: "resume",
    label: () => "Has a resume",
    kinds: USERS,
    keys: ["hasResume"],
    start: { hasResume: true },
    text: (f) => (f.hasResume ? "Has a resume" : "No resume"),
  },
  {
    id: "applications",
    label: () => "Applications",
    kinds: USERS,
    keys: ["minApplications", "maxApplications"],
    text: (f) => `Applications: ${applicationsText(f.minApplications, f.maxApplications)}`,
  },
  {
    id: "credits",
    label: () => "Credits",
    kinds: USERS,
    keys: ["creditsAtMost"],
    text: (f) => `Credits: ${n(f.creditsAtMost ?? 0)} or fewer`,
  },
  {
    id: "engagement",
    label: () => "Engagement",
    kinds: BOTH,
    keys: ["engagement"],
    text: (f) => `Engagement: ${list((f.engagement ?? []).map((l) => ENGAGEMENT_LABELS[l] ?? l))}`,
  },
  {
    id: "clicked",
    label: () => "Clicked a campaign",
    kinds: BOTH,
    keys: ["clickedCampaignId"],
    text: (f, ctx) => `Clicked: ${ctx.campaigns.find((c) => c.id === f.clickedCampaignId)?.name || "a campaign"}`,
  },
  {
    id: "neverOpened",
    label: () => "Never opened",
    kinds: BOTH,
    keys: ["neverOpened"],
    start: { neverOpened: true },
    fixed: true,
    text: () => "Never opened",
  },
  {
    id: "tag",
    label: () => "Tag",
    kinds: USERS,
    keys: ["mailTags"],
    text: (f) => `${(f.mailTags ?? []).length > 1 ? "Tags" : "Tag"}: ${list(f.mailTags ?? [])}`,
  },
  {
    id: "source",
    label: () => "Source",
    kinds: SUBSCRIBERS,
    keys: ["subscriberSources"],
    text: (f) => `${(f.subscriberSources ?? []).length > 1 ? "Sources" : "Source"}: ${list(f.subscriberSources ?? [])}`,
  },
];

export const defOf = (id: FilterId) => FILTER_DEFS.find((d) => d.id === id) as FilterDef;

const hasValue = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length);

/** The filter holds a value for this chip (hasResume false counts: "No resume"; neverOpened false does not). */
export const isActive = (def: FilterDef, f: AudienceFilter) => def.keys.some((k) => (k === "neverOpened" ? f.neverOpened === true : hasValue(f[k])));

/** The filter without this chip's keys. */
export const withoutDef = (def: FilterDef, f: AudienceFilter): AudienceFilter => {
  const out = { ...f };
  for (const k of def.keys) delete out[k];
  return out;
};

/** The chips in use for this kind, in menu order. */
export const activeDefs = (f: AudienceFilter) => FILTER_DEFS.filter((d) => d.kinds.includes(f.kind) && isActive(d, f));

/**
 * What a saved filter sends: with pickOnly only the kind and the picks; otherwise the filters with
 * the picks. Empty values and empty lists are dropped.
 */
export const filterToSave = (f: AudienceFilter): AudienceFilter => {
  if (f.pickOnly) return { kind: f.kind, pickOnly: true, includeIds: [...(f.includeIds ?? [])] };
  const out: AudienceFilter = { kind: f.kind };
  for (const def of activeDefs(f)) {
    for (const k of def.keys) {
      const v = f[k];
      if (!hasValue(v) || (k === "neverOpened" && v !== true)) continue;
      (out as Record<string, unknown>)[k] = v;
    }
  }
  if (f.includeIds?.length) out.includeIds = [...f.includeIds];
  if (f.excludeIds?.length) out.excludeIds = [...f.excludeIds];
  return out;
};

/** An audience in a few words, for lists: "Accounts · Plan: Free · Away 14+ days · 2 added, 1 removed". */
export const audienceSummary = (f: AudienceFilter | null | undefined, ctx: FilterContext = { campaigns: [] }) => {
  if (!f) return "Every account";
  const who = f.kind === "subscribers" ? "Subscribers" : "Accounts";
  if (f.pickOnly) return `${who} · picked by hand · ${n(f.includeIds?.length ?? 0)} ${f.includeIds?.length === 1 ? "person" : "people"}`;
  const parts = [who, ...activeDefs(f).map((d) => d.text(f, ctx))];
  if (parts.length === 1) parts.push(f.kind === "subscribers" ? "everyone" : "every account");
  const picks = [f.includeIds?.length ? `${n(f.includeIds.length)} added` : "", f.excludeIds?.length ? `${n(f.excludeIds.length)} removed` : ""].filter(Boolean);
  if (picks.length) parts.push(picks.join(", "));
  return parts.join(" · ");
};

/** People in the audience: the filters' matches less the removed plus the added (with pickOnly, the added). */
export const peopleIn = (c: AudiencePeopleCounts, pickOnly: boolean) => Math.max(0, pickOnly ? c.added : c.matching - c.removed + c.added);

/** "564 people · 3 removed · 2 added · 540 can get mail". */
export const peopleLine = (c: AudiencePeopleCounts, pickOnly = false) => {
  const people = peopleIn(c, pickOnly);
  const parts = [`${n(people)} ${people === 1 ? "person" : "people"}`];
  if (!pickOnly && c.removed) parts.push(`${n(c.removed)} removed`);
  if (!pickOnly && c.added) parts.push(`${n(c.added)} added`);
  if (people > 0) parts.push(c.reachable >= people ? "all can get mail" : `${n(c.reachable)} can get mail`);
  return parts.join(" · ");
};
