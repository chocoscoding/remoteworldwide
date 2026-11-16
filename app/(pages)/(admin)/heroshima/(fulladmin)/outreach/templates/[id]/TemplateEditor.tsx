"use client";

import { useState, useTransition, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { archiveTemplate, createTemplate, duplicateTemplate, updateTemplate } from "@/libs/mail-admin";
import { EMPTY_CONTENT, type MailDesign, type MailTemplate, type TemplateInput } from "@/app/lib/mail/types";
import MailEditor from "@/app/components/mail/content/MailEditor";
import { pickContent } from "@/app/components/mail/content/blocks";
import { BTN, BTN_DANGER, BTN_PRIMARY, ErrorBox } from "@/app/components/mail/ui";

const inputOf = (t: MailTemplate | null): TemplateInput => (t ? { name: t.name, ...pickContent(t) } : { name: "", ...EMPTY_CONTENT });

/** One reusable mail: its name and save bar on top, then the content editor (the rendered mail is the canvas). */
const TemplateEditor: FC<{ template: MailTemplate | null; brandDesign: MailDesign | null }> = ({ template, brandDesign }) => {
  const router = useRouter();
  const [form, setForm] = useState<TemplateInput>(() => inputOf(template));
  const [saved, setSaved] = useState(() => JSON.stringify(inputOf(template)));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(form) !== saved;
  const { name, ...content } = form;

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.subject.trim()) {
      setError(!form.name.trim() ? "Give the mail a name (only admins see it)." : "Write a subject.");
      return;
    }
    start(async () => {
      setError(null);
      setNote(null);
      const res = template ? await updateTemplate(template.id, form) : await createTemplate(form);
      if (res.error || !res.data) {
        setError(res.error ?? "Not saved.");
        return;
      }
      setSaved(JSON.stringify(form));
      setNote("Saved.");
      if (!template) router.replace(`/heroshima/outreach/templates/${res.data.id}`);
      else router.refresh();
    });
  };

  const duplicate = () =>
    template &&
    start(async () => {
      const res = await duplicateTemplate(template.id);
      if (res.error || !res.data) setError(res.error ?? "Not duplicated.");
      else router.push(`/heroshima/outreach/templates/${res.data.id}`);
    });

  const archive = () =>
    template &&
    start(async () => {
      const res = await archiveTemplate(template.id);
      if (res.error) setError(res.error);
      else router.push("/heroshima/outreach/templates");
    });

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white/95 py-2 backdrop-blur">
        <label className="flex min-w-[260px] flex-1 items-center gap-2">
          <span className="whitespace-nowrap text-xs font-semibold text-gray-500">Name</span>
          <input
            value={name}
            maxLength={120}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Only admins see it"
            className="w-full max-w-md border-0 border-b border-transparent bg-transparent px-0 py-1 text-sm font-semibold hover:border-gray-300 focus:border-black focus:outline-none focus:ring-0"
            required
          />
        </label>
        {dirty ? <span className="text-xs text-gray-500">Unsaved changes</span> : note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
        {template ? (
          <>
            <button type="button" onClick={duplicate} disabled={busy} className={BTN}>
              Duplicate
            </button>
            {template.archived ? null : confirmArchive ? (
              <span className="flex items-center gap-1">
                <button type="button" onClick={archive} disabled={busy} className="rounded-md bg-[#b23c26] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                  Yes, archive
                </button>
                <button type="button" onClick={() => setConfirmArchive(false)} className="px-2 text-xs font-semibold text-gray-500">
                  Cancel
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmArchive(true)} className={BTN_DANGER}>
                Archive
              </button>
            )}
          </>
        ) : null}
        <button type="submit" disabled={busy || (!dirty && Boolean(template))} className={BTN_PRIMARY}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {template ? "Save" : "Create mail"}
        </button>
      </div>

      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <MailEditor content={content} onChange={(c) => setForm({ name, ...c })} brandDesign={brandDesign} underBar />
    </form>
  );
};

export default TemplateEditor;
