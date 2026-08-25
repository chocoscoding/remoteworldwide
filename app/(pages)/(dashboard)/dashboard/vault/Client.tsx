"use client";

import { FC, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, File, FileText, Linkedin, Paperclip, Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import { ATS_RESUMES } from "@/app/lib/dashboard/mock-data";

// ---------------------------------------------------------------------------
// Local content — only used on this screen, so kept here rather than in
// mock-data.ts (mirrors the convention already used by the Home screen's
// DEFAULT_HABITS / NEXT_ACTIONS).
// ---------------------------------------------------------------------------

interface FactRow {
  id: string;
  label: string;
  value: string;
  hint: string;
}

const INITIAL_FACTS: FactRow[] = [
  {
    id: "work-history",
    label: "Work history",
    value: "4 roles",
    hint: "Feeds the Experience section on every resume you generate.",
  },
  {
    id: "achievements",
    label: "Achievements",
    value: "11 saved",
    hint: "Quantified bullets you can drop into any resume or cover letter.",
  },
  {
    id: "work-preferences",
    label: "Work preferences",
    value: "Remote worldwide · GMT+1 · $70–95k · full-time",
    hint: "Used to auto-answer salary and availability screening questions.",
  },
  {
    id: "certifications",
    label: "Certifications",
    value: "",
    hint: "Nothing saved yet — adding one strengthens ATS keyword match.",
  },
];

const MISSING_PROFILE_ITEMS = ["Add a certification", "Verify your phone number", "Link a second portfolio sample"];

// Resume accent-color swatches from the design spec, mapped per resume id.
// Written as literal `bg-[#hex]` Tailwind classes (not inline styles) so
// they're picked up by Tailwind's static build-time scan.
const RESUME_ACCENT_CLASSES: Record<string, string> = {
  "res-master": "bg-[#222325]",
  "res-linear": "bg-[#3a4a7a]",
  "res-deel": "bg-[#2f5d50]",
};

const RESUME_DESCRIPTIONS: Record<string, string> = {
  "res-master": "Your default, general-purpose resume.",
  "res-linear": "Tailored for Linear — Senior Product Designer.",
  "res-deel": "Tailored for Deel — Senior Designer.",
};

// Master resume / Linear / Deel — the archived "2023 resume (imported)" row
// doesn't belong in this grid.
const VAULT_RESUMES = ATS_RESUMES.filter((r) => !r.archived);

// ---------------------------------------------------------------------------
// Generic documents — anything that isn't a tailored resume (IDs, portfolio
// files, certificates, ...). Deliberately untyped/mock: local state only, no
// upload plumbing. Kept distinct from the Resumes grid above both in data
// shape and in card styling (neutral icon tile vs. the resumes' colored
// accent squares).
// ---------------------------------------------------------------------------

type DocumentKind = "pdf" | "doc" | "other";

interface VaultDocument {
  id: string;
  name: string;
  kind: DocumentKind;
}

const DOCUMENT_ICONS: Record<DocumentKind, typeof FileText> = {
  pdf: FileText,
  doc: File,
  other: Paperclip,
};

const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  pdf: "PDF",
  doc: "Document",
  other: "Attachment",
};

const INITIAL_DOCUMENTS: VaultDocument[] = [
  { id: "doc-passport", name: "Passport scan.pdf", kind: "pdf" },
  { id: "doc-portfolio", name: "Portfolio one-pager.doc", kind: "doc" },
];

const VaultClient: FC = () => {
  const [facts, setFacts] = useState<FactRow[]>(INITIAL_FACTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  const [documents, setDocuments] = useState<VaultDocument[]>(INITIAL_DOCUMENTS);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docDraft, setDocDraft] = useState("");

  const startEdit = (row: FactRow) => {
    setEditingId(row.id);
    setDraft(row.value);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
  };

  const saveEdit = (id: string) => {
    setFacts((prev) => prev.map((f) => (f.id === id ? { ...f, value: draft.trim() } : f)));
    setEditingId(null);
    setDraft("");
  };

  const startDocEdit = (doc: VaultDocument) => {
    setEditingDocId(doc.id);
    setDocDraft(doc.name);
  };

  const cancelDocEdit = () => {
    setEditingDocId(null);
    setDocDraft("");
  };

  const saveDocEdit = (id: string) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, name: docDraft.trim() || d.name } : d)));
    setEditingDocId(null);
    setDocDraft("");
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (editingDocId === id) cancelDocEdit();
  };

  // Mock "add/import a document" action — generic, unlike the resume-specific
  // "New resume" / "Import from LinkedIn" actions in the header. Appends a
  // placeholder entry and drops straight into rename mode so the user can
  // name it immediately.
  const addDocument = () => {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setDocuments((prev) => [...prev, { id, name: "Untitled document", kind: "other" }]);
    setEditingDocId(id);
    setDocDraft("Untitled document");
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">My documents</h1>
        <div className="flex items-center gap-3 flex-none">
          <StickerButton variant="outline" size="md" onClick={() => {}}>
            <Linkedin className="h-4 w-4" />
            Import from LinkedIn
          </StickerButton>
          <Link href="/dashboard/resume">
            <StickerButton variant="primary" size="md">
              <Plus className="h-4 w-4" />
              New resume
            </StickerButton>
          </Link>
        </div>
      </header>

      <main className="px-8 py-7 pb-14 max-w-[1100px] mx-auto">
        {/* Profile-completeness banner */}
        <DashCard className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1.5">
                <p className="text-[15px] font-bold text-primary">Your profile is 82% complete</p>
                <Pill variant="neutral">82%</Pill>
              </div>
              <p className="text-xs text-black/45 mb-3">
                A complete profile auto-fills more of every application and scores higher against the ATS.
              </p>
              <ProgressBar value={82} className="max-w-md" />
            </div>
            <StickerButton variant="outline" size="md" className="flex-none" onClick={() => setProfileOpen((v) => !v)}>
              {profileOpen ? "Hide" : "Finish profile"}
            </StickerButton>
          </div>

          <div
            className={cn(
              "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
              profileOpen ? "max-h-60 opacity-100 mt-5 pt-5 border-t border-black/8" : "max-h-0 opacity-0"
            )}>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40 mb-2.5">
              {MISSING_PROFILE_ITEMS.length} things left
            </p>
            <div className="flex flex-col gap-1">
              {MISSING_PROFILE_ITEMS.map((item) => (
                <div key={item} className="flex items-center gap-2.5 px-1 py-1.5">
                  <span className="h-4 w-4 flex-none rounded-full border border-black/25" />
                  <span className="text-sm text-black/65">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </DashCard>

        {/* Resumes grid */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-[15px] font-bold text-primary">Resumes</h2>
            <span className="text-xs text-black/45">{VAULT_RESUMES.length} saved</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {VAULT_RESUMES.map((r) => {
              const accentClass = RESUME_ACCENT_CLASSES[r.id] ?? "bg-[#222325]";
              const description = RESUME_DESCRIPTIONS[r.id] ?? "";
              const showScore = r.jdScore != null;

              return (
                <Link
                  key={r.id}
                  href="/dashboard/resume"
                  className="group flex flex-col bg-white rounded-2xl border border-black/10 p-5 min-h-[168px] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_#e1f073] cursor-pointer">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-4", accentClass)}>
                    <FileText className="h-4 w-4 text-white" />
                  </div>

                  <p className="text-sm font-bold text-primary mb-1">{r.name}</p>
                  <p className="text-xs text-black/45 leading-relaxed flex-1">{description}</p>

                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-black/8">
                    {showScore ? (
                      <Pill variant="positive">Score {r.jdScore}</Pill>
                    ) : (
                      <span className="text-xs text-black/40">General score {r.generalScore}</span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Open
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              );
            })}

            {/* Add-tile */}
            <Link
              href="/dashboard/apply"
              className="group flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-black/15 p-5 min-h-[168px] text-black/40 hover:border-black/35 hover:text-black/60 transition-colors cursor-pointer">
              <span className="h-9 w-9 rounded-lg border-2 border-dashed border-black/20 flex items-center justify-center group-hover:border-black/35 transition-colors">
                <Plus className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-center">Tailor to a new job</span>
            </Link>
          </div>
        </section>

        {/* Generic documents — anything beyond a tailored resume */}
        <section className="mb-8">
          <div className="mb-3.5">
            <h2 className="text-[15px] font-bold text-primary">Your documents</h2>
            <p className="text-xs text-black/45 mt-1">
              IDs, portfolios, certificates — anything else you want on hand when applying.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {documents.map((doc) => {
              const Icon = DOCUMENT_ICONS[doc.kind];
              const isEditing = editingDocId === doc.id;

              return (
                <div
                  key={doc.id}
                  className="flex flex-col bg-[#fbfbf9] rounded-xl border border-black/10 p-5 min-h-[168px]">
                  <div className="h-9 w-9 rounded-lg bg-black/6 flex items-center justify-center mb-4">
                    <Icon className="h-4 w-4 text-black/55" />
                  </div>

                  {isEditing ? (
                    <div className="flex flex-col gap-2.5 flex-1">
                      <input
                        value={docDraft}
                        onChange={(e) => setDocDraft(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveDocEdit(doc.id);
                          if (e.key === "Escape") cancelDocEdit();
                        }}
                        placeholder="Name this document…"
                        className="w-full h-9 rounded-lg border border-black/15 bg-white px-3 text-sm text-primary placeholder:text-black/35 focus:outline-none focus:border-black/35 transition-colors"
                      />
                      <div className="flex items-center gap-2">
                        <StickerButton variant="primary" size="sm" onClick={() => saveDocEdit(doc.id)}>
                          <Check className="h-3.5 w-3.5" />
                          Save
                        </StickerButton>
                        <StickerButton variant="outline" size="sm" onClick={cancelDocEdit}>
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </StickerButton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-primary mb-1 truncate">{doc.name}</p>
                      <p className="text-xs text-black/45 flex-1">{DOCUMENT_KIND_LABELS[doc.kind]}</p>
                      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-black/8">
                        <button
                          type="button"
                          onClick={() => startDocEdit(doc)}
                          className="text-xs font-semibold text-black/45 hover:text-primary transition-colors cursor-pointer">
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDocument(doc.id)}
                          className="text-xs font-semibold text-black/45 hover:text-red-600 transition-colors cursor-pointer">
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Add-tile — generic "add/import a document" action, distinct from
               the resume-specific actions in the header above. */}
            <button
              type="button"
              onClick={addDocument}
              className="group flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-black/15 p-5 min-h-[168px] text-black/40 hover:border-black/35 hover:text-black/60 transition-colors cursor-pointer">
              <span className="h-9 w-9 rounded-lg border-2 border-dashed border-black/20 flex items-center justify-center group-hover:border-black/35 transition-colors">
                <Plus className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-center">Add a document</span>
            </button>
          </div>
        </section>

        {/* "Your facts, reused everywhere" table */}
        <section>
          <div className="mb-3.5">
            <h2 className="text-[15px] font-bold text-primary">Your facts, reused everywhere</h2>
            <p className="text-xs text-black/45 mt-1">
              Saved once, then reused across every resume, cover letter and application answer.
            </p>
          </div>

          <DashCard className="p-0 overflow-hidden">
            <div className="flex flex-col divide-y divide-black/8">
              {facts.map((row) => {
                const isEditing = editingId === row.id;
                const action = row.value ? "Edit" : "Add";

                return (
                  <div key={row.id} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-primary">{row.label}</p>
                        {!isEditing &&
                          (row.value ? (
                            <p className="text-sm text-black/60 mt-0.5">{row.value}</p>
                          ) : (
                            <p className="text-sm text-black/35 italic mt-0.5">Nothing saved yet</p>
                          ))}
                        {!isEditing && <p className="text-xs text-black/40 mt-1.5">{row.hint}</p>}
                      </div>

                      {!isEditing && (
                        <StickerButton variant="outline" size="sm" className="flex-none" onClick={() => startEdit(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                          {action}
                        </StickerButton>
                      )}
                    </div>

                    {isEditing && (
                      <div className="mt-3.5 flex flex-col gap-2.5">
                        <div className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-[#6c7a1e]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#6c7a1e] animate-pulse" />
                          Editing…
                        </div>
                        <input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          autoFocus
                          placeholder={`Add ${row.label.toLowerCase()}…`}
                          className="w-full h-10 rounded-lg border border-black/15 bg-[#fbfbf7] px-3.5 text-sm text-primary placeholder:text-black/35 focus:outline-none focus:border-black/35 transition-colors"
                        />
                        <div className="flex items-center gap-2">
                          <StickerButton variant="primary" size="sm" onClick={() => saveEdit(row.id)}>
                            <Check className="h-3.5 w-3.5" />
                            Save
                          </StickerButton>
                          <StickerButton variant="outline" size="sm" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </StickerButton>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </DashCard>
        </section>
      </main>
    </div>
  );
};

export default VaultClient;
