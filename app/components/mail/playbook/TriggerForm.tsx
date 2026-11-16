"use client";

import { useState, useTransition, type FC, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { createMailAction, updateMailAction } from "@/libs/mail-admin";
import { ACTION_KINDS, ACTION_KIND_LABELS, type ActionInput, type ActionKind, type MailAction } from "@/app/lib/mail/types";
import ListInput from "@/app/components/mail/ListInput";
import { BTN, BTN_PRIMARY, ErrorBox, Field, INPUT } from "@/app/components/mail/ui";
import { slugify } from "@/app/components/mail/format";

const EMPTY: ActionInput = { name: "", key: "", match: { kind: "page_view", pathPrefixes: [], nameIncludes: [] } };

const inputOf = (a: MailAction | null): ActionInput =>
  a ? { name: a.name, key: a.key, match: { kind: a.match?.kind, pathPrefixes: a.match?.pathPrefixes ?? [], nameIncludes: a.match?.nameIncludes ?? [] } } : EMPTY;

/**
 * Add or edit a custom trigger (an action people take on the site). On save it hands back the
 * saved trigger. It sits in a portalled drawer, possibly inside the playbook editor's form, so its
 * submit stops here instead of bubbling (through React) into that form's Save.
 */
const TriggerForm: FC<{ action: MailAction | null; onSaved: (action: MailAction) => void; onCancel: () => void; cancelLabel?: string }> = ({
  action,
  onSaved,
  onCancel,
  cancelLabel = "Cancel",
}) => {
  const [form, setForm] = useState<ActionInput>(() => inputOf(action));
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const isNew = !action;

  const save = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!form.name.trim()) {
      setError("Give it a name.");
      return;
    }
    if (!form.match.pathPrefixes?.length && !form.match.nameIncludes?.length) {
      setError("Add a path or a name to match.");
      return;
    }
    start(async () => {
      setError(null);
      const input: ActionInput = { ...form, name: form.name.trim(), key: form.key?.trim() || slugify(form.name).replace(/-/g, "_") };
      const res = action ? await updateMailAction(action.id, input) : await createMailAction(input);
      if (res.error) {
        setError(res.error);
        return;
      }
      // The backend answers with the saved trigger; an older one may answer without it.
      const saved: MailAction = res.data && typeof res.data === "object" && "id" in res.data ? res.data : { ...(action ?? { id: "", builtIn: false, archived: false }), key: input.key ?? "", name: input.name, match: input.match };
      onSaved(saved);
    });
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3" aria-label={isNew ? "New trigger" : "Edit trigger"}>
      <Field label="Name" hint="What they did, as people would say it.">
        <input className={INPUT} value={form.name} maxLength={80} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Wrote a cover letter" />
      </Field>
      <Field label="Kind">
        <select className={INPUT} value={form.match.kind ?? ""} onChange={(e) => setForm({ ...form, match: { ...form.match, kind: (e.target.value || undefined) as ActionKind | undefined } })}>
          <option value="">Any</option>
          {ACTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {ACTION_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Path starts with" hint="Comma separated.">
        <ListInput value={form.match.pathPrefixes} onChange={(v) => setForm((f) => ({ ...f, match: { ...f.match, pathPrefixes: v } }))} placeholder="/dashboard/cover-letters" />
      </Field>
      <Field label="Name includes, any case" hint="Comma separated. A path or a name is enough.">
        <ListInput value={form.match.nameIncludes} onChange={(v) => setForm((f) => ({ ...f, match: { ...f.match, nameIncludes: v } }))} placeholder="POST /api/cover-letters, write letter" />
      </Field>
      <details className="group">
        <summary className="inline-block cursor-pointer select-none text-xs font-semibold text-gray-500 hover:text-black">Advanced</summary>
        <div className="mt-2">
          <Field label={isNew ? "Key (empty: from the name)" : "Key (fixed once made)"}>
            <input className={`${INPUT} font-mono`} value={form.key ?? ""} maxLength={60} disabled={!isNew} onChange={(e) => setForm({ ...form, key: e.target.value })} />
          </Field>
        </div>
      </details>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" disabled={busy} className={BTN_PRIMARY}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {isNew ? "Save trigger" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel} className={BTN} disabled={busy}>
          {cancelLabel}
        </button>
      </div>
    </form>
  );
};

export default TriggerForm;
