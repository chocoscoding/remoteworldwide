"use client";

// Settings — app-wide state, now backed by React Query.
//
// It is mounted app-wide rather than under the settings route because
// `targetRoles`, `minSalary` and `remotePolicy` are inputs to
// lib/dashboard/fit.ts: changing one moves every fit score on the recommend
// screen, so that screen has to read the same object.
//
// This is deliberately an ADAPTER, not a rewrite. Its context value is
// unchanged, so the ~30 call sites that read `useSettings()` did not move —
// the server state underneath swapped from `useState` to a cached query, and
// nothing above noticed. That is the migration path the remaining mock
// providers will follow.
//
// One design note worth keeping: the server object and the user's unsaved
// edits are held SEPARATELY. Drafts are per-section partials layered over the
// query data at read time, so there is no state to keep in sync and no effect
// mirroring server data into local state — which is both the `set-state-in-effect`
// rule and the reason the old version could show a saved value being overwritten
// by a stale local one.

import { createContext, useContext, useState, type FC, type ReactNode } from "react";
import { useSettingsQuery } from "@/hooks/queries/useSettingsQuery";
import { useSaveSettingsSection, type SettingsSection } from "@/hooks/mutations/useSettingsMutations";
import type {
  Availability,
  JobPreferences,
  NotificationSettings,
  PrivacySettings,
  ProfileSettings,
  RemotePolicy,
  Settings,
} from "@/app/lib/settings/types";

export type { Availability, RemotePolicy };
export type ProfileState = ProfileSettings;
export type PreferencesState = JobPreferences;
export type NotificationsState = NotificationSettings;
export type PrivacyState = PrivacySettings;
export type { SettingsSection };

const NO_DRAFTS: Drafts = { profile: {}, preferences: {}, notifications: {}, privacy: {} };

interface Drafts {
  profile: Partial<ProfileState>;
  preferences: Partial<PreferencesState>;
  notifications: Partial<NotificationsState>;
  privacy: Partial<PrivacyState>;
}

interface SettingsContextValue {
  profile: ProfileState;
  setProfile: (patch: Partial<ProfileState>) => void;
  preferences: PreferencesState;
  setPreferences: (patch: Partial<PreferencesState>) => void;
  notifications: NotificationsState;
  setNotifications: (patch: Partial<NotificationsState>) => void;
  privacy: PrivacyState;
  setPrivacy: (patch: Partial<PrivacyState>) => void;
  /** True once anything has been edited since the last successful save. */
  dirty: boolean;
  dirtySections: Record<SettingsSection, boolean>;
  saving: boolean;
  save: (section: SettingsSection) => void;
  markSaved: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: FC<{ initial: Settings; children: ReactNode }> = ({ initial, children }) => {
  // `initial` seeds the cache from the layout's server fetch, so the first
  // paint has real data and no request goes out until it goes stale.
  const { data } = useSettingsQuery(initial);
  // `initial` is always present here, so this only satisfies the type — the
  // query's `initialData` means `data` is populated from the first render.
  const server = data ?? initial;
  const [drafts, setDrafts] = useState<Drafts>(NO_DRAFTS);

  const saveProfile = useSaveSettingsSection("profile");
  const savePreferences = useSaveSettingsSection("preferences");
  const saveNotifications = useSaveSettingsSection("notifications");
  const savePrivacy = useSaveSettingsSection("privacy");
  const mutations = { profile: saveProfile, preferences: savePreferences, notifications: saveNotifications, privacy: savePrivacy };

  // Server value with the unsaved edits layered on top. Derived every render,
  // so a background refetch that changes something the user has NOT edited
  // shows through immediately, while their in-progress edit is never clobbered.
  const profile = { ...server.profile, ...drafts.profile };
  const preferences = { ...server.preferences, ...drafts.preferences };
  const notifications = { ...server.notifications, ...drafts.notifications };
  const privacy = { ...server.privacy, ...drafts.privacy };

  const edit = <S extends SettingsSection>(section: S, patch: Partial<Settings[S]>) =>
    setDrafts((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));

  function save(section: SettingsSection) {
    const patch = drafts[section];
    if (Object.keys(patch).length === 0) return;
    mutations[section].mutate(patch as never, {
      // Only the saved section's draft clears; edits elsewhere are untouched.
      onSuccess: () => setDrafts((prev) => ({ ...prev, [section]: {} })),
    });
  }

  const dirtySections: Record<SettingsSection, boolean> = {
    profile: Object.keys(drafts.profile).length > 0,
    preferences: Object.keys(drafts.preferences).length > 0,
    notifications: Object.keys(drafts.notifications).length > 0,
    privacy: Object.keys(drafts.privacy).length > 0,
  };

  return (
    <SettingsContext.Provider
      value={{
        profile,
        setProfile: (patch) => edit("profile", patch),
        preferences,
        setPreferences: (patch) => edit("preferences", patch),
        notifications,
        setNotifications: (patch) => edit("notifications", patch),
        privacy,
        setPrivacy: (patch) => edit("privacy", patch),
        dirty: Object.values(dirtySections).some(Boolean),
        dirtySections,
        saving: Object.values(mutations).some((m) => m.isPending),
        save,
        markSaved: () => setDrafts(NO_DRAFTS),
      }}>
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
