"use client";

// Saving the extension settings — how a form-filling browser extension may use
// the saved-answer library. Stored on the account (PUT /api/settings/extension)
// because no extension exists yet: the choice is made now, on the Questions
// screen, and read by whatever fills forms later.
//
// A switch saves as it flips, optimistically, into the same `qk.settings.me()`
// entry every settings reader shares: a toggle that snapped back for a round
// trip would read as a broken switch. Failures roll back and toast; success is
// silent, because the dialog says where the choice is kept and a toast per flip
// would be noise.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPut } from "@/app/lib/api/client";
import { apiMessage } from "@/app/lib/api/core";
import { qk } from "@/app/lib/query/keys";
import type { ExtensionSettings, Settings } from "@/app/lib/settings/types";

export const EXTENSION_SETTINGS_PATH = "/api/settings/extension";

/**
 * The backend's defaults, for a settings object from a backend older than the
 * `extension` section: nothing fills as a form loads, and demographics stay off,
 * until the user turns them on.
 */
export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  fillOnLoad: false,
  draftNewQuestions: true,
  fillDemographics: false,
};

interface Context {
  previous: Settings | undefined;
}

export function useSaveExtensionSettings() {
  const queryClient = useQueryClient();

  return useMutation<Settings, unknown, Partial<ExtensionSettings>, Context>({
    mutationFn: (patch) => apiPut<Settings>(EXTENSION_SETTINGS_PATH, patch),

    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: qk.settings.me() });
      const previous = queryClient.getQueryData<Settings>(qk.settings.me());
      queryClient.setQueryData<Settings>(qk.settings.me(), (old) =>
        old ? { ...old, extension: { ...DEFAULT_EXTENSION_SETTINGS, ...old.extension, ...patch } } : old,
      );
      return { previous };
    },

    onError: (error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(qk.settings.me(), context.previous);
      toast.error(apiMessage(error));
    },

    // The response is the whole settings object: the cache becomes what was stored.
    onSuccess: (saved) => queryClient.setQueryData(qk.settings.me(), saved),

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.settings.me() });
    },
  });
}
