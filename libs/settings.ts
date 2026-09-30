"use server";

import { requireUserAction } from "@/app/lib/auth/action-guards";
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

// The settings screen saves through the browser (useSaveSettingsSection), so
// nothing imports these four, yet each is still a live endpoint: refuse a
// caller with no session here. The backend scopes every write to that session.
export const saveProfile = async (input: Partial<ProfileSettings>) => {
  await requireUserAction();
  return attempt(() => api<Settings>("/profile", { method: "PUT", body: input }));
};

export const savePreferences = async (input: Partial<JobPreferences>) => {
  await requireUserAction();
  return attempt(() => api<Settings>("/preferences", { method: "PUT", body: input }));
};

export const saveNotifications = async (input: Partial<NotificationSettings>) => {
  await requireUserAction();
  return attempt(() => api<Settings>("/notifications", { method: "PUT", body: input }));
};

export const savePrivacy = async (input: Partial<PrivacySettings>) => {
  await requireUserAction();
  return attempt(() => api<Settings>("/privacy", { method: "PUT", body: input }));
};
