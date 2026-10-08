"use client";

// The Skills entries editor (owner, 2026-10-08, after FlowCV's Skills list):
// the resume editor's Content tab and onboarding's profile both use it. Every
// entry is a row with its name; one at a time opens as a card with two fields: "Skill" (the name, required) and "Information / Sub-skills",
// plain text separated by commas. An entry with sub skills prints its name over
// them; one without is a plain skill. How both print is the Customize tab's
// Skills panel. The rules that keep the entries and the flat list in step live in
// `app/lib/resume/skills.ts`.
//
// Add a skill stays pressable while an entry has no name, but adds nothing: it
// opens that entry, scrolls to it and says, in red, what is missing
// (`EntryListEditor`'s `validate`).

import { useState, type FC } from "react";
import { cn } from "@/lib/utils";
import type { ResumeSkillGroup } from "@/app/lib/dashboard/types";
import { parseSubSkills, SKILL_GROUP_TITLE_MAX_CHARS, subSkillText } from "@/app/lib/resume/skills";
import EntryListEditor, { type EntrySummary } from "./EntryListEditor";
import { FIELD_CLASS, FIELD_TONE, TextAreaField } from "./FormField";

export interface SkillEntriesEditorProps {
  entries: ResumeSkillGroup[];
  onChange: (entries: ResumeSkillGroup[]) => void;
}

const ERROR_TONE = "border-[#b23c26] bg-white text-primary placeholder:text-black/40 hover:border-[#b23c26]";

const named = (entry: ResumeSkillGroup) => entry.title.trim().length > 0;

const summarize = (entry: ResumeSkillGroup): EntrySummary => {
  const subs = entry.skills.filter((skill) => skill.trim());
  return {
    title: entry.title.trim(),
    meta: subs.length > 0 ? subSkillText(subs) : undefined,
  };
};

/** The entry's name. Required: red, with what is missing, once Add was pressed without it. */
const SkillName: FC<{ value: string; invalid: boolean; onChange: (value: string) => void }> = ({ value, invalid, onChange }) => (
  <label className="flex min-w-0 flex-col gap-[5px]">
    <span className="flex items-baseline justify-between gap-2 text-xs font-bold text-[#44453f]">
      Skill
      {invalid && <span className="font-semibold text-[#b23c26]">Add the skill&apos;s name first</span>}
    </span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="e.g. Python, or Soft Skills"
      maxLength={SKILL_GROUP_TITLE_MAX_CHARS}
      aria-invalid={invalid || undefined}
      className={cn(FIELD_CLASS, "h-11 min-w-0 py-0", invalid ? ERROR_TONE : FIELD_TONE.idle)}
    />
  </label>
);

/**
 * The sub skills as the text they were typed as. Kept as typed while it is being
 * written (a trailing ", " is not lost to the parse), and shown afresh when they
 * change under it (Undo, an AI tool).
 */
const SubSkills: FC<{ skills: string[]; onChange: (skills: string[]) => void }> = ({ skills, onChange }) => {
  const [text, setText] = useState(() => subSkillText(skills));
  if (subSkillText(parseSubSkills(text)) !== subSkillText(skills)) setText(subSkillText(skills));
  return (
    <TextAreaField
      label="Information / Sub-skills"
      value={text}
      rows={3}
      onChange={(next) => {
        setText(next);
        onChange(parseSubSkills(next));
      }}
      placeholder="Optional. Separate them with commas, e.g. Teamwork, Empathy, Time Management"
    />
  );
};

const SkillEntriesEditor: FC<SkillEntriesEditorProps> = ({ entries, onChange }) => (
  <EntryListEditor<ResumeSkillGroup>
    items={entries}
    onChange={onChange}
    createItem={() => ({ id: `skl-${Date.now()}`, title: "", skills: [] })}
    addLabel="Add a skill"
    emptyLabel="No skills yet."
    noun="skill"
    summarize={summarize}
    hideable
    validate={named}
    renderFields={(entry, update, _isActive, _remove, invalid) => (
      <>
        <SkillName value={entry.title} invalid={invalid} onChange={(title) => update({ title })} />
        <SubSkills skills={entry.skills} onChange={(skills) => update({ skills })} />
      </>
    )}
  />
);

export default SkillEntriesEditor;
