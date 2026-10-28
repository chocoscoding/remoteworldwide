"use server";

// The ads screen (/heroshima/ads) talks to the backend through these server actions, the
// waitlist-admin pattern (libs/waitlist-admin.ts): each forwards the admin's own session cookie and
// the backend's isAdmin on /api/ads/admin is the boundary; requireAdminAction refuses a non-admin
// here first. They go server to backend directly, so no rewrite exposes /api/ads/admin.

import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/app/lib/auth/action-guards";
import { backend, BackendError, type BackendInit } from "@/app/lib/backend";
import type { AdForm, AdminAd } from "@/app/lib/ads/types";

const SCREEN = "/heroshima/ads";

const admin = <T>(path: string, init: BackendInit = {}) => backend<T>(`/ads/admin${path}`, { ...init, session: true });

/** A 4xx comes back as a message the screen can show; anything else is a real failure and throws. */
async function attempt<T>(run: () => Promise<T>): Promise<{ data: T; error?: never } | { error: string; data?: never }> {
  try {
    const data = await run();
    revalidatePath(SCREEN);
    return { data };
  } catch (error) {
    if (error instanceof BackendError && error.status < 500) return { error: error.message };
    throw error;
  }
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

export const listAds = async () => {
  await requireAdminAction();
  return admin<AdminAd[]>("");
};

export const createAd = async (form: AdForm) => {
  await requireAdminAction();
  return attempt(() => admin<AdminAd>("", { method: "POST", body: form }));
};

export const updateAd = async (id: string, changes: Partial<AdForm>) => {
  await requireAdminAction();
  if (!OBJECT_ID.test(id)) return { error: "Ad not found" };
  return attempt(() => admin<AdminAd>(`/${id}`, { method: "PATCH", body: changes }));
};

export const deleteAd = async (id: string) => {
  await requireAdminAction();
  if (!OBJECT_ID.test(id)) return { error: "Ad not found" };
  return attempt(() => admin<{ id: string }>(`/${id}`, { method: "DELETE" }));
};
