"use client";

import { FC } from "react";
import { Download, Info } from "lucide-react";
import { toast } from "sonner";
import { useSettings, type PrivacyState } from "../SettingsProvider";
import { BUTTON_OUTLINE, SettingsRow, SettingsSection, Toggle } from "../_components/settings-ui";

const ROWS: { key: keyof PrivacyState; label: string; hint: string }[] = [
  {
    key: "discoverableByRecruiters",
    label: "Let recruiters find me",
    hint: "Companies hiring on Remote Worldwide can see your profile in search. Turning this off doesn't affect roles you apply to yourself.",
  },
  {
    key: "showProfileToPod",
    label: "Show my profile to my pod",
    hint: "Pod members see your name, headline and streak — never your applications or salary.",
  },
  {
    key: "shareOutcomesAnonymously",
    label: "Share outcomes anonymously",
    hint: "Your reply rates feed the benchmarks other job seekers see. Stripped of anything identifying.",
  },
  {
    key: "allowResumeIndexing",
    label: "Allow resume indexing",
    hint: "Lets partner job boards match your resume to their listings. Off by default.",
  },
];

const PrivacyClient: FC = () => {
  const { privacy, setPrivacy } = useSettings();

  return (
    <>
      <SettingsSection title="Who can see you" description="Nothing here is on by default that puts your name in front of your current employer.">
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
        <SettingsRow label="Export your data" hint="Applications, saved answers, resumes and session history as JSON.">
          <button type="button" className={BUTTON_OUTLINE} onClick={() => toast("Export isn't wired up in this build.")}>
            <Download className="h-3.5 w-3.5" />
            Request export
          </button>
        </SettingsRow>

        <div className="mt-4 flex gap-2.5 rounded-xl border border-black/10 bg-[#fbfbf7] px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 flex-none text-black/40" />
          <p className="text-xs leading-relaxed text-black/60">
            These preferences are stored in this session only. Nothing on this screen currently changes what any real system
            does with your data.
          </p>
        </div>
      </SettingsSection>
    </>
  );
};

export default PrivacyClient;
