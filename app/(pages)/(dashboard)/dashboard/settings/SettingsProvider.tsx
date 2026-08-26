"use client";

// Settings — route-scoped state.
//
// Mounted by settings/layout.tsx so edits survive moving between sections
// (Profile -> Billing -> back) without being lifted to DashboardShell, since
// nothing outside /dashboard/settings reads it.
//
// Anything the dashboard already owns for real — credits, weekly target,
// hunt hour, paused state — is NOT duplicated here. Those come from
// ActivityProvider so the sidebar and the streak panel can't disagree with
// this screen. This holds only the settings that have no home yet.
//
// Mock-only: in-memory, resets on reload, same as every other domain here.

import { createContext, useContext, useState, type FC, type ReactNode } from "react";
import { RESUME } from "@/app/lib/dashboard/mock-data";

export interface ProfileState {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  timezone: string;
  summary: string;
  portfolio: string;
  linkedin: string;
  github: string;
  skills: string[];
}

export type RemotePolicy = "anywhere" | "overlap" | "region";
export type Availability = "immediately" | "two-weeks" | "month" | "browsing";

export interface PreferencesState {
  targetRoles: string[];
  minSalary: number;
  currency: "USD" | "GBP" | "EUR" | "NGN";
  remotePolicy: RemotePolicy;
  availability: Availability;
  openToContract: boolean;
  openToRelocation: boolean;
}

export interface NotificationsState {
  emailWeeklyDigest: boolean;
  emailReplyAlerts: boolean;
  emailPodActivity: boolean;
  emailProductNews: boolean;
  pushStreakReminder: boolean;
  pushInterviewReminder: boolean;
}

export interface PrivacyState {
  discoverableByRecruiters: boolean;
  showProfileToPod: boolean;
  shareOutcomesAnonymously: boolean;
  allowResumeIndexing: boolean;
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
  /** True once anything has been edited this session. */
  dirty: boolean;
  markSaved: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// Seeded from the resume so the profile isn't blank on first open — this is
// the same person the rest of the dashboard is built around.
const INITIAL_PROFILE: ProfileState = {
  fullName: RESUME.name,
  headline: RESUME.title,
  email: RESUME.email,
  phone: RESUME.phone,
  location: "Lagos, Nigeria",
  timezone: "GMT+1",
  summary: RESUME.summary,
  portfolio: RESUME.links.find((l) => l.label === "Portfolio")?.url ?? RESUME.portfolio,
  linkedin: RESUME.links.find((l) => l.label === "LinkedIn")?.url ?? "",
  github: "",
  skills: RESUME.skills,
};

const INITIAL_PREFERENCES: PreferencesState = {
  targetRoles: ["Senior Product Designer", "Product Designer", "Design Lead"],
  minSalary: 90000,
  currency: "USD",
  remotePolicy: "overlap",
  availability: "two-weeks",
  openToContract: true,
  openToRelocation: false,
};

const INITIAL_NOTIFICATIONS: NotificationsState = {
  emailWeeklyDigest: true,
  emailReplyAlerts: true,
  emailPodActivity: false,
  emailProductNews: false,
  pushStreakReminder: true,
  pushInterviewReminder: true,
};

const INITIAL_PRIVACY: PrivacyState = {
  discoverableByRecruiters: true,
  showProfileToPod: true,
  shareOutcomesAnonymously: true,
  allowResumeIndexing: false,
};

export const SettingsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [profile, setProfileState] = useState<ProfileState>(INITIAL_PROFILE);
  const [preferences, setPreferencesState] = useState<PreferencesState>(INITIAL_PREFERENCES);
  const [notifications, setNotificationsState] = useState<NotificationsState>(INITIAL_NOTIFICATIONS);
  const [privacy, setPrivacyState] = useState<PrivacyState>(INITIAL_PRIVACY);
  const [dirty, setDirty] = useState(false);

  function setProfile(patch: Partial<ProfileState>) {
    setProfileState((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }
  function setPreferences(patch: Partial<PreferencesState>) {
    setPreferencesState((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }
  function setNotifications(patch: Partial<NotificationsState>) {
    setNotificationsState((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }
  function setPrivacy(patch: Partial<PrivacyState>) {
    setPrivacyState((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }

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
        dirty,
        markSaved: () => setDirty(false),
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
