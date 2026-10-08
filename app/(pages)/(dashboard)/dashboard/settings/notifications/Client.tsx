"use client";

import { FC } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useSettings, type NotificationsState } from "../SettingsProvider";
import { INPUT, SettingsRow, SettingsSection, Toggle } from "@/app/components/dashboard/settings/settings-ui";
import SectionSave from "@/app/components/dashboard/settings/SectionSave";

const EMAIL_ROWS: { key: keyof NotificationsState; label: string; hint: string }[] = [
  { key: "emailWeeklyDigest", label: "Weekly digest", hint: "Monday summary of applications, replies and what moved." },
  { key: "emailReplyAlerts", label: "Replies and status changes", hint: "When a company opens your resume or moves you along." },
  {
    key: "emailPodActivity",
    label: "Pod activity",
    hint: "When someone joins your pod, lands an interview or hits a streak. Changes to your own membership always reach you.",
  },
  { key: "emailProductNews", label: "Product news", hint: "New features. Rare, and never a sales email." },
  { key: "emailOffers", label: "Offers and early access", hint: "Free months, early access and deadlines like the waitlist closing. Rare." },
];

const PUSH_ROWS: { key: keyof NotificationsState; label: string; hint: string }[] = [
  {
    key: "pushStreakReminder",
    label: "Streak reminder",
    hint: "An email at your hunting hour on days you haven't logged anything yet. Never on a rest day or while your search is paused.",
  },
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
      <SettingsSection title="Email" description="Sent to the address on your account." action={<SectionSave section="notifications" />}>
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

      <SettingsSection title="Reminders" description="The streak reminder comes by email. Interview reminders aren't sent yet.">
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
            The streak reminder is an email to the address on your account, at most once a day, while you have a streak
            going or logged something this week. Interview reminders aren&apos;t sent yet; that switch records your
            preference for when they are.
          </p>
        </div>
      </SettingsSection>
    </>
  );
};

export default NotificationsClient;
