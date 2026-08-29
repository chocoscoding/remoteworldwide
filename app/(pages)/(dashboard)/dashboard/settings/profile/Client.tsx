"use client";

import { FC, FormEvent, useState } from "react";
import { Check, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSettings } from "../SettingsProvider";
import { BUTTON_OUTLINE, BUTTON_SOLID, INPUT, SettingsRow, SettingsSection, TagList } from "@/app/components/dashboard/settings/settings-ui";

const TIMEZONES = ["GMT-8", "GMT-5", "GMT+0", "GMT+1", "GMT+2", "GMT+4", "GMT+8"];

const ProfileClient: FC = () => {
  const { profile, setProfile, markSaved } = useSettings();
  const [skillDraft, setSkillDraft] = useState("");

  const initials = profile.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");

  function addSkill(e: FormEvent) {
    e.preventDefault();
    const skill = skillDraft.trim();
    if (!skill) return;
    // Case-insensitive so "Figma" and "figma" don't both end up in the list.
    if (profile.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      setSkillDraft("");
      return;
    }
    setProfile({ skills: [...profile.skills, skill] });
    setSkillDraft("");
  }

  function save() {
    markSaved();
    toast.success("Profile saved", { description: "Mock only — this resets on reload." });
  }

  return (
    <>
      <SettingsSection
        title="Profile"
        description="What recruiters see when we put your name forward."
        action={
          <button type="button" onClick={save} className={BUTTON_SOLID}>
            <Check className="h-3.5 w-3.5" />
            Save
          </button>
        }>
        <div className="mb-5 flex items-center gap-4 border-b border-black/8 pb-5">
          <span className="grid h-16 w-16 flex-none place-content-center rounded-full bg-[#222325] text-lg font-extrabold text-[#e1f073]">
            {initials || "?"}
          </span>
          <div className="min-w-0">
            <button type="button" className={BUTTON_OUTLINE} onClick={() => toast("Photo upload isn't wired up yet.")}>
              <Upload className="h-3.5 w-3.5" />
              Upload a photo
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
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
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
        <form onSubmit={addSkill} className="mb-3.5 flex gap-2">
          <input
            className={cn(INPUT, "flex-1")}
            placeholder="Add a skill…"
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
            aria-label="Add a skill"
          />
          <button type="submit" className={BUTTON_OUTLINE} disabled={!skillDraft.trim()}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </form>
        <TagList
          tags={profile.skills}
          onRemove={(t) => setProfile({ skills: profile.skills.filter((s) => s !== t) })}
          emptyNote="No skills yet — add a few so we can match you properly."
        />
      </SettingsSection>
    </>
  );
};

export default ProfileClient;
