"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPut } from "@/app/lib/api/client";
import { apiMessage } from "@/app/lib/api/core";
import { qk } from "@/app/lib/query/keys";
import type { Settings } from "@/app/lib/settings/types";

export const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

/**
 * Replaces the profile photo. The response is the whole settings object, so the
 * cache becomes what the backend stored — including the signed avatar URL, which
 * only the server can mint.
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation<Settings, unknown, File>({
    mutationFn: (file) => {
      if (file.size > MAX_AVATAR_BYTES) throw new Error("That image is larger than 10MB");
      const body = new FormData();
      body.append("file", file);
      return apiPut<Settings>("/api/settings/avatar", body);
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(qk.settings.me(), settings);
      toast.success("Photo updated");
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
}
