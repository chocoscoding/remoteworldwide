"use client";

// What the prep setup screen needs to offer and price a voice interview:
// whether voice interviews are on, the consent version a create must echo, the
// credit rule and the typed-session allowance.
//
// Server configuration, not the user's data, so nothing here is sensitive; it
// still lives under `prep`, which stays off disk (see PERSISTED_DOMAINS in
// app/lib/query/keys.ts), because a switched-off feature must not be offered
// from a stale copy.

import { useQuery } from "@tanstack/react-query";
import { STALE_TIME, qk } from "@/app/lib/query/keys";
import { getVoiceConfig } from "@/app/lib/voice/api";

export function usePrepVoiceConfig() {
  return useQuery({
    queryKey: qk.prep.voiceConfig(),
    queryFn: ({ signal }) => getVoiceConfig(signal),
    staleTime: STALE_TIME.prep,
  });
}
