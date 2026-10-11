"use client";

import { FC, useRef } from "react";
import { Check, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "../SettingsProvider";
import { useUploadAvatar } from "@/hooks/mutations/useAvatarMutation";
import { useStreakQuery } from "@/hooks/queries/useStreakQuery";
import { BUTTON_OUTLINE, BUTTON_SOLID, INPUT, SettingsRow, SettingsSection } from "@/app/components/dashboard/settings/settings-ui";
import SkillEntriesEditor from "@/app/components/dashboard/resume/content/SkillEntriesEditor";
import EducationEditor from "@/app/components/onboarding/EducationEditor";
import ExperienceEditor from "@/app/components/onboarding/ExperienceEditor";
import {
  educationOf,
  educationProblems,
  entriesFromProfile,
  experienceOf,
  experienceProblems,
  skillEdit,
  type EducationRow,
  type ExperienceRow,
} from "@/app/lib/onboarding/profile";

const TIMEZONES = ["GMT-8", "GMT-5", "GMT+0", "GMT+1", "GMT+2", "GMT+4", "GMT+8"];

/** "GMT+0", "GMT" and "UTC" are one zone; the streak calls it "UTC". */
const zoneKey = (zone: string): string => (/^(?:GMT|UTC)(?:[+-]0{1,2}(?::?00)?)?$/i.test(zone.trim()) ? "UTC" : zone.trim().toUpperCase());

/**
 * The streak never switches zones mid-day (a change could otherwise reach back into yesterday),
 * so a new timezone starts counting when the current day ends. Says so when that is pending:
 * saved (the server's `nextTimezone`) or picked and not saved yet.
 */
function streakZoneNote(picked: string, streakZone: string | undefined, next: { timezone: string } | null | undefined): string | null {
  if (next) return `Your streak switches to ${next.timezone} when your current day ends.`;
  if (picked && streakZone && zoneKey(picked) !== zoneKey(streakZone)) return "Your streak switches to this timezone when your current day ends.";
  return null;
}

const ProfileClient: FC = () => {
  const { profile, setProfile, save, saving } = useSettings();
  const streak = useStreakQuery().data;
  const zoneNote = streakZoneNote(profile.timezone, streak?.timezone, streak?.nextTimezone);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const uploadPhoto = useUploadAvatar();

  // Keyed by position: the saved list has no ids, and rows only move on an add or a remove.
  const educationRows: EducationRow[] = (profile.education ?? []).map((entry, index) => ({ id: `row-${index}`, ...entry }));
  const educationBlocked = educationProblems(educationRows).length > 0;
  // The same, for roles (a role needs a title or a company).
  const experienceRows: ExperienceRow[] = (profile.experience ?? []).map((entry, index) => ({ id: `role-${index}`, ...entry }));
  const experienceBlocked = experienceProblems(experienceRows).length > 0;
  // The same Skills entries as the resume editor and onboarding (owner, 2026-10-08), in step with the flat list.
  const skillEntries = entriesFromProfile(profile.skills, profile.skillEntries ?? []);

  const initials = profile.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      <SettingsSection
        title="Profile"
        description="What recruiters see when we put your name forward."
        action={
          <button type="button" onClick={() => save("profile")} disabled={saving || educationBlocked || experienceBlocked} className={BUTTON_SOLID}>
            <Check className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save"}
          </button>
        }>
        <div className="mb-5 flex items-center gap-4 border-b border-black/8 pb-5">
          <span className="grid h-16 w-16 flex-none place-content-center overflow-hidden rounded-full bg-[#222325] text-lg font-extrabold text-[#e1f073]">
            {profile.avatarUrl ? (
              // A plain img, not next/image: the URL is signed and short-lived,
              // and the initials below are the fallback when it stops resolving.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials || "?"
            )}
          </span>
          <div className="min-w-0">
            <input
              ref={photoRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Cleared first so picking the same file twice still fires.
                e.target.value = "";
                if (file) uploadPhoto.mutate(file);
              }}
            />
            <button type="button" className={BUTTON_OUTLINE} disabled={uploadPhoto.isPending} onClick={() => photoRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              {uploadPhoto.isPending ? "Uploading…" : profile.avatarUrl ? "Change photo" : "Upload a photo"}
            </button>
            <p className="mt-1.5 text-xs text-black/45">JPG or PNG, at least 400×400.</p>
          </div>
        </div>

        <SettingsRow label="Full name" stacked htmlFor="p-name">
          <input id="p-name" className={INPUT} value={profile.fullName} onChange={(e) => setProfile({ fullName: e.target.value })} />
        </SettingsRow>

        <SettingsRow label="Headline" hint="One line. This sits under your name everywhere." stacked htmlFor="p-headline">
          <input id="p-headline" className={INPUT} value={profile.headline} onChange={(e) => setProfile({ headline: e.target.value })} />
        </SettingsRow>

        <SettingsRow label="About" hint="Two or three sentences on what you do and what you're after." stacked htmlFor="p-summary">
          <textarea
            id="p-summary"
            rows={4}
            className={cn(INPUT, "resize-y leading-relaxed")}
            value={profile.summary}
            onChange={(e) => setProfile({ summary: e.target.value })}
          />
        </SettingsRow>

        <SettingsRow label="Location" stacked htmlFor="p-location">
          <div className="flex flex-wrap gap-2">
            <input
              id="p-location"
              className={cn(INPUT, "flex-1 min-w-[200px]")}
              value={profile.location}
              onChange={(e) => setProfile({ location: e.target.value })}
            />
            <select
              aria-label="Timezone"
              className={cn(INPUT, "w-auto flex-none cursor-pointer")}
              value={profile.timezone}
              onChange={(e) => setProfile({ timezone: e.target.value })}>
              {/* Without this, an unset timezone displays as the first option
                  while "" is what's saved — and reviewers need a real one. */}
              <option value="" disabled>
                Timezone
              </option>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          {zoneNote && <p className="mt-2 text-xs text-black/55">{zoneNote}</p>}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Links" description="Where your work lives. Left blank, they're simply not shown.">
        <SettingsRow label="Portfolio" stacked htmlFor="p-portfolio">
          <input id="p-portfolio" className={INPUT} placeholder="yoursite.com" value={profile.portfolio} onChange={(e) => setProfile({ portfolio: e.target.value })} />
        </SettingsRow>
        <SettingsRow label="LinkedIn" stacked htmlFor="p-linkedin">
          <input id="p-linkedin" className={INPUT} placeholder="linkedin.com/in/…" value={profile.linkedin} onChange={(e) => setProfile({ linkedin: e.target.value })} />
        </SettingsRow>
        <SettingsRow label="GitHub" stacked htmlFor="p-github">
          <input id="p-github" className={INPUT} placeholder="github.com/…" value={profile.github} onChange={(e) => setProfile({ github: e.target.value })} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Skills" description="Used to match you against roles and to score your resume.">
        <SkillEntriesEditor entries={skillEntries} onChange={(next) => setProfile(skillEdit(next))} />
      </SettingsSection>

      {/* The same editor as onboarding's, and optional there too, so a role entered in one is edited in the other. Saved with the
          Profile button above; a role with neither a title nor a company holds it (the backend refuses those). */}
      <SettingsSection title="Work experience" description="Where you've worked, most recent first. Resumes, cover letters and answers draw on it; it's optional.">
        <ExperienceEditor rows={experienceRows} onChange={(rows) => setProfile({ experience: experienceOf(rows) })} />
      </SettingsSection>

      {/* The same editor as onboarding's, so a school entered there is edited here. Saved with the
          Profile button above; a row with no school holds it (the backend refuses those). */}
      <SettingsSection title="Education" description="Where you studied. The extension answers education questions from it; a school's name is all an entry needs.">
        <EducationEditor rows={educationRows} onChange={(rows) => setProfile({ education: educationOf(rows) })} />
      </SettingsSection>
    </>
  );
};

export default ProfileClient;
