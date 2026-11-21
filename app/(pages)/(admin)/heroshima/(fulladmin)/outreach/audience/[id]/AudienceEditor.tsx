"use client";

import { useMemo, useState, useTransition, type FC } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { createAudience, deleteAudience, updateAudience } from "@/libs/mail-admin";
import { AUDIENCE_PICK_MAX, type AudienceFilter, type AudiencePerson, type MailAudience } from "@/app/lib/mail/types";
import AudienceFilterEditor from "@/app/components/mail/AudienceFilterEditor";
import PeopleTable, { START_VIEW, type PeopleActions, type PeopleView } from "@/app/components/mail/audience/PeopleTable";
import AddPeopleDrawer from "@/app/components/mail/audience/AddPeopleDrawer";
import { useAudiencePeople } from "@/app/components/mail/audience/useAudiencePeople";
import { AUDIENCE_HREF, UNTITLED_AUDIENCE, filterToSave } from "@/app/components/mail/audience/filterText";
import { BTN_DANGER, BTN_PRIMARY, ErrorBox } from "@/app/components/mail/ui";
import { n } from "@/app/components/mail/format";

/** The saved form of the editor, to tell unsaved changes. */
const keyOf = (name: string, filter: AudienceFilter) => JSON.stringify([name.trim(), filterToSave(filter)]);

/**
 * One saved audience: the name as the title, the filters as chips, and the people table as the body.
 * People picked in the table can be removed (a match goes to excludeIds, an added person leaves
 * includeIds) and put back from the removed list (out of excludeIds); Add people finds anyone else and
 * puts them in includeIds. Save and Delete sit at the foot of the page.
 */
const AudienceEditor: FC<{
  audience: MailAudience | null;
  /** A new audience started from another one ("Duplicate as a new audience"). */
  seed?: { name: string; filter: AudienceFilter } | null;
  campaigns: Array<{ id: string; name: string }>;
}> = ({ audience, seed, campaigns }) => {
  const router = useRouter();
  const first = audience ? { name: audience.name, filter: audience.filter ?? { kind: "users" as const } } : (seed ?? { name: "", filter: { kind: "users" as const } });
  const [name, setName] = useState(first.name);
  const [filter, setFilter] = useState<AudienceFilter>(first.filter);
  // A new audience has nothing saved yet, so it can always be created.
  const [saved, setSaved] = useState<string | null>(() => (audience ? keyOf(first.name, first.filter) : null));
  const [view, setView] = useState<PeopleView>(START_VIEW);
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, start] = useTransition();

  const sent = filterToSave(filter);
  const people = useAudiencePeople({ filter: sent, page: view.page, pageSize: view.pageSize, q: view.q, scope: view.scope });
  const dirty = saved === null || keyOf(name, filter) !== saved;

  const include = useMemo(() => new Set(filter.includeIds ?? []), [filter.includeIds]);
  const exclude = useMemo(() => new Set(filter.excludeIds ?? []), [filter.excludeIds]);
  const pickOnly = Boolean(filter.pickOnly);

  /** The id a pick stores: the account for "users", the subscriber for "subscribers". */
  const idOf = (row: AudiencePerson) => (filter.kind === "users" ? (row.userId ?? row.id) : (row.subscriberId ?? row.id));
  /** Whether the filters match this row, as of the last answer (a removed row is a match taken out by hand). */
  const matches = (row: AudiencePerson) => row.how === "filter" || row.how === "removed";

  /** Applies a change to the hand picks, within the 5,000 limit each. */
  const changePicks = (change: (inc: Set<string>, exc: Set<string>) => void) => {
    const inc = new Set(include);
    const exc = new Set(exclude);
    change(inc, exc);
    if (inc.size > AUDIENCE_PICK_MAX || exc.size > AUDIENCE_PICK_MAX) {
      setProblem(`At most ${n(AUDIENCE_PICK_MAX)} people can be ${inc.size > AUDIENCE_PICK_MAX ? "added" : "removed"} by hand.`);
      return;
    }
    setProblem(null);
    setNote(null);
    setFilter((f) => ({ ...f, includeIds: [...inc], excludeIds: [...exc] }));
  };

  const actions: PeopleActions = {
    // A match is kept out with excludeIds; someone added by hand just leaves includeIds.
    remove: (rows) =>
      changePicks((inc, exc) => {
        for (const row of rows) {
          const id = idOf(row);
          inc.delete(id);
          if (!pickOnly && matches(row)) exc.add(id);
        }
      }),
    putBack: (rows) =>
      changePicks((_inc, exc) => {
        for (const row of rows) exc.delete(idOf(row));
      }),
    add: () => setAdding(true),
  };

  // From the drawer: a removed match only needs putting back; anyone else is added by hand.
  const addPeople = (rows: AudiencePerson[]) =>
    changePicks((inc, exc) => {
      for (const row of rows) {
        const id = idOf(row);
        exc.delete(id);
        if (pickOnly || !matches(row)) inc.add(id);
      }
    });

  const changeFilter = (next: AudienceFilter) => {
    setProblem(null);
    setNote(null);
    setFilter(next);
    setView((v) => ({ ...v, page: 1, scope: "audience" }));
  };

  const save = () =>
    start(async () => {
      setError(null);
      setNote(null);
      const input = { name: name.trim() || UNTITLED_AUDIENCE, filter: filterToSave(filter) };
      const res = audience ? await updateAudience(audience.id, input) : await createAudience(input);
      if (res.error || !res.data) {
        setError(res.error ?? "Not saved.");
        return;
      }
      setSaved(keyOf(name, filter));
      setNote("Saved.");
      if (!audience) router.replace(`${AUDIENCE_HREF}/${res.data.id}`);
      else router.refresh();
    });

  const remove = () =>
    audience &&
    start(async () => {
      const res = await deleteAudience(audience.id);
      if (res.error) setError(res.error);
      else router.push(AUDIENCE_HREF);
    });

  return (
    <div className="flex flex-col gap-5">
      <header className="min-w-0">
        <h1 className="sr-only">{audience?.name || name.trim() || UNTITLED_AUDIENCE}</h1>
        <input
          aria-label="Audience name"
          value={name}
          maxLength={120}
          placeholder={UNTITLED_AUDIENCE}
          onChange={(e) => {
            setName(e.target.value);
            setNote(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) save();
          }}
          className="-mx-1.5 w-full max-w-2xl rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-2xl font-bold placeholder:text-gray-400 hover:border-gray-300 focus:border-black focus:outline-none"
        />
      </header>

      <AudienceFilterEditor filter={filter} onChange={changeFilter} campaigns={campaigns} />

      <PeopleTable people={people} view={view} onView={setView} kind={filter.kind} pickOnly={pickOnly} actions={actions} problem={problem} />

      <AddPeopleDrawer open={adding} onOpenChange={setAdding} filter={sent} onAdd={addPeople} />

      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-gray-300 bg-white/95 py-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className={BTN_PRIMARY}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {audience ? "Save" : "Create audience"}
        </button>
        {dirty && audience ? <span className="text-xs text-gray-500">Unsaved changes</span> : note ? <span className="text-xs text-[#5b6b12]">{note}</span> : null}
        {audience ? (
          <span className="ml-auto flex flex-wrap items-center gap-2">
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
                Delete audience
              </button>
            )}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default AudienceEditor;
