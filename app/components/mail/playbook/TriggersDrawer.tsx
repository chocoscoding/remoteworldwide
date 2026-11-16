"use client";

import { useState, useTransition, type FC } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Search } from "lucide-react";
import { archiveMailAction } from "@/libs/mail-admin";
import { ACTION_KIND_LABELS, type MailAction } from "@/app/lib/mail/types";
import { BTN, BTN_DANGER, BTN_LINK, Chip, ErrorBox, INPUT } from "@/app/components/mail/ui";
import { cn } from "@/lib/utils";
import Drawer from "./Drawer";
import TriggerForm from "./TriggerForm";
import { plural } from "./summary";

// The triggers (the "actions" the backend matches every 5 minutes) in a drawer: built-in ones read
// only, custom ones added, edited and archived here. The playbook editor opens it straight on the
// form ("+ New trigger") and gets the new trigger back to select it.

const matchText = (a: MailAction) => {
  if (a.key === "came_back") return "A visit after 14+ days away";
  const m = a.match ?? {};
  const parts = [m.kind ? (ACTION_KIND_LABELS[m.kind] ?? m.kind) : "Any kind"];
  if (m.pathPrefixes?.length) parts.push(`path starts ${m.pathPrefixes.join(" or ")}`);
  if (m.nameIncludes?.length) parts.push(`name has "${m.nameIncludes.join('" or "')}"`);
  return parts.join(" · ");
};

type View = { kind: "list" } | { kind: "form"; action: MailAction | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: MailAction[];
  /** "new" opens straight on an empty form (the editor's "+ New trigger"); closing the form closes the drawer. */
  start?: "list" | "new";
  /** How many playbooks use each trigger (as trigger, goal, entry rule or step), when known. */
  usage?: Record<string, number>;
  /** Called with a trigger once it is saved, before the page refreshes. */
  onSaved?: (action: MailAction, isNew: boolean) => void;
  /** The list couldn't be loaded: said instead of the list. */
  error?: string | null;
};

const TriggersDrawer: FC<Props> = ({ open, onOpenChange, actions, start = "list", usage, onSaved, error }) => (
  <Drawer open={open} onOpenChange={onOpenChange} title={start === "new" ? "New trigger" : "Triggers"} description="What people do on the site. Matched every 5 minutes.">
    {/* The drawer's content unmounts when it closes, so each opening starts on a fresh view. */}
    <TriggersBody actions={actions} start={start} usage={usage} onSaved={onSaved} loadError={error} close={() => onOpenChange(false)} />
  </Drawer>
);

const TriggersBody: FC<Omit<Props, "open" | "onOpenChange" | "error"> & { close: () => void; loadError?: string | null }> = ({ actions, start = "list", usage, onSaved, close, loadError }) => {
  const router = useRouter();
  const [view, setView] = useState<View>(start === "new" ? { kind: "form", action: null } : { kind: "list" });
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  if (view.kind === "form") {
    const backToList = start === "new" ? close : () => setView({ kind: "list" });
    return (
      <div className="flex flex-col gap-3">
        {start === "new" ? null : (
          <button type="button" onClick={backToList} className={`${BTN_LINK} inline-flex w-fit items-center gap-1`}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All triggers
          </button>
        )}
        {start === "new" ? null : <h3 className="text-sm font-bold">{view.action ? `Edit "${view.action.name}"` : "New trigger"}</h3>}
        <TriggerForm
          action={view.action}
          cancelLabel={start === "new" ? "Cancel" : "Back"}
          onCancel={backToList}
          onSaved={(saved) => {
            onSaved?.(saved, !view.action);
            router.refresh();
            if (start === "new") close();
            else setView({ kind: "list" });
          }}
        />
      </div>
    );
  }

  const shown = actions.filter((a) => !a.archived);
  const q = query.trim().toLowerCase();
  const matches = q ? shown.filter((a) => `${a.name} ${a.key}`.toLowerCase().includes(q)) : shown;
  const custom = matches.filter((a) => !a.builtIn);
  const builtIn = matches.filter((a) => a.builtIn);

  const archive = (id: string) =>
    startTransition(async () => {
      setError(null);
      const res = await archiveMailAction(id);
      setConfirming(null);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  const row = (a: MailAction) => {
    const used = usage?.[a.id] ?? 0;
    return (
      <li key={a.id} className="border-t border-gray-200 py-3 first:border-t-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              {a.name}
              {a.builtIn ? <Chip tone="outline">Built in</Chip> : null}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{matchText(a)}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              <span className="font-mono">{a.key}</span>
              {used ? ` · used by ${plural(used, "playbook")}` : ""}
            </p>
          </div>
          {a.builtIn ? null : confirming === a.id ? (
            <span className="flex flex-none flex-col items-end gap-1.5">
              <span className="text-xs text-gray-600">{used ? `Used by ${plural(used, "playbook")}. Archive?` : "Archive it?"}</span>
              <span className="flex gap-1.5">
                <button type="button" className={BTN_DANGER} onClick={() => archive(a.id)} disabled={busy}>
                  {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                  Yes, archive
                </button>
                <button type="button" className={BTN} onClick={() => setConfirming(null)} disabled={busy}>
                  Keep
                </button>
              </span>
            </span>
          ) : (
            <span className="flex flex-none gap-1.5">
              <button type="button" className={BTN} onClick={() => setView({ kind: "form", action: a })} disabled={busy}>
                Edit
              </button>
              <button type="button" className={BTN_DANGER} onClick={() => setConfirming(a.id)} disabled={busy}>
                Archive
              </button>
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setView({ kind: "form", action: null })} className={BTN}>
          + New trigger
        </button>
        {shown.length > 8 ? (
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search triggers</span>
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
            <input type="search" className={cn(INPUT, "pl-7")} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search triggers" />
          </label>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[#b23c26]">
          {error}
        </p>
      ) : null}
      {loadError ? (
        <ErrorBox>The triggers couldn&apos;t be loaded: {loadError}</ErrorBox>
      ) : !shown.length ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No triggers yet. The starter set adds the built-in ones.</p>
      ) : !matches.length ? (
        <p className="py-6 text-center text-sm text-gray-500">No trigger matches &quot;{query.trim()}&quot;.</p>
      ) : (
        <>
          {custom.length ? (
            <section>
              <h3 className="mb-1 text-xs font-semibold text-gray-500">Yours ({custom.length})</h3>
              <ul>{custom.map(row)}</ul>
            </section>
          ) : null}
          {builtIn.length ? (
            <section>
              <h3 className="mb-1 text-xs font-semibold text-gray-500">Built in ({builtIn.length}), read only</h3>
              <ul>{builtIn.map(row)}</ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
};

export default TriggersDrawer;
