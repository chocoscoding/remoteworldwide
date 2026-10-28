// Ads the admin places on the site. The backend holds them (remoteworldwidebackend
// models/ad.model.ts) and decides who is sent one: signed-out visitors and Free accounts, never
// Basic and up. These mirror its shapes.

/** Where an ad can show. jobs-left / jobs-right flank the /jobs list from md up; job-sidebar sits under a job's tools. */
export const AD_SLOTS = ["jobs-left", "jobs-right", "job-sidebar"] as const;
export type AdSlotName = (typeof AD_SLOTS)[number];

export const AD_SLOT_LABELS: Record<AdSlotName, string> = {
  "jobs-left": "Jobs list, left",
  "jobs-right": "Jobs list, right",
  "job-sidebar": "Job page, under the tools",
};

/** What a slot shows. */
export interface PublicAd {
  id: string;
  slot: AdSlotName;
  imageUrl: string;
  linkUrl: string;
  alt: string;
  advertiser: string | null;
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
