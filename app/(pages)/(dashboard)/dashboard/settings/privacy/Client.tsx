"use client";

import { FC } from "react";
import { Download, Info } from "lucide-react";
import { useSettings, type PrivacyState } from "../SettingsProvider";
import { useExportData } from "@/hooks/mutations/useAccountMutations";
import { BUTTON_OUTLINE, SettingsRow, SettingsSection, Toggle } from "@/app/components/dashboard/settings/settings-ui";
import SectionSave from "@/app/components/dashboard/settings/SectionSave";

const ROWS: { key: keyof PrivacyState; label: string; hint: string }[] = [
  {
    key: "discoverableByRecruiters",
    label: "Let recruiters find me",
    hint: "Lets our team recommend you to hiring companies, and puts you in any recruiter search we open. Off, nobody puts you forward. Roles you apply to yourself aren't affected.",
  },
  {
    key: "showProfileToPod",
    label: "Show my profile to my pod",
    hint: "Pod mates see your name, photo, streak and this week's application count on the leaderboard. Off, you show as “A pod member” — still on the board, just not by name.",
  },
  {
    key: "shareOutcomesAnonymously",
    label: "Share outcomes anonymously",
    hint: "For benchmarks built from job seekers' reply rates, stripped of anything identifying. None exists yet — when one does, this choice decides whether you're in it.",
  },
  {
    key: "allowResumeIndexing",
    label: "Allow resume indexing",
    hint: "For partner job boards matching resumes to their listings. No partner board exists yet — when one does, yours goes only if this is on. Off by default.",
  },
  {
    key: "allowAiCoaching",
    label: "Let the career coach read my search",
    hint: "The coach sees your applications, outcomes and weekly goal so its advice is about your real search.",
  },
];

const PrivacyClient: FC = () => {
  const { privacy, setPrivacy } = useSettings();
  const exportData = useExportData();

  return (
    <>
      <SettingsSection title="Who can see you" description="Nothing here is on by default that puts your name in front of your current employer." action={<SectionSave section="privacy" />}>
        {ROWS.map((r) => (
          <SettingsRow key={r.key} label={r.label} hint={r.hint}>
            <Toggle
              checked={privacy[r.key]}
              onChange={(v) => setPrivacy({ [r.key]: v } as Partial<PrivacyState>)}
              label={r.label}
            />
          </SettingsRow>
        ))}
      </SettingsSection>

      <SettingsSection title="Your data" description="Everything we hold about you, on request.">
        <SettingsRow
          label="Export your data"
          hint="Everything we hold: profile, applications, saved jobs and answers, documents, coach and interview history, credits — as one JSON file. Files themselves aren't included, only their details.">
          <button type="button" className={BUTTON_OUTLINE} disabled={exportData.isPending} onClick={() => exportData.mutate()}>
            <Download className="h-3.5 w-3.5" />
            {exportData.isPending ? "Gathering…" : "Download my data"}
          </button>
        </SettingsRow>

        <div className="mt-4 flex gap-2.5 rounded-xl border border-black/10 bg-[#fbfbf7] px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 flex-none text-black/40" />
          <p className="text-xs leading-relaxed text-black/60">
            These preferences are saved to your account when you press Save. &ldquo;Let recruiters find me&rdquo; and &ldquo;Show my
            profile to my pod&rdquo; apply from then on; &ldquo;Let the career coach read my search&rdquo; reaches the coach within a
            minute. The other two wait for features that don&apos;t exist yet.
          </p>
        </div>
      </SettingsSection>
    </>
  );
};

export default PrivacyClient;
