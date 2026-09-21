"use client";

// Whether talk mode is on, per feature, with each feature's call ceiling and
// today's remaining minutes.
//
// Not persisted: `voice` is outside PERSISTED_DOMAINS in app/lib/query/keys.ts,
// because a switched-off feature must not be offered from a stale copy.

import { useQuery } from "@tanstack/react-query";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import { getVoiceConfig } from "@/app/lib/voice/conversations";

export function useVoiceConfig() {
  return useQuery({
    queryKey: qk.voice.config(),
    queryFn: ({ signal }) => getVoiceConfig(signal),
    staleTime: STALE_TIME.voice,
  });
}
