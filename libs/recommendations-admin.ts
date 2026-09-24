"use server";

// The reviewers' screens (/heroshima/recommendations) talk to the backend
// through these server actions — the blog-admin pattern (libs/blog-admin.ts).
//
// Every call forwards the admin's own Auth.js session cookie (`session: true`)
// and the backend's isAdmin guard on /api/recommendations/admin is the
// boundary: a server action is reachable by a direct POST from anyone, so no
// check here is load-bearing, and no token is involved anywhere — nothing
// admin-shaped ever ships to a browser.

import { revalidatePath } from "next/cache";
import { backend, BackendError, backendOrNull, type BackendInit } from "@/app/lib/backend";
import type { PlatformJobSearchItem } from "@/app/lib/jobs/types";
import type {
  AdminRecommendationFilter,
  AdminRecommendationItem,
  AdminRecommendationList,
  CreateRecommendationInput,
  RecommendationCandidateMatch,
  UpdateRecommendationInput,
} from "@/app/lib/recommendations/types";

const admin = <T>(path: string, init: BackendInit = {}) => backend<T>(`/recommendations/admin${path}`, { ...init, session: true });

const at = (id: string) => `/${encodeURIComponent(id)}`;

/** A 4xx comes back as a message the form can show; anything else is a real failure and throws. */
async function attempt<T>(run: () => Promise<T>): Promise<{ data: T; error?: never } | { error: string; data?: never }> {
  try {
    const data = await run();
    revalidatePath("/heroshima/recommendations");
    return { data };
  } catch (error) {
    if (error instanceof BackendError && error.status < 500) return { error: error.message };
    throw error;
  }
}

export interface AdminRecommendationQuery {
  page?: number;
  status?: AdminRecommendationFilter;
  q?: string;
}

export const listAdminRecommendations = async ({ page = 1, status = "open", q = "" }: AdminRecommendationQuery = {}) => {
  const params = new URLSearchParams({ page: String(page), status });
  if (q.trim()) params.set("q", q.trim());
  return admin<AdminRecommendationList>(`?${params.toString()}`);
};

export const getAdminRecommendation = async (id: string) =>
  backendOrNull<AdminRecommendationItem>(`/recommendations/admin${at(id)}`, { session: true });

/**
 * The candidate picker: accounts whose email or name contains `q` (two
 * characters or more), each with whether they can be picked yet — a complete
 * profile and a master resume — and what is missing if not.
 */
export const searchRecommendationCandidates = async (q: string) =>
  admin<RecommendationCandidateMatch[]>(`/candidates?q=${encodeURIComponent(q.trim())}`);

/** A short-lived signed link to the candidate's master resume, for the reviewer to read. Null when they have none. */
export const candidateResumeLink = async (candidateId: string) =>
  backendOrNull<{ url: string; expiresAt: number; name: string }>(`/recommendations/admin/candidates${at(candidateId)}/resume`, { session: true });

/** The listing picker: live Remote Worldwide listings, newest first. */
export const searchRecommendationListings = async (q: string) =>
  backend<PlatformJobSearchItem[]>(`/platform-jobs/search?q=${encodeURIComponent(q.trim())}&limit=10`, { session: true });

export const createRecommendation = async (input: CreateRecommendationInput) =>
  attempt(() => admin<AdminRecommendationItem>("", { method: "POST", body: input }));

export const updateRecommendation = async (id: string, input: UpdateRecommendationInput) =>
  attempt(() => admin<AdminRecommendationItem>(at(id), { method: "PUT", body: input }));

export const deleteRecommendation = async (id: string) => attempt(() => admin<{ deleted: true }>(at(id), { method: "DELETE" }));
