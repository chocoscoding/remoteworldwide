"use client";

// The profile's work experience: one card per role — title, company, dates,
// location and bullets — in the education list's look (the resume editor's
// card shell, field tone and bullet rows), bound to `profile.experience`.
// Shared by onboarding, where it is optional (owner, 2026-09-27: "experience
// not required, can be skipped"), and Settings → Profile.
//
// Unlike education, order means something here (most recent first), so a role
// can move up or down. Every control is a real button in the tab order with a
// name that says which role it acts on; a move or a removal puts focus back
// where the hand is, and a polite live region says what happened, so a screen
// reader hears the change the eye sees.
//
// Rows carry an editor-only `id`; callers strip it on save. A role with dates
// or bullets but neither a company nor a title is the one shape the backend
// refuses, so it is called out on the card and callers hold their Save
// (`experienceProblems`). The backend's ceilings are kept as you type: field
// lengths by `maxLength`, 20 roles and 12 bullets by the controls going away.

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type FC } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import BulletsEditor from "@/app/components/dashboard/resume/content/BulletsEditor";
import { FIELD_CLASS, FIELD_TONE } from "@/app/components/dashboard/resume/content/FormField";
import { EXPERIENCE_LIMITS, experienceProblems, type ExperienceRow } from "@/app/lib/onboarding/profile";

/** A new role opens with one empty bullet, so there is somewhere to type (the resume editor's rule). */
export const blankExperienceRow = (id: string): ExperienceRow => ({ id, company: "", title: "", dates: "", location: "", bullets: [""] });

/** How a role is named to a screen reader: what the card says, or its place in the list. */
function roleName(row: ExperienceRow, index: number): string {
  const title = row.title.trim();
  const company = row.company.trim();
  if (title && company) return `${title} at ${company}`;
  return title || company || `role ${index + 1}`;
}

type FocusTarget = "title" | "up" | "down" | "add";

const RoleInput: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
  isActive: boolean;
  className?: string;
  focusKey?: FocusTarget;
  invalid?: boolean;
  describedBy?: string;
}> = ({ label, value, onChange, placeholder, maxLength, isActive, className, focusKey, invalid, describedBy }) => (
  <input
    type="text"
    aria-label={label}
    aria-invalid={invalid || undefined}
    aria-describedby={describedBy}
    data-focus={focusKey}
    value={value}
    maxLength={maxLength}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className={cn(FIELD_CLASS, "w-full min-w-0 rounded-sm", isActive ? FIELD_TONE.active : FIELD_TONE.idle, className)}
  />
);

/** The card's small square controls: always visible (a hover-only control is lost on touch and to a keyboard), louder while the card is active. */
const CardButton: FC<ButtonHTMLAttributes<HTMLButtonElement> & { label: string; isActive: boolean; focusKey: string }> = ({
  label,
  isActive,
  focusKey,
  className,
  children,
  ...rest
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    data-focus={focusKey}
    className={cn(
      "grid h-7 w-7 flex-none place-content-center rounded-md border transition-all duration-200 cursor-pointer disabled:cursor-default disabled:opacity-30",
      isActive
        ? "border-[#1f1f1f] bg-white text-primary enabled:hover:bg-[#222325] enabled:hover:text-white"
        : "border-black/20 bg-white text-black/45 enabled:hover:border-[#222325] enabled:hover:bg-[#222325] enabled:hover:text-white enabled:hover:shadow-[2px_2px_0_0_#e1f073]",
      className,
    )}
    {...rest}>
    {children}
  </button>
);

const ExperienceEditor: FC<{ rows: ExperienceRow[]; onChange: (rows: ExperienceRow[]) => void }> = ({ rows, onChange }) => {
  const problems = new Set(experienceProblems(rows));
  const full = rows.length >= EXPERIENCE_LIMITS.entries;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const cards = useRef<(HTMLFieldSetElement | null)[]>([]);
  const addButton = useRef<HTMLButtonElement | null>(null);
  const seq = useRef(0);
  // Where focus goes once the list has re-rendered: a card added, moved or removed by this click
  // has no element in its new place until React commits it.
  const pendingFocus = useRef<{ index: number; target: FocusTarget } | null>(null);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    if (pending.target === "add") {
      addButton.current?.focus();
      return;
    }
    const card = cards.current[pending.index];
    const wanted = card?.querySelector<HTMLInputElement | HTMLButtonElement>(`[data-focus="${pending.target}"]`);
    // A move to either end disables the button that made it: its partner takes the focus.
    const partner = pending.target === "up" ? "down" : pending.target === "down" ? "up" : null;
    if (wanted && !wanted.disabled) wanted.focus();
    else if (partner) card?.querySelector<HTMLButtonElement>(`[data-focus="${partner}"]`)?.focus();
  });

  const update = (index: number, patch: Partial<ExperienceRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const add = () => {
    if (full) return;
    seq.current += 1;
    onChange([...rows, blankExperienceRow(`exp-${Date.now()}-${seq.current}`)]);
    pendingFocus.current = { index: rows.length, target: "title" };
    setAnnouncement(`Role ${rows.length + 1} added.`);
  };

  const remove = (index: number) => {
    const name = roleName(rows[index], index);
    onChange(rows.filter((_, i) => i !== index));
    // The role that takes its place, else the one above, else the way to add one.
    const left = rows.length - 1;
    pendingFocus.current = left === 0 ? { index: 0, target: "add" } : { index: Math.min(index, left - 1), target: "title" };
    setAnnouncement(`Removed ${name}.`);
  };

  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
    pendingFocus.current = { index: to, target: by < 0 ? "up" : "down" };
    setAnnouncement(`Moved ${roleName(rows[index], index)} to position ${to + 1} of ${rows.length}.`);
  };

  return (
    // A container, so the company and dates sit side by side only when the card itself has room —
    // the same editor lives in a narrow onboarding column and in the wider settings page.
    <div className="flex flex-col gap-2.5 [container-type:inline-size]">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {rows.length === 0 ? (
        <p className="text-xs text-black/50 italic">No roles added yet.</p>
      ) : (
        <ol className="flex flex-col gap-2.5" aria-label="Your roles, most recent first">
          {rows.map((row, index) => {
            const isActive = activeId === row.id;
            const name = roleName(row, index);
            const problemId = problems.has(row.id) ? `exp-problem-${row.id}` : undefined;
            return (
              <li key={row.id}>
                <fieldset
                  ref={(el) => {
                    cards.current[index] = el;
                  }}
                  onMouseEnter={() => setActiveId(row.id)}
                  onMouseLeave={() => setActiveId((prev) => (prev === row.id ? null : prev))}
                  onFocusCapture={() => setActiveId(row.id)}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveId((prev) => (prev === row.id ? null : prev));
                  }}
                  className={cn(
                    "flex min-w-0 flex-col gap-2 rounded-xl border p-2 transition-all duration-200",
                    isActive ? "border-[#222325] bg-[#e9e9e4] shadow-[3px_3px_0_0_#e1f073]" : "border-black/15 bg-white hover:border-black/45 hover:bg-[#f8f8f6]",
                  )}>
                  <legend className="sr-only">
                    Role {index + 1} of {rows.length}
                    {name !== `role ${index + 1}` ? `: ${name}` : ""}
                  </legend>

                  {/* On a narrow card the controls take a row of their own above the title, which then
                      gets the full width; on a wide one they sit at the end of the title's row. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span aria-hidden className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] text-black/45 [@container(max-width:359px)]:order-first [@container(max-width:359px)]:block">
                      Role {index + 1}
                    </span>
                    <RoleInput
                      label="Job title"
                      placeholder="Job title"
                      focusKey="title"
                      value={row.title}
                      maxLength={EXPERIENCE_LIMITS.title}
                      onChange={(title) => update(index, { title })}
                      isActive={isActive}
                      invalid={problemId !== undefined}
                      describedBy={problemId}
                      className="flex-1 [@container(max-width:359px)]:basis-full"
                    />
                    <div className="flex flex-none items-center gap-1 [@container(max-width:359px)]:order-first [@container(max-width:359px)]:ml-auto">
                      <CardButton label={`Move ${name} up`} focusKey="up" isActive={isActive} disabled={index === 0} onClick={() => move(index, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </CardButton>
                      <CardButton label={`Move ${name} down`} focusKey="down" isActive={isActive} disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </CardButton>
                      <CardButton label={`Remove ${name}`} focusKey="remove" isActive={isActive} onClick={() => remove(index)}>
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </CardButton>
                    </div>
                  </div>

                  {problemId && (
                    <p id={problemId} className="px-0.5 text-xs font-semibold text-[#b23c26]">
                      Add the job title or the company, or remove this role.
                    </p>
                  )}

                  <div className="flex flex-col gap-2 [@container(min-width:440px)]:flex-row">
                    <RoleInput
                      label="Company"
                      placeholder="Company"
                      value={row.company}
                      maxLength={EXPERIENCE_LIMITS.company}
                      onChange={(company) => update(index, { company })}
                      isActive={isActive}
                      invalid={problemId !== undefined}
                      describedBy={problemId}
                      className="flex-1"
                    />
                    <RoleInput
                      label="Dates"
                      placeholder="Jan 2022 – Present"
                      value={row.dates}
                      maxLength={EXPERIENCE_LIMITS.dates}
                      onChange={(dates) => update(index, { dates })}
                      isActive={isActive}
                      className="[@container(min-width:440px)]:w-44 [@container(min-width:440px)]:flex-none"
                    />
                  </div>
                  <RoleInput
                    label="Location"
                    placeholder="Location (optional)"
                    value={row.location}
                    maxLength={EXPERIENCE_LIMITS.location}
                    onChange={(location) => update(index, { location })}
                    isActive={isActive}
                  />
                  <BulletsEditor
                    bullets={row.bullets}
                    onChange={(bullets) => update(index, { bullets })}
                    isActive={isActive}
                    max={EXPERIENCE_LIMITS.bullets}
                    maxLength={EXPERIENCE_LIMITS.bullet}
                  />
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}

      <button
        ref={addButton}
        type="button"
        onClick={add}
        disabled={full}
        className="inline-flex items-center gap-1.5 self-start rounded-lg border border-dashed border-black/30 px-3 py-2 text-xs font-semibold text-black/55 transition-colors hover:border-[#222325] hover:text-primary cursor-pointer disabled:cursor-default disabled:opacity-50 disabled:hover:border-black/30 disabled:hover:text-black/55">
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {full ? `Up to ${EXPERIENCE_LIMITS.entries} roles` : rows.length === 0 ? "Add a role" : "Add another role"}
      </button>
    </div>
  );
};

export default ExperienceEditor;
