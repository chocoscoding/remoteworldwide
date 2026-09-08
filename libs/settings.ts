"use server";

import { backend, BackendError, type BackendInit } from "@/app/lib/backend";
import type { JobPreferences, NotificationSettings, PrivacySettings, ProfileSettings, Settings } from "@/app/lib/settings/types";

const api = <T>(path: string, init: BackendInit = {}) => backend<T>(`/settings${path}`, { ...init, session: true });

// `error` is a required discriminant rather than an optional key so callers
// narrow to a non-null `data` after one `if (result.error)` guard.
type Attempt<T> = { data: T; error: null } | { data: null; error: string };

async function attempt<T>(run: () => Promise<T>): Promise<Attempt<T>> {
  try {
    const data = await run();
    return { data, error: null };
  } catch (error) {
    if (error instanceof BackendError && error.status < 500) return { data: null, error: error.message };
    throw error;
  }
}

export const getSettings = async () => api<Settings>("/me");

export const saveProfile = async (input: Partial<ProfileSettings>) => attempt(() => api<Settings>("/profile", { method: "PUT", body: input }));

export const savePreferences = async (input: Partial<JobPreferences>) => attempt(() => api<Settings>("/preferences", { method: "PUT", body: input }));

export const saveNotifications = async (input: Partial<NotificationSettings>) => attempt(() => api<Settings>("/notifications", { method: "PUT", body: input }));

export const savePrivacy = async (input: Partial<PrivacySettings>) => attempt(() => api<Settings>("/privacy", { method: "PUT", body: input }));
