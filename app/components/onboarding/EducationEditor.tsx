"use client";

// The profile's education list: the resume editor's own card list
// (`EntryListEditor` + `TextField`, the Education group of ContentForm) bound
// to `profile.education` instead of a resume's content. Shared by onboarding
// and Settings → Profile, so a school entered in one reads the same in the
// other.
//
// Dates are picked, never typed (`DateRangeField`): a month and year to start,
// a month and year or "Present" to end, the end optional for a single date.
//
// Rows carry an editor-only `id` (the saved list has none); callers strip it
// on save. A row with a degree or dates but no school is the one shape the
// backend refuses outright, so it is called out on the row itself — the
// caller also holds its Save until it is fixed (`educationProblems`).

import type { FC } from "react";
import { EntryListEditor } from "@/app/components/dashboard/resume/content/EntryListEditor";
import { TextField } from "@/app/components/dashboard/resume/content/FormField";
import DateRangeField from "@/app/components/dashboard/resume/content/DateRangeField";
import { EDUCATION_LIMITS, educationProblems, type EducationRow } from "@/app/lib/onboarding/profile";

export const blankEducationRow = (id: string): EducationRow => ({ id, school: "", degree: "", dates: "", location: "", detail: "" });

const EducationEditor: FC<{ rows: EducationRow[]; onChange: (rows: EducationRow[]) => void }> = ({ rows, onChange }) => {
  const problems = new Set(educationProblems(rows));
  const full = rows.length >= EDUCATION_LIMITS.entries;

  return (
    <div className="flex flex-col gap-1.5">
      <EntryListEditor<EducationRow>
        items={rows}
        // The backend keeps ten; an eleventh "Add" does nothing rather than fail the save later.
        onChange={(next) => {
          if (next.length > EDUCATION_LIMITS.entries) return;
          onChange(next);
        }}
        createItem={() => blankEducationRow(`edu-${Date.now()}`)}
        addLabel={full ? `Up to ${EDUCATION_LIMITS.entries} schools` : "Add a school"}
        emptyLabel="No education added yet."
        renderFields={(item, update, isActive) => (
          <>
            <TextField value={item.school} onChange={(v) => update({ school: v })} placeholder="School or university" isActive={isActive} />
            {problems.has(item.id) && <p className="px-0.5 text-xs font-semibold text-[#b23c26]">Add the school&apos;s name, or remove this entry.</p>}
            <TextField value={item.degree} onChange={(v) => update({ degree: v })} placeholder="Degree or course" isActive={isActive} />
            <DateRangeField value={item.dates} onChange={(dates) => update({ dates })} label={item.school.trim() ? `Dates at ${item.school.trim()}` : "Dates"} isActive={isActive} />
            <TextField value={item.location} onChange={(v) => update({ location: v })} placeholder="Location (optional)" isActive={isActive} />
            <TextField value={item.detail} onChange={(v) => update({ detail: v })} placeholder="Honours, thesis, focus (optional)" isActive={isActive} />
          </>
        )}
      />
    </div>
  );
};

export default EducationEditor;
