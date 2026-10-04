"use client";

// Skills as removable chips plus one input. Enter or a comma commits what is
// typed; a pasted "Figma, Prototyping, Design systems" lands as three skills;
// Backspace in the empty input takes the last chip back off; leaving the input
// commits rather than discards, so a skill typed and clicked away from is not
// lost.
//
// Skills are deduped case-insensitively on the way in. That is not only
// tidiness: the paper keys its pills by the skill text (`SkillsSection`), so
// "React" twice is a duplicate React key, not just a duplicate word.
//
// A skill is capped at `SKILL_MAX_CHARS`: the input stops there, and a pasted
// part longer than that is cut to it. Used for the one plain list and for each
// sub skill group alike.
//
// In a sub skill group (`group`), a chip can be picked up and dropped into
// another group or another place in its own (owner, 2026-10-04). The drag
// itself is the Skills field's (`SkillsField`): this only makes the chips
// draggable and the group a place to drop them.

import { useState, type FC, type KeyboardEvent, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SKILL_MAX_CHARS } from "@/app/lib/resume/skills";
import { FIELD_CLASS, FIELD_TONE } from "./FormField";

/** What a dragged chip, or the group it is over, carries. */
export interface SkillDragData {
  group: string;
  skill?: string;
}

/** A chip's drag id: its group and its text (a skill is in a group once). */
export const skillChipId = (group: string, skill: string) => `chip::${group}::${skill}`;
/** A group's drop id. */
export const skillGroupDropId = (group: string) => `group::${group}`;

export const CHIP_CLASS =
  "inline-flex max-w-full items-center gap-1 rounded-full border border-black/30 bg-white py-1 pl-2.5 pr-1 text-xs font-semibold text-primary";

/** A chip in a group: the whole chip is the handle. `transform` is dnd-kit's runtime offset. */
const SortableChip: FC<{ group: string; skill: string; children: ReactNode }> = ({ group, skill, children }) => {
  const data: SkillDragData = { group, skill };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: skillChipId(group, skill), data });
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable skill"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(CHIP_CLASS, "cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-40")}>
      {children}
    </li>
  );
};

/** A group's chips and input, as one place to drop a chip. */
const GroupDrop: FC<{ group: string; dropping: boolean; children: ReactNode }> = ({ group, dropping, children }) => {
  const data: SkillDragData = { group };
  const { setNodeRef } = useDroppable({ id: skillGroupDropId(group), data });
  return (
    <div
      ref={setNodeRef}
      className={cn("-m-1 flex flex-col gap-2 rounded-[10px] p-1 transition-colors", dropping && "bg-[#eef6ad]/60 ring-2 ring-[#e1f073]")}>
      {children}
    </div>
  );
};

export interface SkillsEditorProps {
  skills: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
  /** In a sub skill group, its id: the chips can then be dragged to another group (inside `SkillsField`'s drag context). */
  group?: string;
  /** A chip is being dragged over this group. */
  dropping?: boolean;
}

const SEPARATOR = /[,;\n]/;

const SkillsEditor: FC<SkillsEditorProps> = ({ skills, onChange, placeholder = "Add a skill, then Enter", group, dropping = false }) => {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const have = new Set(skills.map((s) => s.toLowerCase()));
    const next = [...skills];
    for (const part of raw.split(SEPARATOR)) {
      const skill = part.trim().replace(/\s+/g, " ").slice(0, SKILL_MAX_CHARS).trim();
      if (!skill || have.has(skill.toLowerCase())) continue;
      have.add(skill.toLowerCase());
      next.push(skill);
    }
    if (next.length !== skills.length) onChange(next);
    setDraft("");
  };

  const handleChange = (value: string) => {
    // A separator mid-value is a paste (or the comma key): everything before
    // the last separator is finished, whatever follows is still being typed. Not the input's own
    // `maxLength`: that would cut a pasted list of skills, where only each skill is capped.
    if (!SEPARATOR.test(value)) {
      setDraft(value.slice(0, SKILL_MAX_CHARS));
      return;
    }
    const parts = value.split(SEPARATOR);
    const rest = parts.pop() ?? "";
    commit(parts.join(","));
    setDraft(rest.trimStart().slice(0, SKILL_MAX_CHARS));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && draft === "" && skills.length > 0) {
      event.preventDefault();
      onChange(skills.slice(0, -1));
    }
  };

  const chipBody = (skill: string) => (
    <>
      <span className="truncate">{skill}</span>
      <button
        type="button"
        onClick={() => onChange(skills.filter((s) => s !== skill))}
        aria-label={`Remove ${skill}`}
        className="grid h-4 w-4 flex-none place-content-center rounded-full text-black/45 transition-colors hover:bg-[#222325] hover:text-white cursor-pointer">
        <X className="h-3 w-3" />
      </button>
    </>
  );

  const chips =
    skills.length === 0 ? (
      <p className="text-xs text-black/50 italic">{group ? "No skills yet. Drag one here, or add one below." : "No skills added yet."}</p>
    ) : group ? (
      <SortableContext items={skills.map((skill) => skillChipId(group, skill))} strategy={rectSortingStrategy}>
        <ul className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <SortableChip key={skill} group={group} skill={skill}>
              {chipBody(skill)}
            </SortableChip>
          ))}
        </ul>
      </SortableContext>
    ) : (
      <ul className="flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <li key={skill} className={CHIP_CLASS}>
            {chipBody(skill)}
          </li>
        ))}
      </ul>
    );

  const input = (
    <input
      type="text"
      value={draft}
      onChange={(e) => handleChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => commit(draft)}
      placeholder={placeholder}
      aria-label="Add a skill"
      // A group's input is a step down from its title's (owner, 2026-10-04).
      className={cn(FIELD_CLASS, group ? "h-9 text-[13px]" : "h-11", "py-0", FIELD_TONE.idle)}
    />
  );

  return group ? (
    <GroupDrop group={group} dropping={dropping}>
      {chips}
      {input}
    </GroupDrop>
  ) : (
    <div className="flex flex-col gap-2">
      {chips}
      {input}
    </div>
  );
};

export default SkillsEditor;
