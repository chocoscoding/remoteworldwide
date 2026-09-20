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

import { useState, type FC, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIELD_CLASS, FIELD_TONE } from "./FormField";

export interface SkillsEditorProps {
  skills: string[];
  onChange: (skills: string[]) => void;
}

const SEPARATOR = /[,;\n]/;

const SkillsEditor: FC<SkillsEditorProps> = ({ skills, onChange }) => {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const have = new Set(skills.map((s) => s.toLowerCase()));
    const next = [...skills];
    for (const part of raw.split(SEPARATOR)) {
      const skill = part.trim().replace(/\s+/g, " ");
      if (!skill || have.has(skill.toLowerCase())) continue;
      have.add(skill.toLowerCase());
      next.push(skill);
    }
    if (next.length !== skills.length) onChange(next);
    setDraft("");
  };

  const handleChange = (value: string) => {
    // A separator mid-value is a paste (or the comma key): everything before
    // the last separator is finished, whatever follows is still being typed.
    if (!SEPARATOR.test(value)) {
      setDraft(value);
      return;
    }
    const parts = value.split(SEPARATOR);
    const rest = parts.pop() ?? "";
    commit(parts.join(","));
    setDraft(rest.trimStart());
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

  return (
    <div className="flex flex-col gap-2">
      {skills.length === 0 ? (
        <p className="text-xs text-black/50 italic">No skills added yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <li
              key={skill}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-black/30 bg-white py-1 pl-2.5 pr-1 text-xs font-semibold text-primary">
              <span className="truncate">{skill}</span>
              <button
                type="button"
                onClick={() => onChange(skills.filter((s) => s !== skill))}
                aria-label={`Remove ${skill}`}
                className="grid h-4 w-4 flex-none place-content-center rounded-full text-black/45 transition-colors hover:bg-[#222325] hover:text-white cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="text"
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder="Add a skill, then Enter"
        aria-label="Add a skill"
        className={cn(FIELD_CLASS, "rounded-sm", FIELD_TONE.idle)}
      />
    </div>
  );
};

export default SkillsEditor;
