"use client";

// Settings — app-wide state, hydrated from the backend in the dashboard layout
// and persisted per section through libs/settings.ts.
//
// It is mounted app-wide rather than under the settings route because
// `targetRoles`, `minSalary` and `remotePolicy` are inputs to
// lib/dashboard/fit.ts: changing one moves every fit score on the recommend
// screen, so that screen has to read the same object.

import { createContext, useContext, useState, useTransition, type FC, type ReactNode } from "react";
import { toast } from "sonner";
import { saveNotifications, savePreferences, savePrivacy, saveProfile } from "@/libs/settings";
import type { Availability, JobPreferences, NotificationSettings, PrivacySettings, ProfileSettings, RemotePolicy, Settings } from "@/app/lib/settings/types";

export type { Availability, RemotePolicy };
export type ProfileState = ProfileSettings;
export type PreferencesState = JobPreferences;
export type NotificationsState = NotificationSettings;
export type PrivacyState = PrivacySettings;

export type SettingsSection = "profile" | "preferences" | "notifications" | "privacy";

const CLEAN: Record<SettingsSection, boolean> = { profile: false, preferences: false, notifications: false, privacy: false };

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
  const [profile, setProfileState] = useState<ProfileState>(initial.profile);
  const [preferences, setPreferencesState] = useState<PreferencesState>(initial.preferences);
  const [notifications, setNotificationsState] = useState<NotificationsState>(initial.notifications);
  const [privacy, setPrivacyState] = useState<PrivacyState>(initial.privacy);
  const [dirtySections, setDirtySections] = useState<Record<SettingsSection, boolean>>(CLEAN);
  const [saving, startSaving] = useTransition();

  const touch = (section: SettingsSection) => setDirtySections((prev) => ({ ...prev, [section]: true }));

  function setProfile(patch: Partial<ProfileState>) {
    setProfileState((prev) => ({ ...prev, ...patch }));
    touch("profile");
  }
  function setPreferences(patch: Partial<PreferencesState>) {
    setPreferencesState((prev) => ({ ...prev, ...patch }));
    touch("preferences");
  }
  function setNotifications(patch: Partial<NotificationsState>) {
    setNotificationsState((prev) => ({ ...prev, ...patch }));
    touch("notifications");
  }
  function setPrivacy(patch: Partial<PrivacyState>) {
    setPrivacyState((prev) => ({ ...prev, ...patch }));
    touch("privacy");
  }

  // Every save answers with the whole settings object, so the local state is
  // replaced by what the backend actually stored rather than what was typed.
  const accept = (next: Settings, section: SettingsSection) => {
    setProfileState(next.profile);
    setPreferencesState(next.preferences);
    setNotificationsState(next.notifications);
    setPrivacyState(next.privacy);
    setDirtySections((prev) => ({ ...prev, [section]: false }));
  };

  function save(section: SettingsSection) {
    startSaving(async () => {
      const result = await run(section);
      if (result.error !== null) {
        toast.error(result.error);
        return;
      }
      accept(result.data, section);
      toast.success(LABELS[section]);
    });
  }

  const run = (section: SettingsSection) => {
    if (section === "profile") return saveProfile(profile);
    if (section === "preferences") return savePreferences(preferences);
    if (section === "notifications") return saveNotifications(notifications);
    return savePrivacy(privacy);
  };

  return (
    <SettingsContext.Provider
      value={{
        profile,
        setProfile,
        preferences,
        setPreferences,
        notifications,
        setNotifications,
        privacy,
        setPrivacy,
        dirty: Object.values(dirtySections).some(Boolean),
        dirtySections,
        saving,
        save,
        markSaved: () => setDirtySections(CLEAN),
      }}>
      {children}
    </SettingsContext.Provider>
  );
};

const LABELS: Record<SettingsSection, string> = {
  profile: "Profile saved",
  preferences: "Preferences saved",
  notifications: "Notification settings saved",
  privacy: "Privacy settings saved",
};

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
