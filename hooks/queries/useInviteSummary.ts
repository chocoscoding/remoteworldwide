"use client";

// Referral credits and the invite code, read through React Query.
//
// Two readers, on every dashboard screen: the sidebar's invite meter and the
// win share, whose link IS the invite link, so a win posted anywhere brings
// signups back to the person who posted it. Both read the counts-only summary
// rather than the invites page's paged overview, which carries names.
//
// Not persisted (see PERSISTED_DOMAINS in app/lib/query/keys.ts).

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/app/lib/api/client";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import { absoluteUrl } from "@/app/lib/seo";
import type { InviteSummary } from "@/app/lib/invites/types";

export const INVITE_SUMMARY_PATH = "/api/invites/summary";

const fetchInviteSummary = (signal?: AbortSignal) => apiGet<InviteSummary>(INVITE_SUMMARY_PATH, signal);

export function useInviteSummary() {
  return useQuery({
    queryKey: qk.invites.summary(),
    queryFn: ({ signal }) => fetchInviteSummary(signal),
    staleTime: STALE_TIME.invites,
  });
}

export interface InviteLink {
  /** Absolute, for share intents and the clipboard. */
  url: string;
  /** Scheme and www dropped, for printing on a card or a button. */
  display: string;
  /** False until the real code has arrived; `url` is the site root until then. */
  personal: boolean;
}

/** "https://www.remoteworldwide.net/j/amara" -> "remoteworldwide.net/j/amara". */
export const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/**
 * The user's own invite link, built the way the invites page builds it. While
 * the summary is loading (or failed) this is the bare site, never a made-up
 * code: a share that goes out a second early should still land somewhere real.
 */
export function useInviteLink(): InviteLink {
  const { data } = useInviteSummary();
  const url = data?.code ? absoluteUrl(`/j/${data.code}`) : absoluteUrl("/");
  return { url, display: displayUrl(url), personal: Boolean(data?.code) };
}
