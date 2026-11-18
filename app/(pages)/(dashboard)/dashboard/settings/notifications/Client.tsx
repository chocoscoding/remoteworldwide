"use client";

import { FC } from "react";
import { Info, MailMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useSettings, type NotificationsState } from "../SettingsProvider";
import { BUTTON_SOLID, INPUT, SettingsRow, SettingsSection, Toggle } from "@/app/components/dashboard/settings/settings-ui";
import SectionSave from "@/app/components/dashboard/settings/SectionSave";
import { useEmailStatusQuery } from "@/hooks/queries/useSettingsQuery";
import { useResubscribe } from "@/hooks/mutations/useSettingsMutations";

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

const LABELS = Object.fromEntries([...EMAIL_ROWS, ...PUSH_ROWS].map((r) => [r.key, r.label])) as Partial<Record<keyof NotificationsState, string>>;

/** Why marketing mail stopped, by the backend's users.mailSuppressed reason. */
const BLOCK_REASONS: Record<string, string> = {
  complaint: "One of our emails was marked as spam.",
  hard_bounce: "An email to your address bounced.",
  suppressed: "Our mail provider stopped delivery to your address.",
};

/**
 * Undoing an opt-out made outside this tab: switches an emailed unsubscribe turned off (still off,
 * here or in an unsaved edit) and a block on marketing mail, which no switch shows. Nothing to undo,
 * nothing shown: the switches below stay the everyday way in and out.
 */
const Resubscribe: FC = () => {
  const { notifications } = useSettings();
  const { data } = useEmailStatusQuery();
  const resubscribe = useResubscribe();

  const off = (data?.unsubscribed ?? []).filter((entry) => notifications[entry.pref] === false && LABELS[entry.pref]);
  const blocked = data?.blocked ?? null;
  if (off.length === 0 && !blocked) return null;

  const names = off.map((entry) => LABELS[entry.pref]).join(", ");

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-black/10 bg-[#fbfbf7] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-2.5">
        <MailMinus className="mt-0.5 h-4 w-4 flex-none text-black/40" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">{blocked ? "Emails to you are paused" : "You unsubscribed by email"}</p>
          {blocked && <p className="mt-0.5 text-xs leading-relaxed text-black/55">{BLOCK_REASONS[blocked.reason] ?? "Delivery to your address failed."}</p>}
          {off.length > 0 && (
            <p className="mt-0.5 text-xs leading-relaxed text-black/55">
              {blocked ? `Unsubscribed from ${names}.` : names}
            </p>
          )}
        </div>
      </div>
      <button type="button" onClick={() => resubscribe.mutate()} disabled={resubscribe.isPending} className={cn(BUTTON_SOLID, "flex-none self-start sm:self-auto")}>
        {resubscribe.isPending ? "Resubscribing…" : "Resubscribe"}
      </button>
    </div>
  );
};

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
        <Resubscribe />
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
