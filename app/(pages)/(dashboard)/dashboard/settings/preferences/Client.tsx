"use client";

import { FC, FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { useSettings, type Availability, type RemotePolicy } from "../SettingsProvider";
import { BUTTON_OUTLINE, Choice, INPUT, SettingsRow, SettingsSection, TagList, Toggle } from "@/app/components/dashboard/settings/settings-ui";

const REMOTE: { id: RemotePolicy; label: string }[] = [
  { id: "anywhere", label: "Anywhere" },
  { id: "overlap", label: "Some overlap" },
  { id: "region", label: "My region" },
];

const AVAILABILITY: { id: Availability; label: string }[] = [
  { id: "immediately", label: "Now" },
  { id: "two-weeks", label: "2 weeks" },
  { id: "month", label: "A month" },
  { id: "browsing", label: "Just looking" },
];

const REMOTE_HINT: Record<RemotePolicy, string> = {
  anywhere: "Any timezone. Widest net, but expect some awkward call times.",
  overlap: "Roles asking for a few hours of overlap with your working day.",
  region: "Only roles hiring in or near where you are.",
};

const PreferencesClient: FC = () => {
  const { preferences, setPreferences } = useSettings();
  // Weekly target and pause live in ActivityProvider because the streak panel
  // and sidebar read them too — this screen edits them, it doesn't own them.
  const { goals, setWeeklyTarget, pauseSearch, resumeSearch, pausedDaysLeft } = useActivity();
  const [roleDraft, setRoleDraft] = useState("");

  function addRole(e: FormEvent) {
    e.preventDefault();
    const role = roleDraft.trim();
    if (!role) return;
    if (preferences.targetRoles.some((r) => r.toLowerCase() === role.toLowerCase())) {
      setRoleDraft("");
      return;
    }
    setPreferences({ targetRoles: [...preferences.targetRoles, role] });
    setRoleDraft("");
  }

  return (
    <>
      <SettingsSection title="What you're looking for" description="Drives your recommendations, referral matches and resume scoring.">
        <SettingsRow label="Target roles" hint="Add every title you'd genuinely take — near-misses cost you matches." stacked>
          <form onSubmit={addRole} className="mb-3 flex gap-2">
            <input
              className={cn(INPUT, "flex-1")}
              placeholder="e.g. Staff Product Designer"
              value={roleDraft}
              onChange={(e) => setRoleDraft(e.target.value)}
              aria-label="Add a target role"
            />
            <button type="submit" className={BUTTON_OUTLINE} disabled={!roleDraft.trim()}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </form>
          <TagList
            tags={preferences.targetRoles}
            onRemove={(t) => setPreferences({ targetRoles: preferences.targetRoles.filter((r) => r !== t) })}
            emptyNote="No target roles yet — recommendations need at least one."
          />
        </SettingsRow>

        <SettingsRow label="Minimum salary" hint="Never shown to employers. Used to filter what reaches you." stacked>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Currency"
              className={cn(INPUT, "w-auto flex-none cursor-pointer")}
              value={preferences.currency}
              onChange={(e) => setPreferences({ currency: e.target.value as typeof preferences.currency })}>
              {(["USD", "GBP", "EUR", "NGN"] as const).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step={1000}
              aria-label="Minimum salary"
              className={cn(INPUT, "flex-1 min-w-[160px] tabular-nums")}
              value={preferences.minSalary}
              onChange={(e) => setPreferences({ minSalary: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
        </SettingsRow>

        <SettingsRow label="Remote policy" hint={REMOTE_HINT[preferences.remotePolicy]} stacked>
          <Choice value={preferences.remotePolicy} options={REMOTE} onChange={(v) => setPreferences({ remotePolicy: v })} />
        </SettingsRow>

        <SettingsRow label="Availability" stacked>
          <Choice value={preferences.availability} options={AVAILABILITY} onChange={(v) => setPreferences({ availability: v })} />
        </SettingsRow>

        <SettingsRow label="Open to contract work" hint="Contract and contract-to-hire roles.">
          <Toggle
            checked={preferences.openToContract}
            onChange={(v) => setPreferences({ openToContract: v })}
            label="Open to contract work"
          />
        </SettingsRow>

        <SettingsRow label="Open to relocation" hint="On-site or hybrid roles that would mean moving.">
          <Toggle
            checked={preferences.openToRelocation}
            onChange={(v) => setPreferences({ openToRelocation: v })}
            label="Open to relocation"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Search intensity" description="These are the same numbers your streak and weekly goal run on.">
        <SettingsRow label="Weekly application target" hint="What the weekly goal on Home counts toward.">
          <input
            type="number"
            min={1}
            max={400}
            aria-label="Weekly application target"
            className={cn(INPUT, "w-24 tabular-nums")}
            value={goals.weeklyTarget}
            onChange={(e) => setWeeklyTarget(Number(e.target.value) || 1)}
          />
        </SettingsRow>

        <SettingsRow
          label="Pause the search"
          hint={
            pausedDaysLeft !== null
              ? `Paused — ${pausedDaysLeft} day${pausedDaysLeft === 1 ? "" : "s"} left. Your streak is held, not lost.`
              : "Holds your streak, goals and reminders. Nothing resets."
          }>
          {pausedDaysLeft !== null ? (
            <button type="button" className={BUTTON_OUTLINE} onClick={resumeSearch}>
              Resume now
            </button>
          ) : (
            <button type="button" className={BUTTON_OUTLINE} onClick={() => pauseSearch(7)}>
              Pause for a week
            </button>
          )}
        </SettingsRow>
      </SettingsSection>

      <p className="px-1 text-xs text-black/45">
        Your saved answers live in{" "}
        <Link href="/dashboard/questions" className="font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
          Application answers
        </Link>
        ; your resume and files are in{" "}
        <Link href="/dashboard/vault" className="font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
          My documents
        </Link>
        .
      </p>
    </>
  );
};

export default PreferencesClient;
