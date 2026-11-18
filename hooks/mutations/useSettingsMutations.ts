"use client";

// Saving settings, one mutation per section.
//
// Optimistic, because these are text fields the user just typed: showing them
// their own edit reverting for 300ms while a request flies is worse than
// showing it applied and correcting on the rare failure. The shape is
// cancel -> snapshot -> setQueryData -> rollback on error -> invalidate on
// settle, which is the one genuinely good mutation in the reference
// implementation.
//
// Every failure goes through `apiMessage`, so error copy is decided in one
// place rather than each call site rendering whatever string it happened to
// catch.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiPut } from "@/app/lib/api/client";
import { apiMessage } from "@/app/lib/api/core";
import { qk } from "@/app/lib/query/keys";
import type {
  EmailStatus,
  JobPreferences,
  NotificationSettings,
  PrivacySettings,
  ProfileSettings,
  Settings,
} from "@/app/lib/settings/types";

export type SettingsSection = "profile" | "preferences" | "notifications" | "privacy";

type SectionPatch = {
  profile: Partial<ProfileSettings>;
  preferences: Partial<JobPreferences>;
  notifications: Partial<NotificationSettings>;
  privacy: Partial<PrivacySettings>;
};

const PATH: Record<SettingsSection, string> = {
  profile: "/api/settings/profile",
  preferences: "/api/settings/preferences",
  notifications: "/api/settings/notifications",
  privacy: "/api/settings/privacy",
};

const SAVED_LABEL: Record<SettingsSection, string> = {
  profile: "Profile saved",
  preferences: "Preferences saved",
  notifications: "Notification settings saved",
  privacy: "Privacy settings saved",
};

interface Context {
  previous: Settings | undefined;
}

/**
 * One hook, parameterised by section, rather than four near-identical ones —
 * the sections differ only in their path and their slice of the object.
 */
export function useSaveSettingsSection<S extends SettingsSection>(section: S) {
  const queryClient = useQueryClient();

  return useMutation<Settings, unknown, SectionPatch[S], Context>({
    mutationFn: (patch) => apiPut<Settings>(PATH[section], patch),

    onMutate: async (patch) => {
      // Stop any in-flight refetch from landing on top of the optimistic write.
      await queryClient.cancelQueries({ queryKey: qk.settings.me() });
      const previous = queryClient.getQueryData<Settings>(qk.settings.me());

      queryClient.setQueryData<Settings>(qk.settings.me(), (old) =>
        old ? { ...old, [section]: { ...old[section], ...patch } } : old,
      );

      return { previous };
    },

    onError: (error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(qk.settings.me(), context.previous);
      toast.error(apiMessage(error));
    },

    onSuccess: (saved) => {
      // The response is the whole settings object, so the cache becomes what
      // the backend actually stored rather than what was typed.
      queryClient.setQueryData(qk.settings.me(), saved);
      toast.success(SAVED_LABEL[section]);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.settings.me() });
      // A switch turned back on by hand is no longer an unsubscribe to undo.
      if (section === "notifications") void queryClient.invalidateQueries({ queryKey: qk.settings.emailStatus() });
    },
  });
}

/**
 * The notifications tab's Resubscribe: every switch an emailed unsubscribe turned off goes back on
 * and a block on marketing mail is lifted. The answer carries the whole settings object and the
 * status as it now stands, so both caches take what the backend stored.
 */
export function useResubscribe() {
  const queryClient = useQueryClient();

  return useMutation<{ settings: Settings; status: EmailStatus }, unknown, void>({
    mutationFn: () => apiPost<{ settings: Settings; status: EmailStatus }>("/api/settings/resubscribe"),
    onSuccess: ({ settings, status }) => {
      queryClient.setQueryData(qk.settings.me(), settings);
      queryClient.setQueryData(qk.settings.emailStatus(), status);
      toast.success("You're resubscribed");
    },
    onError: (error) => {
      toast.error(apiMessage(error));
    },
  });
}
