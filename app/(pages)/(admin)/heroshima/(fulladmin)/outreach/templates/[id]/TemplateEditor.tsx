"use client";

import { useState, useTransition, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { archiveTemplate, createTemplate, duplicateTemplate, updateTemplate } from "@/libs/mail-admin";
import { EMPTY_CONTENT, type MailTemplate, type TemplateInput } from "@/app/lib/mail/types";
import ContentFields from "@/app/components/mail/ContentFields";
import MailPreview from "@/app/components/mail/MailPreview";
import { BTN, BTN_DANGER, BTN_PRIMARY, ErrorBox, Field, INPUT } from "@/app/components/mail/ui";

const inputOf = (t: MailTemplate | null): TemplateInput =>
  t
    ? { name: t.name, subject: t.subject, preview: t.preview, blocks: t.blocks ?? [], sender: t.sender, pref: t.pref, feedbackFooter: Boolean(t.feedbackFooter) }
    : { name: "", ...EMPTY_CONTENT };

/** The template editor: content on the left, the live preview and test send on the right. */
const TemplateEditor: FC<{ template: MailTemplate | null }> = ({ template }) => {
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
      setError("A name and a subject are needed.");
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,720px)]">
      <form onSubmit={save} className="flex min-w-0 flex-col gap-4">
        <div className="rounded-md border border-gray-300 bg-white p-4">
          <Field label="Name (only admins see it)">
            <input className={INPUT} value={name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
        </div>
        <div className="rounded-md border border-gray-300 bg-white p-4">
          <ContentFields content={content} onChange={(c) => setForm({ name, ...c })} />
        </div>

        {error ? <ErrorBox>{error}</ErrorBox> : null}

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-gray-300 bg-white/95 py-3">
          <button type="submit" disabled={busy || (!dirty && Boolean(template))} className={BTN_PRIMARY}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {template ? "Save" : "Create template"}
          </button>
          {dirty ? <span className="text-xs text-gray-500">Unsaved changes</span> : note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
          {template ? (
            <span className="ml-auto flex items-center gap-2">
              <button type="button" onClick={duplicate} disabled={busy} className={BTN}>
                Duplicate
              </button>
              {template.archived ? null : confirmArchive ? (
                <>
                  <button type="button" onClick={archive} disabled={busy} className="rounded-md bg-[#b23c26] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                    Yes, archive
                  </button>
                  <button type="button" onClick={() => setConfirmArchive(false)} className="px-2 text-xs font-semibold text-gray-500">
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmArchive(true)} className={BTN_DANGER}>
                  Archive
                </button>
              )}
            </span>
          ) : null}
        </div>
      </form>

      <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
        <MailPreview content={content} />
      </div>
    </div>
  );
};

export default TemplateEditor;
