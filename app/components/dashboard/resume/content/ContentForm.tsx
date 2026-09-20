"use client";

// The Content tab's editing form. `ResumePaper` (chunk A2) is a pure,
// read-only, prop-driven renderer with no `onChange`/`contentEditable` by
// design, so editing lives here instead of baked into the "preview" the way
// the old screen did it — a genuine form with controlled inputs, wired to
// real `ResumeContent` fields that actually persist (the old screen's
// Projects/Education "editing" wrote into a local array nobody rendered from;
// this one is bound directly to the content the paper reads).
//
// Every section the paper renders has a group here — a resume started from
// scratch has no other way to acquire an Experience entry or a skill. The
// groups run in the paper's own default order, so the form reads top to bottom
// the way the page does.
//
// Owns its own mini jump-list + scroll/flash-highlight, same mechanic as the
// old screen's `focusSection`, just repointed at these field groups instead
// of the old inline-preview sections.
//
// New entries start EMPTY and lean on their inputs' placeholders. A starter
// value ("New school", "Degree") is on the page the moment it is created, and
// stays there for anyone who fills in one field and not the other.

import { useRef, useState, type Dispatch, type FC, type SetStateAction } from "react";
import { Sparkles } from "lucide-react";
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
import EntryListEditor from "./EntryListEditor";
import BulletsEditor from "./BulletsEditor";
import SkillsEditor from "./SkillsEditor";

type ContentGroupId = "personal" | "summary" | "links" | "experience" | "education" | "skills" | "projects" | "certifications";

const CONTENT_GROUPS: { id: ContentGroupId; label: string }[] = [
  { id: "personal", label: "Personal details" },
  { id: "summary", label: "Summary" },
  { id: "links", label: "Links" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "certifications", label: "Certifications" },
];

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

function groupMeta(id: ContentGroupId, content: ResumeContent): number | null {
  if (id === "links") return content.links.length;
  if (id === "experience") return content.experience.length;
  if (id === "education") return content.education.length;
  if (id === "skills") return content.skills.length;
  if (id === "projects") return content.projects.length;
  if (id === "certifications") return content.certifications.length;
  return null;
}

const ContentForm: FC<ContentFormProps> = ({
  content,
  setContent,
  suggestionReason,
  summarySuggestion,
  onAcceptSummarySuggestion,
  onDismissSummarySuggestion,
}) => {
  const [activeGroup, setActiveGroup] = useState<ContentGroupId>("personal");
  const [flashGroup, setFlashGroup] = useState<ContentGroupId | null>(null);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const focusGroup = (id: ContentGroupId) => {
    setActiveGroup(id);
    groupRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlashGroup(id);
    window.setTimeout(() => setFlashGroup((v) => (v === id ? null : v)), 1400);
  };

  const flashClass = (id: ContentGroupId) =>
    cn("rounded-xl transition-shadow duration-300", flashGroup === id && "ring-2 ring-secondary ring-offset-4 ring-offset-white");

  const setField = <K extends keyof ResumeContent>(key: K, value: ResumeContent[K]) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Jump list */}
      <div className="flex flex-col gap-0.5">
        {CONTENT_GROUPS.map((group) => {
          const meta = groupMeta(group.id, content);
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => focusGroup(group.id)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] cursor-pointer transition-all text-left",
                activeGroup === group.id
                  ? "bg-[#222325] text-white font-bold shadow-[inset_3px_3px_0_0_rgba(0,0,0,0.4)] translate-x-px translate-y-px"
                  : "font-medium text-black/60 hover:bg-[#f6f6f6]",
              )}>
              <span className="flex min-w-0 items-center gap-2">
                {group.id === "summary" && suggestionReason !== null && summarySuggestion === "pending" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-secondary flex-none" />
                )}
                <span className="truncate">{group.label}</span>
              </span>
              {meta !== null && (
                <span className={cn("text-xs font-semibold", activeGroup === group.id ? "text-white/70" : "text-black/50")}>{meta}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 pt-3 border-t border-black/15">
        {/* Personal details */}
        <div
          ref={(el) => {
            groupRefs.current.personal = el;
          }}
          className={cn("flex flex-col gap-2.5 p-1", flashClass("personal"))}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55 px-1">Personal details</p>
          <TextField label="Name" value={content.name} onChange={(v) => setField("name", v)} placeholder="Your name" />
          <TextField label="Title" value={content.title} onChange={(v) => setField("title", v)} placeholder="Your title" />
          <TextField label="Location" value={content.location} onChange={(v) => setField("location", v)} placeholder="City, Country" />
          <TextField label="Email" type="email" value={content.email} onChange={(v) => setField("email", v)} placeholder="you@email.com" />
          <TextField label="Phone" type="tel" value={content.phone} onChange={(v) => setField("phone", v)} placeholder="+1 555 000 0000" />
        </div>

        {/* Summary */}
        <div
          ref={(el) => {
            groupRefs.current.summary = el;
          }}
          className={cn("flex flex-col gap-2 p-1", flashClass("summary"))}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55 px-1">Summary</p>
          <TextAreaField
            value={content.summary}
            onChange={(v) => setField("summary", v)}
            placeholder="A short summary of your experience and what you're looking for next."
            rows={5}
          />
          {suggestionReason !== null && summarySuggestion === "pending" && (
            <div className="rounded-lg bg-secondary/25 px-3 py-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <Sparkles className="h-3 w-3 text-black/50 flex-none" />
              <span className="text-black/55">
                AI suggestion — {suggestionReason}
              </span>
              <button
                type="button"
                onClick={onAcceptSummarySuggestion}
                className="font-semibold text-primary hover:underline cursor-pointer">
                Accept
              </button>
              <span className="text-black/25">·</span>
              <button
                type="button"
                onClick={onDismissSummarySuggestion}
                className="font-semibold text-black/45 hover:underline cursor-pointer">
                Dismiss
              </button>
            </div>
          )}
          {suggestionReason !== null && summarySuggestion === "accepted" && (
            <p className="text-xs font-semibold text-[#6c7a1e]">AI-tailored — accepted</p>
          )}
        </div>

        {/* Links */}
        <div
          ref={(el) => {
            groupRefs.current.links = el;
          }}
          className={cn("flex flex-col gap-2 p-1", flashClass("links"))}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55 px-1">Links</p>
          <LinksEditor links={content.links} onChange={(links) => setField("links", links)} />
        </div>

        {/* Experience */}
        <div
          ref={(el) => {
            groupRefs.current.experience = el;
          }}
          className={cn("flex flex-col gap-2 p-1", flashClass("experience"))}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55 px-1">Experience</p>
          <EntryListEditor<ResumeExperienceEntry>
            items={content.experience}
            onChange={(items) => setField("experience", items)}
            // One empty bullet, so a new role opens with somewhere to type.
            createItem={() => ({ id: `exp-${Date.now()}`, role: "", company: "", dates: "", bullets: [""] })}
            addLabel="Add a role"
            emptyLabel="No experience added yet."
            renderFields={(item, update, isActive) => (
              <>
                <TextField value={item.role} onChange={(v) => update({ role: v })} placeholder="Role" isActive={isActive} />
                <div className="flex gap-2">
                  <TextField
                    value={item.company}
                    onChange={(v) => update({ company: v })}
                    placeholder="Company"
                    className="flex-1"
                    isActive={isActive}
                  />
                  <TextField
                    value={item.dates}
                    onChange={(v) => update({ dates: v })}
                    placeholder="2021–Present"
                    className="w-32 flex-none"
                    isActive={isActive}
                  />
                </div>
                <BulletsEditor bullets={item.bullets} onChange={(bullets) => update({ bullets })} isActive={isActive} />
              </>
            )}
          />
        </div>

        {/* Education */}
        <div
          ref={(el) => {
            groupRefs.current.education = el;
          }}
          className={cn("flex flex-col gap-2 p-1", flashClass("education"))}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55 px-1">Education</p>
          <EntryListEditor<ResumeEducationEntry>
            items={content.education}
            onChange={(items) => setField("education", items)}
            createItem={() => ({ id: `edu-${Date.now()}`, school: "", degree: "", dates: "" })}
            addLabel="Add education"
            emptyLabel="No education added yet."
            renderFields={(item, update, isActive) => (
              <>
                <TextField value={item.school} onChange={(v) => update({ school: v })} placeholder="School" isActive={isActive} />
                <div className="flex gap-2">
                  <TextField
                    value={item.degree}
                    onChange={(v) => update({ degree: v })}
                    placeholder="Degree"
                    className="flex-1"
                    isActive={isActive}
                  />
                  <TextField
                    value={item.dates}
                    onChange={(v) => update({ dates: v })}
                    placeholder="2019–2022"
                    className="w-32 flex-none"
                    isActive={isActive}
                  />
                </div>
                <TextField
                  value={item.location ?? ""}
                  onChange={(v) => update({ location: v })}
                  placeholder="Location (optional)"
                  isActive={isActive}
                />
                <TextField
                  value={item.detail ?? ""}
                  onChange={(v) => update({ detail: v })}
                  placeholder="Detail (optional)"
                  isActive={isActive}
                />
              </>
            )}
          />
        </div>

        {/* Skills */}
        <div
          ref={(el) => {
            groupRefs.current.skills = el;
          }}
          className={cn("flex flex-col gap-2 p-1", flashClass("skills"))}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55 px-1">Skills</p>
          <SkillsEditor skills={content.skills} onChange={(skills) => setField("skills", skills)} />
        </div>

        {/* Projects */}
        <div
          ref={(el) => {
            groupRefs.current.projects = el;
          }}
          className={cn("flex flex-col gap-2 p-1", flashClass("projects"))}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55 px-1">Projects</p>
          <EntryListEditor<ResumeProjectEntry>
            items={content.projects}
            onChange={(items) => setField("projects", items)}
            createItem={() => ({ id: `proj-${Date.now()}`, name: "", detail: "" })}
            addLabel="Add a project"
            emptyLabel="No projects added yet."
            renderFields={(item, update, isActive) => (
              <>
                <TextField value={item.name} onChange={(v) => update({ name: v })} placeholder="Project name" isActive={isActive} />
                <TextAreaField
                  value={item.detail}
                  onChange={(v) => update({ detail: v })}
                  placeholder="What it does / your impact"
                  rows={2}
                  isActive={isActive}
                />
                <TextField value={item.link ?? ""} onChange={(v) => update({ link: v })} placeholder="Link (optional)" isActive={isActive} />
              </>
            )}
          />
        </div>

        {/* Certifications */}
        <div
          ref={(el) => {
            groupRefs.current.certifications = el;
          }}
          className={cn("flex flex-col gap-2 p-1", flashClass("certifications"))}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55 px-1">Certifications</p>
          <EntryListEditor<ResumeCertEntry>
            items={content.certifications}
            onChange={(items) => setField("certifications", items)}
            createItem={() => ({ id: `cert-${Date.now()}`, name: "" })}
            addLabel="Add certification"
            emptyLabel="No certifications added yet."
            renderFields={(item, update, isActive) => (
              <>
                <TextField value={item.name} onChange={(v) => update({ name: v })} placeholder="Certification name" isActive={isActive} />
                <div className="flex gap-2">
                  <TextField
                    value={item.issuer ?? ""}
                    onChange={(v) => update({ issuer: v })}
                    placeholder="Issuer (optional)"
                    className="flex-1"
                    isActive={isActive}
                  />
                  <TextField
                    value={item.year ?? ""}
                    onChange={(v) => update({ year: v })}
                    placeholder="Year"
                    className="w-20 flex-none"
                    isActive={isActive}
                  />
                </div>
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default ContentForm;
