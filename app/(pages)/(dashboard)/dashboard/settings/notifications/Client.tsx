"use client";

import { FC } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useSettings, type NotificationsState } from "../SettingsProvider";
import { INPUT, SettingsRow, SettingsSection, Toggle } from "../_components/settings-ui";

const EMAIL_ROWS: { key: keyof NotificationsState; label: string; hint: string }[] = [
  { key: "emailWeeklyDigest", label: "Weekly digest", hint: "Monday summary of applications, replies and what moved." },
  { key: "emailReplyAlerts", label: "Replies and status changes", hint: "When a company opens your resume or moves you along." },
  { key: "emailPodActivity", label: "Pod activity", hint: "When someone in your pod lands an interview or hits a streak." },
  { key: "emailProductNews", label: "Product news", hint: "New features. Rare, and never a sales email." },
];

const PUSH_ROWS: { key: keyof NotificationsState; label: string; hint: string }[] = [
  { key: "pushStreakReminder", label: "Streak reminder", hint: "A nudge at your usual hunting hour if the day is still open." },
  { key: "pushInterviewReminder", label: "Interview reminders", hint: "The evening before, and an hour ahead." },
];

function formatHour(h: number): string {
  const suffix = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}

const NotificationsClient: FC = () => {
  const { notifications, setNotifications } = useSettings();
  // huntHour is owned by ActivityProvider — the at-risk banner reads it too.
  const { goals, setHuntHour } = useActivity();

  return (
    <>
      <SettingsSection title="Email" description="Sent to the address on your account.">
        {EMAIL_ROWS.map((r) => (
          <SettingsRow key={r.key} label={r.label} hint={r.hint}>
            <Toggle
              checked={notifications[r.key]}
              onChange={(v) => setNotifications({ [r.key]: v } as Partial<NotificationsState>)}
              label={r.label}
            />
          </SettingsRow>
        ))}
      </SettingsSection>

      <SettingsSection title="Reminders" description="In-app now; push and email once a scheduler exists.">
        <SettingsRow label="Your hunting hour" hint="When you usually job hunt. Reminders land around then, never before." stacked>
          <select
            aria-label="Hunting hour"
            className={cn(INPUT, "w-auto cursor-pointer")}
            value={goals.huntHour}
            onChange={(e) => setHuntHour(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </SettingsRow>

        {PUSH_ROWS.map((r) => (
          <SettingsRow key={r.key} label={r.label} hint={r.hint}>
            <Toggle
              checked={notifications[r.key]}
              onChange={(v) => setNotifications({ [r.key]: v } as Partial<NotificationsState>)}
              label={r.label}
            />
          </SettingsRow>
        ))}

        <div className="mt-4 flex gap-2.5 rounded-xl border border-black/10 bg-[#fbfbf7] px-3.5 py-3">
          <Info className="mt-0.5 h-4 w-4 flex-none text-black/40" />
          <p className="text-xs leading-relaxed text-black/60">
            Reminders currently show inside the app only. Email and push need a scheduler that doesn&apos;t exist yet — these
            switches record the preference for when it does.
          </p>
        </div>
      </SettingsSection>
    </>
  );
};

export default NotificationsClient;
