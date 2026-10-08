"use client";

// The Content tab's Skills group: one plain list ("All"), or titled groups of
// skills ("Sub skills"), switched at the top. Switching keeps every skill —
// into one untitled group on the way in, back into the one list on the way out
// (group titles go; Undo brings them back). How groups print is the Customize
// tab's Skills panel. The rules that keep the flat list and the groups in step
// live in `app/lib/resume/skills.ts`.
//
// A skill can be dragged from one group into another, or to another place in
// its own (owner, 2026-10-04): the whole chip is the handle, the group under
// the pointer lights up, and the drop is one undo step.
//
// A group's title is a plain input while it is being typed, with nothing else
// beside it; Enter sets it as text, with its delete in a block beside it
// (owner, 2026-10-04). Clicking the text opens it for typing again.

import { useState, type Dispatch, type FC, type SetStateAction } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResumeContent, ResumeSkillGroup } from "@/app/lib/dashboard/types";
import { isGrouped, SKILL_GROUP_TITLE_MAX_CHARS, toFlat, toGrouped, withGroups } from "@/app/lib/resume/skills";
import { SegmentedControl, type SegmentedControlOption } from "../controls";
import EntryListEditor from "./EntryListEditor";
import SkillsEditor, { CHIP_CLASS, type SkillDragData } from "./SkillsEditor";
import { FIELD_CLASS, FIELD_TONE } from "./FormField";

type SkillsMode = "all" | "groups";

const MODE_OPTIONS: SegmentedControlOption<SkillsMode>[] = [
  { id: "all", label: "All" },
  { id: "groups", label: "Sub skills" },
];

export interface SkillsFieldProps {
  content: ResumeContent;
  setContent: Dispatch<SetStateAction<ResumeContent>>;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The groups with one skill moved: within its group to where `to.skill` stands,
 * or into another group (before `to.skill`, or at the end when dropped on the
 * group itself). A group that already has the skill keeps its one copy, and the
 * dragged one leaves its old group. Unchanged groups come back as they were.
 */
export function moveSkill(groups: ResumeSkillGroup[], from: Required<SkillDragData>, to: SkillDragData): ResumeSkillGroup[] {
  const source = groups.find((group) => group.id === from.group);
  const target = groups.find((group) => group.id === to.group);
  if (!source || !target || !source.skills.includes(from.skill)) return groups;

  if (source.id === target.id) {
    if (!to.skill || to.skill === from.skill) return groups;
    const at = source.skills.indexOf(to.skill);
    if (at < 0) return groups;
    const rest = source.skills.filter((skill) => skill !== from.skill);
    rest.splice(at, 0, from.skill);
    return groups.map((group) => (group.id === source.id ? { ...group, skills: rest } : group));
  }

  const already = target.skills.some((skill) => same(skill, from.skill));
  return groups.map((group) => {
    if (group.id === source.id) return { ...group, skills: group.skills.filter((skill) => skill !== from.skill) };
    if (group.id !== target.id || already) return group;
    const skills = [...group.skills];
    const at = to.skill ? skills.indexOf(to.skill) : -1;
    skills.splice(at < 0 ? skills.length : at, 0, from.skill);
    return { ...group, skills };
  });
}

interface GroupTitleProps {
  title: string;
  /** Being typed: an input and nothing else. Otherwise the title as text, its delete beside it. */
  typing: boolean;
  /** Opened for typing by a click on the text, so the input takes the cursor. */
  autoFocus: boolean;
  /** The first sub skill must have a title (owner, 2026-10-08): a red "Required" beside it while it has none. */
  required: boolean;
  onChange: (title: string) => void;
  onType: () => void;
  onSet: () => void;
  onRemove: () => void;
}

const GroupTitle: FC<GroupTitleProps> = ({ title, typing, autoFocus, required, onChange, onType, onSet, onRemove }) =>
  typing ? (
    // The input takes 80% of the row (owner, 2026-10-08), leaving room for the "Required" label.
    <div className="flex items-center gap-2.5">
      <input
        type="text"
        value={title}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onType}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          onSet();
        }}
        autoFocus={autoFocus}
        placeholder="Title, e.g. Frontend, then Enter"
        maxLength={SKILL_GROUP_TITLE_MAX_CHARS}
        aria-label="Sub skill title"
        aria-required={required || undefined}
        className={cn(FIELD_CLASS, "h-11 w-4/5 min-w-0 py-0", FIELD_TONE.idle)}
      />
      {required && !title.trim() && <span className="text-xs font-semibold text-[#b23c26]">Required</span>}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onType}
        title="Rename"
        className="h-9 min-w-0 flex-1 cursor-text truncate rounded-md px-1 text-left text-sm font-bold text-primary transition-colors hover:bg-[#f6f6f6]">
        {title}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Delete ${title}`}
        title="Delete this sub skill"
        className="grid h-9 w-9 flex-none cursor-pointer place-content-center rounded-lg border border-black/[0.22] text-[#b23c26] transition-colors hover:border-[#b23c26]/60 hover:bg-[#fbeeea]">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

/** The chip under the pointer when there is one, else the group: a drop lands before a chip, or at a group's end. */
const chipFirst: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const chips = hits.filter((hit) => String(hit.id).startsWith("chip::"));
  return chips.length > 0 ? chips : hits;
};

const SkillsField: FC<SkillsFieldProps> = ({ content, setContent }) => {
  const grouped = isGrouped(content);
  const [dragging, setDragging] = useState<Required<SkillDragData> | null>(null);
  const [overGroup, setOverGroup] = useState<string | null>(null);
  // Groups whose title is being typed. An untitled group always is.
  const [typingTitles, setTypingTitles] = useState<ReadonlySet<string>>(() => new Set());
  const setTyping = (id: string, typing: boolean) =>
    setTypingTitles((prev) => {
      if (prev.has(id) === typing) return prev;
      const next = new Set(prev);
      if (typing) next.add(id);
      else next.delete(id);
      return next;
    });
  const sensors = useSensors(
    // A few pixels before a drag starts, so a click on a chip's × still removes it.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as SkillDragData | undefined;
    if (data?.skill) setDragging({ group: data.group, skill: data.skill });
  };
  const onDragOver = ({ over }: DragOverEvent) => setOverGroup((over?.data.current as SkillDragData | undefined)?.group ?? null);
  const onDragEnd = ({ over }: DragEndEvent) => {
    const from = dragging;
    const to = over?.data.current as SkillDragData | undefined;
    setDragging(null);
    setOverGroup(null);
    if (!from || !to) return;
    setContent((prev) => (isGrouped(prev) ? withGroups(prev, moveSkill(prev.skillGroups, from, to)) : prev));
  };
  const onDragCancel = () => {
    setDragging(null);
    setOverGroup(null);
  };

  const switchTo = (mode: SkillsMode) => {
    // Made here, not in the updater: an updater runs again under Strict Mode and must not mint a second id.
    const id = `skg-${Date.now()}`;
    setContent((prev) => (mode === "all" ? toFlat(prev) : isGrouped(prev) ? prev : toGrouped(prev, id)));
  };

  return (
    <div className="flex flex-col gap-2.5">
      <SegmentedControl size="sm" ariaLabel="How your skills are listed" options={MODE_OPTIONS} value={grouped ? "groups" : "all"} onChange={switchTo} />

      {grouped ? (
        <DndContext sensors={sensors} collisionDetection={chipFirst} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <EntryListEditor<ResumeSkillGroup>
          items={content.skillGroups}
          onChange={(groups) => setContent((prev) => withGroups(prev, groups))}
          createItem={() => ({ id: `skg-${Date.now()}`, title: "", skills: [] })}
          addLabel="Add a sub skill"
          emptyLabel="No sub skills yet."
          removeInFields
          renderFields={(group, update, _isActive, remove) => (
            <>
              <GroupTitle
                title={group.title}
                typing={!group.title.trim() || typingTitles.has(group.id)}
                autoFocus={typingTitles.has(group.id)}
                required={group.id === content.skillGroups[0]?.id}
                onChange={(title) => update({ title })}
                onType={() => setTyping(group.id, true)}
                onSet={() => {
                  const title = group.title.trim();
                  if (!title) return;
                  if (title !== group.title) update({ title });
                  setTyping(group.id, false);
                }}
                onRemove={remove}
              />
              <SkillsEditor
                skills={group.skills}
                onChange={(skills) => update({ skills })}
                placeholder="Add a skill to this group or drag and drop from other groups"
                group={group.id}
                // Lit only for a group the chip would move to, not the one it came from.
                dropping={dragging !== null && overGroup === group.id && dragging.group !== group.id}
              />
            </>
          )}
        />
        {/* The chip under the pointer while it moves; the one left behind fades. */}
        <DragOverlay dropAnimation={null}>
          {dragging && <span className={cn(CHIP_CLASS, "cursor-grabbing pr-2.5 br-shadow br-lime")}>{dragging.skill}</span>}
        </DragOverlay>
        </DndContext>
      ) : (
        <SkillsEditor skills={content.skills} onChange={(skills) => setContent((prev) => ({ ...prev, skills }))} />
      )}
    </div>
  );
};

export default SkillsField;
