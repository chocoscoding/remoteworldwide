"use client";

// The Content tab's editing form. `ResumePaper` (chunk A2) is a pure,
// read-only, prop-driven renderer with no `onChange`/`contentEditable` by
// design, so editing lives here instead of baked into the "preview" the way
// the old screen did it — a genuine form with controlled inputs, wired to
// real `ResumeContent` fields that actually persist.
//
// The owner's 2026-10-04 layout: one card of collapsible sections, each saying
// what is in it while closed ("Oluwatimileyin Oyeti · Fullstack Developer ·
// Lagos"). An open section wears a dark header. The lists (Experience,
// Education, Projects, Certifications) are rows that open one at a time for
// editing (`EntryListEditor`); a role can be hidden from the resume without
// being deleted. Projects and Certifications, while empty, wait at the bottom
// as "Add a section" chips. The sections run in the paper's default order, so
// the form reads top to bottom the way the page does.
//
// One section is open at a time: opening another closes the one before, both
// moving (`Collapse`). The form never highlights the paper — that is for the
// fix cards and AI Tools.
//
// New entries start EMPTY and lean on their inputs' placeholders. A starter
// value ("New school", "Degree") is on the page the moment it is created, and
// stays there for anyone who fills in one field and not the other.
//
// Dates are picked from dropdowns, never typed (`DateRangeField`).

import { useState, type Dispatch, type FC, type ReactNode, type SetStateAction } from "react";
import { ChevronDown, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ResumeCertEntry,
  ResumeContent,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeProjectEntry,
} from "@/app/lib/dashboard/types";
import { TextField, TextAreaField } from "./FormField";
import LinksEditor from "./LinksEditor";
import EntryListEditor, { type EntrySummary } from "./EntryListEditor";
import BulletsEditor from "./BulletsEditor";
import SkillsField from "./SkillsField";
import DateRangeField from "./DateRangeField";
import Collapse from "../controls/Collapse";

type ContentGroupId = "personal" | "summary" | "links" | "experience" | "education" | "skills" | "projects" | "certifications";

export interface ContentFormProps {
  content: ResumeContent;
  setContent: Dispatch<SetStateAction<ResumeContent>>;
  /**
   * Why the standing job check proposes a new Summary, or null when no check
   * has proposed one — which is every resume the user started or imported.
   */
  suggestionReason: string | null;
  summarySuggestion: "pending" | "accepted" | "dismissed";
  onAcceptSummarySuggestion: () => void;
  onDismissSummarySuggestion: () => void;
}

/** A date picker's name for a screen reader: "Dates for Designer at Kite Labs", or just "Dates" on a blank entry. */
function entryLabel(prefix: string, ...names: (string | undefined)[]): string {
  const named = names.map((name) => (name ?? "").trim()).filter(Boolean);
  return named.length > 0 ? `${prefix} ${named.join(" at ")}` : "Dates";
}

const joined = (parts: (string | undefined)[], glue = " · ") =>
  parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(glue);

/** A fresh entry id. Made in the click handler, never in a state updater (Strict Mode runs those twice). */
const newEntryId = (prefix: string) => `${prefix}-${Date.now()}`;

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const summarizeRole = (item: ResumeExperienceEntry): EntrySummary => ({
  title: joined([item.role, item.company]),
  meta: joined([item.dates, count(item.bullets.filter((b) => b.trim()).length, "bullet")]),
});
const summarizeSchool = (item: ResumeEducationEntry): EntrySummary => ({
  title: joined([item.degree, item.school]),
  meta: joined([item.dates, item.location]),
});
const summarizeProject = (item: ResumeProjectEntry): EntrySummary => ({
  title: item.name.trim(),
  meta: item.link?.trim() || item.detail.trim(),
});
const summarizeCert = (item: ResumeCertEntry): EntrySummary => ({ title: item.name.trim(), meta: joined([item.issuer, item.year]) });

/** A field's label in the editing card, above whatever control it names. */
const FieldLabel: FC<{ children: ReactNode }> = ({ children }) => <span className="text-xs font-bold text-[#44453f]">{children}</span>;

const ContentForm: FC<ContentFormProps> = ({
  content,
  setContent,
  suggestionReason,
  summarySuggestion,
  onAcceptSummarySuggestion,
  onDismissSummarySuggestion,
}) => {
  // One open at a time (owner, 2026-10-04). Opens where the work is: the details for a blank
  // resume, the roles for one that has a name.
  const [open, setOpen] = useState<ContentGroupId | null>(() => (content.name.trim() ? "experience" : "personal"));
  const toggle = (id: ContentGroupId) => setOpen((prev) => (prev === id ? null : id));

  const setField = <K extends keyof ResumeContent>(key: K, value: ResumeContent[K]) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  // ── "Add a section" ──────────────────────────────────────────────────────
  // An empty Projects or Certifications waits at the bottom as a chip; adding it
  // opens the section with one empty entry ready to fill in.
  const [autoEdit, setAutoEdit] = useState<string | null>(null);
  const addSection = (id: "projects" | "certifications") => {
    const entryId = newEntryId(id === "projects" ? "proj" : "cert");
    setContent((prev) =>
      id === "projects"
        ? { ...prev, projects: [...prev.projects, { id: entryId, name: "", detail: "" }] }
        : { ...prev, certifications: [...prev.certifications, { id: entryId, name: "" }] },
    );
    setAutoEdit(entryId);
    setOpen(id);
  };

  const hiddenRoles = content.experience.filter((entry) => entry.hidden).length;
  const shownRoles = content.experience.length - hiddenRoles;
  const listed = (items: string[], empty: string) => items.filter(Boolean).join(", ") || empty;

  /** One collapsible section of the card. */
  const section = (
    id: ContentGroupId,
    title: string,
    summary: string,
    body: ReactNode,
    { meta, first = false, marker = false }: { meta?: string; first?: boolean; marker?: boolean } = {},
  ) => {
    const isOpen = open === id;
    return (
      <div
        key={id}
        className={cn(
          !first && !isOpen && "border-t border-black/[0.16]",
          isOpen && "border-y border-[#222325] bg-[#fbfbf7]",
          isOpen && first && "border-t-0",
        )}>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => toggle(id)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 px-3.5 py-2 text-left transition-colors",
            isOpen ? "min-h-12 bg-[#222325] text-white" : "min-h-14 text-primary hover:bg-[#fbfbf7]",
          )}>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn("flex items-center gap-2 text-sm", isOpen ? "font-extrabold" : "font-bold")}>
              {title}
              {marker && <span aria-label="A suggestion is waiting" className="h-1.5 w-1.5 flex-none rounded-full bg-[#e1f073]" />}
            </span>
            {!isOpen && <span className="truncate text-xs text-[#5f6062]">{summary}</span>}
          </span>
          {isOpen && meta && <span className="flex-none text-xs font-bold text-[#e1f073]">{meta}</span>}
          <ChevronDown aria-hidden className={cn("h-3.5 w-3.5 flex-none transition-transform duration-200", isOpen && "rotate-180")} />
        </button>
        <Collapse open={isOpen}>
          <div className="flex flex-col gap-2.5 p-2">{body}</div>
        </Collapse>
      </div>
    );
  };

  const groups: ReactNode[] = [
    section(
      "personal",
      "Personal details",
      joined([content.name, content.title, content.location]) || "Your name, title and contact details",
      <div className="grid grid-cols-2 gap-2.5">
        <TextField label="Name" value={content.name} onChange={(v) => setField("name", v)} placeholder="Your name" />
        <TextField label="Title" value={content.title} onChange={(v) => setField("title", v)} placeholder="Your title" />
        <TextField label="Email" type="email" value={content.email} onChange={(v) => setField("email", v)} placeholder="you@email.com" />
        <TextField label="Phone" type="tel" value={content.phone} onChange={(v) => setField("phone", v)} placeholder="+1 555 000 0000" />
        <TextField
          label="Location"
          value={content.location}
          onChange={(v) => setField("location", v)}
          placeholder="City, Country"
          className="col-span-2"
        />
      </div>,
      { first: true },
    ),
    section(
      "summary",
      "Summary",
      content.summary.trim() || "Not written yet",
      <>
        <TextAreaField
          value={content.summary}
          onChange={(v) => setField("summary", v)}
          placeholder="A short summary of your experience and what you're looking for next."
          rows={5}
        />
        {suggestionReason !== null && summarySuggestion === "pending" && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-[#eef6ad] px-3 py-2.5 text-xs">
            <Sparkles className="h-3 w-3 flex-none text-black/50" />
            <span className="text-black/60">AI suggestion: {suggestionReason}</span>
            <button type="button" onClick={onAcceptSummarySuggestion} className="cursor-pointer font-semibold text-primary hover:underline">
              Accept
            </button>
            <span className="text-black/25">·</span>
            <button
              type="button"
              onClick={onDismissSummarySuggestion}
              className="cursor-pointer font-semibold text-black/45 hover:underline">
              Dismiss
            </button>
          </div>
        )}
        {suggestionReason !== null && summarySuggestion === "accepted" && (
          <p className="text-xs font-semibold text-[#6c7a1e]">AI-tailored, accepted</p>
        )}
      </>,
      { marker: suggestionReason !== null && summarySuggestion === "pending" },
    ),
    section(
      "links",
      "Links",
      listed(
        content.links.map((link) => link.label.trim() || link.url.trim()),
        "None yet",
      ),
      <LinksEditor links={content.links} onChange={(links) => setField("links", links)} />,
      { meta: content.links.length > 0 ? count(content.links.length, "link") : undefined },
    ),
    section(
      "experience",
      "Experience",
      content.experience.length === 0
        ? "No roles yet"
        : `${count(content.experience.length, "role")} · ${listed(
            content.experience.map((e) => e.company.trim() || e.role.trim()),
            "",
          )}`,
      <EntryListEditor<ResumeExperienceEntry>
        items={content.experience}
        onChange={(items) => setField("experience", items)}
        // One empty bullet, so a new role opens with somewhere to type.
        createItem={() => ({ id: `exp-${Date.now()}`, role: "", company: "", dates: "", bullets: [""] })}
        addLabel="Add a role"
        emptyLabel="No experience added yet."
        summarize={summarizeRole}
        noun="role"
        hideable
        renderFields={(item, update) => (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <TextField label="Role" value={item.role} onChange={(v) => update({ role: v })} placeholder="Role" />
              <TextField label="Company" value={item.company} onChange={(v) => update({ company: v })} placeholder="Company" />
            </div>
            <div className="flex flex-col gap-[5px]">
              <FieldLabel>Dates</FieldLabel>
              <DateRangeField
                value={item.dates}
                onChange={(dates) => update({ dates })}
                label={entryLabel("Dates for", item.role, item.company)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <FieldLabel>Bullets</FieldLabel>
              <BulletsEditor bullets={item.bullets} onChange={(bullets) => update({ bullets })} />
            </div>
          </>
        )}
      />,
      {
        meta:
          content.experience.length === 0
            ? undefined
            : hiddenRoles > 0
              ? `${shownRoles} shown · ${hiddenRoles} hidden`
              : count(content.experience.length, "role"),
      },
    ),
    section(
      "education",
      "Education",
      listed(
        content.education.map((e) => joined([e.degree, e.school])),
        "None yet",
      ),
      <EntryListEditor<ResumeEducationEntry>
        items={content.education}
        onChange={(items) => setField("education", items)}
        createItem={() => ({ id: `edu-${Date.now()}`, school: "", degree: "", dates: "" })}
        addLabel="Add education"
        emptyLabel="No education added yet."
        summarize={summarizeSchool}
        noun="school"
        renderFields={(item, update) => (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <TextField label="School" value={item.school} onChange={(v) => update({ school: v })} placeholder="School" />
              <TextField label="Degree" value={item.degree} onChange={(v) => update({ degree: v })} placeholder="Degree" />
            </div>
            <div className="flex flex-col gap-[5px]">
              <FieldLabel>Dates</FieldLabel>
              <DateRangeField value={item.dates} onChange={(dates) => update({ dates })} label={entryLabel("Dates at", item.school)} />
            </div>
            <TextField label="Location" value={item.location ?? ""} onChange={(v) => update({ location: v })} placeholder="Optional" />
            <TextField
              label="Detail"
              value={item.detail ?? ""}
              onChange={(v) => update({ detail: v })}
              placeholder="Honours, thesis, focus (optional)"
            />
          </>
        )}
      />,
      { meta: content.education.length > 0 ? count(content.education.length, "entry", "entries") : undefined },
    ),
    section(
      "skills",
      "Skills",
      content.skills.length === 0
        ? "None yet"
        : `${content.skills.length} · ${content.skills.slice(0, 8).join(", ")}${content.skills.length > 8 ? "…" : ""}`,
      <SkillsField content={content} setContent={setContent} />,
      { meta: content.skills.length > 0 ? count(content.skills.length, "skill") : undefined },
    ),
  ];

  if (content.projects.length > 0 || open === "projects") {
    groups.push(
      section(
        "projects",
        "Projects",
        listed(
          content.projects.map((p) => p.name.trim()),
          "None yet",
        ),
        <EntryListEditor<ResumeProjectEntry>
          items={content.projects}
          onChange={(items) => setField("projects", items)}
          createItem={() => ({ id: `proj-${Date.now()}`, name: "", detail: "" })}
          addLabel="Add a project"
          emptyLabel="No projects added yet."
          summarize={summarizeProject}
          noun="project"
          autoEditId={autoEdit}
          renderFields={(item, update) => (
            <>
              <TextField label="Name" value={item.name} onChange={(v) => update({ name: v })} placeholder="Project name" />
              <TextAreaField
                label="Detail"
                value={item.detail}
                onChange={(v) => update({ detail: v })}
                placeholder="What it does, and your impact"
                rows={2}
              />
              <TextField label="Link" value={item.link ?? ""} onChange={(v) => update({ link: v })} placeholder="Optional" />
            </>
          )}
        />,
        { meta: content.projects.length > 0 ? count(content.projects.length, "project") : undefined },
      ),
    );
  }

  if (content.certifications.length > 0 || open === "certifications") {
    groups.push(
      section(
        "certifications",
        "Certifications",
        listed(
          content.certifications.map((c) => c.name.trim()),
          "None yet",
        ),
        <EntryListEditor<ResumeCertEntry>
          items={content.certifications}
          onChange={(items) => setField("certifications", items)}
          createItem={() => ({ id: `cert-${Date.now()}`, name: "" })}
          addLabel="Add certification"
          emptyLabel="No certifications added yet."
          summarize={summarizeCert}
          noun="certification"
          autoEditId={autoEdit}
          renderFields={(item, update) => (
            <>
              <TextField label="Name" value={item.name} onChange={(v) => update({ name: v })} placeholder="Certification name" />
              <TextField label="Issuer" value={item.issuer ?? ""} onChange={(v) => update({ issuer: v })} placeholder="Optional" />
              {/* `year` is the field's historical name; it holds the same date line as the others. */}
              <div className="flex flex-col gap-[5px]">
                <FieldLabel>Dates</FieldLabel>
                <DateRangeField value={item.year ?? ""} onChange={(year) => update({ year })} label={entryLabel("Dates for", item.name)} />
              </div>
            </>
          )}
        />,
        { meta: content.certifications.length > 0 ? count(content.certifications.length, "certification") : undefined },
      ),
    );
  }

  const chips = (
    [
      ["projects", "Projects", content.projects.length === 0 && open !== "projects"],
      ["certifications", "Certifications", content.certifications.length === 0 && open !== "certifications"],
    ] as const
  ).filter(([, , waiting]) => waiting);

  return (
    <section aria-label="Resume content" className="flex flex-col gap-2">
      <h2 className="px-0.5 text-lg font-extrabold tracking-[-0.01em] text-primary">Content</h2>

      <div className="overflow-hidden rounded-xl bg-white br-shadow">
        {groups}

        {chips.length > 0 && (
          <div className="flex min-h-12 flex-wrap items-center gap-2 border-t border-black/[0.16] px-3.5 py-2">
            <span className="text-xs text-[#5f6062]">Add a section</span>
            {chips.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => addSection(id)}
                className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full border border-dashed border-black/50 px-3 text-xs font-bold text-primary transition-colors hover:border-[#222325] hover:bg-[#fbfbf7]">
                <Plus className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ContentForm;
