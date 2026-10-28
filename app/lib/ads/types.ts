// Ads on the site. A slot shows a custom ad the admin placed (the backend holds them:
// remoteworldwidebackend models/ad.model.ts) and, when none is running there, a Google AdSense unit
// (owner, 2026-10-28: Google for now, custom ads when one is booked). Who sees ads at all is the
// backend's call: signed-out visitors and Free accounts, never Basic and up. These mirror its shapes.

/** Where an ad can show. jobs-left / jobs-right flank the /jobs list from md up; jobs-bottom is a wide banner under it; job-sidebar sits under a job's tools on desktop, job-bottom under the Apply bar on phones. */
export const AD_SLOTS = ["jobs-left", "jobs-right", "jobs-bottom", "job-sidebar", "job-bottom"] as const;
export type AdSlotName = (typeof AD_SLOTS)[number];

export const AD_SLOT_LABELS: Record<AdSlotName, string> = {
  "jobs-left": "Jobs list, left",
  "jobs-right": "Jobs list, right",
  "jobs-bottom": "Jobs list, bottom banner",
  "job-sidebar": "Job page, under the tools",
  "job-bottom": "Job page on phones, under Apply",
};

/** Where "Want your ads here?" under every slot sends people. */
export const ADVERTISE_EMAIL = "contact@remoteworldwide.net";
export const ADVERTISE_HREF = `mailto:${ADVERTISE_EMAIL}?subject=${encodeURIComponent("Advertising on Remote Worldwide")}`;

/**
 * Google AdSense, from the site's build-time env. NEXT_PUBLIC_ADSENSE_CLIENT is the publisher id
 * (`ca-pub-…`); each slot needs its own ad unit id from AdSense, and a slot without one shows no
 * Google ad. Unset, Google is off everywhere and only custom ads show.
 */
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || null;

export const ADSENSE_UNITS: Record<AdSlotName, string | null> = {
  "jobs-left": process.env.NEXT_PUBLIC_ADSENSE_SLOT_JOBS_LEFT?.trim() || null,
  "jobs-right": process.env.NEXT_PUBLIC_ADSENSE_SLOT_JOBS_RIGHT?.trim() || null,
  "jobs-bottom": process.env.NEXT_PUBLIC_ADSENSE_SLOT_JOBS_BOTTOM?.trim() || null,
  "job-sidebar": process.env.NEXT_PUBLIC_ADSENSE_SLOT_JOB_SIDEBAR?.trim() || null,
  "job-bottom": process.env.NEXT_PUBLIC_ADSENSE_SLOT_JOB_BOTTOM?.trim() || null,
};

/** The AdSense unit for a slot, or null when Google is off for it. */
export const adsenseUnit = (slot: AdSlotName): string | null => (ADSENSE_CLIENT ? ADSENSE_UNITS[slot] : null);

/** A custom ad, as a slot shows it. */
export interface PublicAd {
  id: string;
  slot: AdSlotName;
  imageUrl: string;
  linkUrl: string;
  alt: string;
  advertiser: string | null;
}

/** GET /api/ads?slot=: whether this viewer gets ads at all, and the slot's custom ad if one runs. */
export interface SlotAnswer {
  show: boolean;
  ad: PublicAd | null;
}

export interface AdminAd extends PublicAd {
  name: string;
  slots: AdSlotName[];
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  weight: number;
  impressions: number;
  clicks: number;
  /** Switched on and inside its dates right now. */
  live: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdForm {
  name: string;
  advertiser: string | null;
  slots: AdSlotName[];
  imageUrl: string;
  linkUrl: string;
  alt: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  weight: number;
}
