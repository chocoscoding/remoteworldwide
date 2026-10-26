"use client";

import { useId, useState } from "react";
import { useProfileSettings } from "@/hooks/queries/useSettingsQuery";
import { useSaveSettingsSection } from "@/hooks/mutations/useSettingsMutations";
import { PROFILE_LINK_LABELS, profileLinkConflict, webLink, type ProfileLinks } from "@/app/lib/answers/profile-links";

export function useLinkDestination(question: string, answer: string) {
  const settings = useProfileSettings();
  const saveProfile = useSaveSettingsSection("profile");
  const profile: ProfileLinks = settings.data?.profile ?? {};
  const field = profileLinkConflict(question, answer, profile);
  const signature = JSON.stringify([question, answer, field, field ? profile[field] : null]);
  const [decision, setDecision] = useState<{ signature: string; choice: "profile" | "question" } | null>(null);
  const choice = decision?.signature === signature ? decision.choice : null;
  return {
    field, choice, current: field ? profile[field] ?? "" : "",
    loading: Boolean(webLink(answer)) && settings.isPending,
    failed: Boolean(webLink(answer)) && settings.isError,
    retry: () => void settings.refetch(),
    choose: (choice: "profile" | "question") => setDecision({ signature, choice }),
    clear: () => setDecision(null),
    saveProfile: async () => {
      if (!field) return;
      await saveProfile.mutateAsync({ [field]: answer.trim() });
    },
  };
}

export default function LinkDestination({ state, existing = false }: { state: ReturnType<typeof useLinkDestination>; existing?: boolean }) {
  const group = useId();
  if (state.loading) return <p className="mt-3 text-xs text-black/55">Checking your profile links…</p>;
  if (state.failed) return <p role="alert" className="mt-3 text-xs text-red-700">Profile links couldn’t load. <button type="button" className="underline" onClick={state.retry}>Retry</button> before saving this link.</p>;
  if (!state.field) return null;
  return <fieldset className="mt-3 rounded-lg border border-black/15 bg-[#fbfbf7] p-3">
    <legend className="px-1 text-xs font-bold">Where should this link be used?</legend>
    <p className="text-xs text-black/60">{PROFILE_LINK_LABELS[state.field]} in your profile:</p>
    <p className="mt-1 break-all text-sm text-primary">{state.current || "No link saved yet"}</p>
    <div className="mt-3 space-y-3 text-sm">
      <label className="flex cursor-pointer items-start gap-2"><input type="radio" name={group} checked={state.choice === "profile"} onChange={() => state.choose("profile")} className="mt-1 accent-[#222325]" /><span>Update profile link<span className="block text-xs text-black/55">Use this as your default. {existing ? "Moves this link to your profile and removes this separate answer." : "Doesn’t create a duplicate answer."}</span></span></label>
      <label className="flex cursor-pointer items-start gap-2"><input type="radio" name={group} checked={state.choice === "question"} onChange={() => state.choose("question")} className="mt-1 accent-[#222325]" /><span>Use only for this question<span className="block text-xs text-black/55">Keep your profile unchanged. This answer overrides it only when the question wording matches.</span></span></label>
    </div>
  </fieldset>;
}
