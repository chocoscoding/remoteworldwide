"use client";

import { useState, useTransition, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { archiveMailAction, createMailAction, updateMailAction } from "@/libs/mail-admin";
import { ACTION_KINDS, ACTION_KIND_LABELS, type ActionInput, type ActionKind, type MailAction } from "@/app/lib/mail/types";
import ListInput from "@/app/components/mail/ListInput";
import { BTN, BTN_DANGER, BTN_PRIMARY, Chip, Empty, ErrorBox, Field, INPUT, ROW, TABLE, TD, TH } from "@/app/components/mail/ui";
import { slugify } from "@/app/components/mail/format";

const EMPTY: ActionInput = { name: "", key: "", match: { kind: "page_view", pathPrefixes: [], nameIncludes: [] } };

const matchText = (a: MailAction) => {
  const m = a.match ?? {};
  const parts = [m.kind ? ACTION_KIND_LABELS[m.kind] ?? m.kind : "Any kind"];
  if (m.pathPrefixes?.length) parts.push(`path starts ${m.pathPrefixes.join(" or ")}`);
  if (m.nameIncludes?.length) parts.push(`name has "${m.nameIncludes.join('" or "')}"`);
  return parts.join(" · ");
};

/** The actions list: built-in ones are read only; custom ones can be added, edited and archived. */
const ActionsPanel: FC<{ actions: MailAction[] }> = ({ actions }) => {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<ActionInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const shown = actions.filter((a) => !a.archived);

  const open = (a: MailAction | null) => {
    setError(null);
    setEditing(a ? a.id : "new");
    setForm(a ? { name: a.name, key: a.key, match: { kind: a.match?.kind, pathPrefixes: a.match?.pathPrefixes ?? [], nameIncludes: a.match?.nameIncludes ?? [] } } : EMPTY);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
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
      const res = editing && editing !== "new" ? await updateMailAction(editing, input) : await createMailAction(input);
      if (res.error) {
        setError(res.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  };

  const archive = (id: string) =>
    start(async () => {
      const res = await archiveMailAction(id);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {shown.length ? (
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Action</th>
                <th className={TH}>Matches</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id} className={ROW}>
                  <td className={TD}>
                    <span className="font-semibold">{a.name}</span> <span className="font-mono text-xs text-gray-500">{a.key}</span>{" "}
                    {a.builtIn ? <Chip tone="outline">built in</Chip> : null}
                  </td>
                  <td className={`${TD} text-gray-600`}>{a.key === "came_back" ? "A visit after 14+ days away" : matchText(a)}</td>
                  <td className={`${TD} whitespace-nowrap text-right`}>
                    {a.builtIn ? null : (
                      <span className="flex justify-end gap-2">
                        <button type="button" className={BTN} onClick={() => open(a)} disabled={busy}>
                          Edit
                        </button>
                        <button type="button" className={BTN_DANGER} onClick={() => archive(a.id)} disabled={busy}>
                          Archive
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No actions yet. The starter set adds the built-in ones.</Empty>
      )}

      {editing ? (
        <form key={editing} onSubmit={save} className="grid gap-3 rounded-md border border-black p-4 md:grid-cols-2">
          <h3 className="text-sm font-bold md:col-span-2">{editing === "new" ? "New action" : "Edit action"}</h3>
          <Field label="Name">
            <input className={INPUT} value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Wrote a cover letter" />
          </Field>
          <Field label="Key (empty: from the name)">
            <input className={`${INPUT} font-mono`} value={form.key ?? ""} maxLength={60} disabled={editing !== "new"} onChange={(e) => setForm({ ...form, key: e.target.value })} />
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
          <Field label="Path starts with (comma separated)">
            <ListInput value={form.match.pathPrefixes} onChange={(v) => setForm((f) => ({ ...f, match: { ...f.match, pathPrefixes: v } }))} placeholder="/dashboard/cover-letters" />
          </Field>
          <Field label="Name includes, any case (comma separated)" className="md:col-span-2">
            <ListInput value={form.match.nameIncludes} onChange={(v) => setForm((f) => ({ ...f, match: { ...f.match, nameIncludes: v } }))} placeholder="POST /api/cover-letters, write letter" />
          </Field>
          {error ? <ErrorBox className="md:col-span-2">{error}</ErrorBox> : null}
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" disabled={busy} className={BTN_PRIMARY}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save action
            </button>
            <button type="button" onClick={() => setEditing(null)} className={BTN}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => open(null)} className={BTN}>
            New action
          </button>
          {error ? (
            <span role="alert" className="text-xs text-[#b23c26]">
              {error}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ActionsPanel;
