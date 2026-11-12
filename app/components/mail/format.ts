// Number, money and time formatting for the admin Mail screens. Pure, so server and client share it.

import { DURATION_LABELS, ENGAGEMENT_LABELS, type AudienceFilter, type MailOffer, type OfferChoice, type Totals, type When } from "@/app/lib/mail/types";

export const n = (value: number | null | undefined) => (Number(value) || 0).toLocaleString("en-GB");

/** A 0 to 1 rate as a percentage. */
export const pct = (rate: number | null | undefined, digits = 1) => `${((Number(rate) || 0) * 100).toFixed(digits)}%`;

export const ratio = (part: number | null | undefined, whole: number | null | undefined) => {
  const w = Number(whole) || 0;
  return w > 0 ? (Number(part) || 0) / w : 0;
};

export const money = (cents: number | null | undefined) => {
  const c = Number(cents) || 0;
  return `$${(c / 100).toLocaleString("en-GB", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
};

const valid = (value: When | null | undefined): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const dateTime = (value: When | null | undefined, fallback = "") => {
  const d = valid(value);
  return d ? d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : fallback;
};

export const day = (value: When | null | undefined, fallback = "") => {
  const d = valid(value);
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : fallback;
};

/** "3 h ago" style. `now` is passed in so a render stays pure. */
export const ago = (value: When | null | undefined, now: number, fallback = "Never") => {
  const d = valid(value);
  if (!d) return fallback;
  const ms = now - d.getTime();
  if (ms < 0) return `in ${until(-ms)}`;
  if (ms < 60_000) return "Just now";
  return `${until(ms)} ago`;
};

const until = (ms: number) => {
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
};

/** Hours as "36 h (1.5 d)". */
export const hours = (h: number | null | undefined) => {
  const v = Number(h) || 0;
  return v >= 24 ? `${v} h (${+(v / 24).toFixed(1)} d)` : `${v} h`;
};

/** An ISO time as a datetime-local value in this browser's zone, and back. */
export const toLocalInput = (iso: When | null | undefined) => {
  const d = valid(iso);
  if (!d) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

export const EMPTY_TOTALS: Totals = { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, unsubscribed: 0, bounced: 0, complained: 0, converted: 0, revenueCents: 0 };

/** A slug for keys: lower case, dashes, at most 60 characters. */
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

/** A number input's value: empty is undefined. */
export const numOrUndef = (value: string): number | undefined => {
  if (value.trim() === "") return undefined;
  const v = Number(value);
  return Number.isFinite(v) ? v : undefined;
};

export const listFromText = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const offerLabel = (o: Pick<MailOffer, "kind" | "percentOff" | "amountOffCents">) =>
  o.kind === "percent" ? `${o.percentOff ?? 0}%` : `$${((o.amountOffCents ?? 0) / 100).toFixed((o.amountOffCents ?? 0) % 100 ? 2 : 0)}`;

/** The problem with a choice, if any: a percent above the Outreach settings ceiling, or a bad validity. */
export const offerChoiceProblem = (choice: OfferChoice | null | undefined, offers: MailOffer[], maxDiscountPercent: number): string | null => {
  if (!choice) return null;
  const offer = offers.find((o) => o.id === choice.offerId);
  if (!offer) return "Pick an offer.";
  const percent = choice.percentOverride ?? (offer.kind === "percent" ? offer.percentOff : null);
  if (percent !== null && percent !== undefined && (percent < 1 || percent > maxDiscountPercent)) return `The discount must be 1 to ${maxDiscountPercent}% (Outreach settings).`;
  const hours = choice.validHoursOverride ?? offer.validHours;
  if (!(hours >= 1)) return "The code must be valid for at least 1 hour.";
  return null;
};

/** Drops empty values so the saved filter only names what was set. */
export const cleanFilter = (filter: AudienceFilter): AudienceFilter => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filter)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  return out as AudienceFilter;
};

/** An audience filter in a few words, for lists. */
export const filterSummary = (filter: AudienceFilter | null | undefined): string => {
  if (!filter) return "Everyone";
  const parts: string[] = [filter.kind === "subscribers" ? "Subscribers" : "Accounts"];
  if (filter.plans?.length) parts.push(`plan ${filter.plans.join("/")}`);
  if (filter.signedUpWithinDays !== undefined) parts.push(`joined in ${filter.signedUpWithinDays} d`);
  if (filter.signedUpBeforeDays !== undefined) parts.push(`joined over ${filter.signedUpBeforeDays} d ago`);
  if (filter.activeWithinDays !== undefined) parts.push(`active in ${filter.activeWithinDays} d`);
  if (filter.inactiveForDays !== undefined) parts.push(`inactive ${filter.inactiveForDays} d`);
  if (filter.hasResume !== undefined) parts.push(filter.hasResume ? "has resume" : "no resume");
  if (filter.minApplications !== undefined) parts.push(`${filter.minApplications}+ applications`);
  if (filter.maxApplications !== undefined) parts.push(`at most ${filter.maxApplications} applications`);
  if (filter.creditsAtMost !== undefined) parts.push(`credits at most ${filter.creditsAtMost}`);
  if (filter.engagement?.length) parts.push(filter.engagement.map((l) => ENGAGEMENT_LABELS[l] ?? l).join("/"));
  if (filter.clickedCampaignId) parts.push("clicked a campaign");
  if (filter.neverOpened) parts.push("never opened");
  if (filter.mailTags?.length) parts.push(`tagged ${filter.mailTags.join(", ")}`);
  if (filter.subscriberSources?.length) parts.push(`from ${filter.subscriberSources.join(", ")}`);
  return parts.join(" · ");
};

export const durationText = (o: Pick<MailOffer, "duration" | "durationMonths">) =>
  o.duration === "repeating" ? `First ${o.durationMonths ?? "?"} months` : (DURATION_LABELS[o.duration] ?? o.duration);
