"use client";

import { useState, useTransition, type FC, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { createAudience, deleteAudience, updateAudience } from "@/libs/mail-admin";
import type { AudienceFilter, MailAudience } from "@/app/lib/mail/types";
import AudienceFilterEditor from "@/app/components/mail/AudienceFilterEditor";
import { useAudienceCount } from "@/app/components/mail/useAudienceCount";
import { BTN_DANGER, BTN_PRIMARY, ErrorBox, Field, INPUT } from "@/app/components/mail/ui";
import { cleanFilter, n } from "@/app/components/mail/format";

/** Name, filter, live count and sample, save and delete. */
const AudienceEditor: FC<{ audience: MailAudience | null; campaigns: Array<{ id: string; name: string }> }> = ({ audience, campaigns }) => {
  const router = useRouter();
  const [name, setName] = useState(audience?.name ?? "");
  const [filter, setFilter] = useState<AudienceFilter>(audience?.filter ?? { kind: "users" });
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, start] = useTransition();
  const live = useAudienceCount(filter);

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give it a name.");
      return;
    }
    start(async () => {
      setError(null);
      setNote(null);
      const input = { name: name.trim(), filter: cleanFilter(filter) };
      const res = audience ? await updateAudience(audience.id, input) : await createAudience(input);
      if (res.error || !res.data) {
        setError(res.error ?? "Not saved.");
        return;
      }
      setNote("Saved.");
      if (!audience) router.replace(`/heroshima/outreach/audience/${res.data.id}`);
      else router.refresh();
    });
  };

  const remove = () =>
    audience &&
    start(async () => {
      const res = await deleteAudience(audience.id);
      if (res.error) setError(res.error);
      else router.push("/heroshima/outreach/audience");
    });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <form onSubmit={save} className="flex min-w-0 flex-col gap-4">
        <div className="rounded-md border border-gray-300 bg-white p-4">
          <Field label="Name">
            <input className={INPUT} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Inactive 14 days" required />
          </Field>
        </div>
        <AudienceFilterEditor filter={filter} onChange={setFilter} campaigns={campaigns} />
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {audience ? "Save" : "Create audience"}
          </button>
          {note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
          {audience ? (
            <span className="ml-auto flex items-center gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-xs text-gray-600">Campaigns and playbooks using it stop finding people.</span>
                  <button type="button" onClick={remove} disabled={busy} className="rounded-md bg-[#b23c26] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                    Yes, delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="px-2 text-xs font-semibold text-gray-500">
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className={BTN_DANGER}>
                  Delete
                </button>
              )}
            </span>
          ) : null}
        </div>
      </form>

      <aside aria-label="Who it reaches" className="flex flex-col gap-3 self-start rounded-md border border-black bg-white p-4 xl:sticky xl:top-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold">Reaches now</h2>
          {live.loading ? <LoaderCircle className="h-4 w-4 animate-spin text-gray-500" aria-label="Counting" /> : null}
        </div>
        {live.error ? (
          <ErrorBox>{live.error}</ErrorBox>
        ) : (
          <p className="text-3xl font-bold tabular-nums">{live.data ? n(live.data.count) : "..."}</p>
        )}
        <p className="text-xs text-gray-500">People who can get mail today. Caps and quiet hours apply at send time.</p>
        {live.data?.sample.length ? (
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-500">A sample of {live.data.sample.length}</p>
            <ul className="flex flex-col text-sm">
              {live.data.sample.map((p) => (
                <li key={p.id} className="truncate border-t border-gray-100 py-1.5">
                  {p.userId ? (
                    <Link href={`/heroshima/users/${p.userId}`} className="hover:underline">
                      {p.name ? `${p.name} · ` : ""}
                      {p.email}
                    </Link>
                  ) : (
                    <span>{p.email}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : live.data ? (
          <p className="text-sm text-gray-500">Nobody matches yet.</p>
        ) : null}
      </aside>
    </div>
  );
};

export default AudienceEditor;
