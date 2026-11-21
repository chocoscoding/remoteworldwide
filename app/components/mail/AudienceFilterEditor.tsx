"use client";

import { useCallback, useMemo, useState, type FC } from "react";
import { Hand, Plus, X } from "lucide-react";
import type { AudienceFilter } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import { Segmented } from "./ui";
import { FILTER_DEFS, activeDefs, defOf, isActive, withoutDef, type FilterDef, type FilterId } from "./audience/filterText";
import FilterFields from "./audience/FilterFields";
import { InfoTip, Popover } from "./audience/Popover";

const KIND_OPTIONS = [
  { value: "users", label: "Accounts" },
  { value: "subscribers", label: "Subscribers" },
] as const;

const CHIP = "inline-flex items-center rounded-full border bg-white text-xs font-semibold";

/**
 * The AudienceFilter as chips (OUTREACH-REDESIGN-SPEC.md section 7): the filters in use, each opening
 * a small popover to change it and an x to drop it, "+ Add filter" for the rest, or "Pick people by
 * hand" (pickOnly: the filters step aside). The base reach rules always apply on top.
 */
const AudienceFilterEditor: FC<{
  filter: AudienceFilter;
  onChange: (filter: AudienceFilter) => void;
  campaigns: Array<{ id: string; name: string }>;
}> = ({ filter, onChange, campaigns }) => {
  const ctx = useMemo(() => ({ campaigns }), [campaigns]);
  const [openId, setOpenId] = useState<FilterId | null>(null);
  // A filter just added: shown as a chip with its popover open, gone again if closed while still empty.
  const [draft, setDraft] = useState<FilterId | null>(null);
  const [adding, setAdding] = useState(false);
  const users = filter.kind === "users";

  const active = activeDefs(filter);
  const chips = draft && !active.some((d) => d.id === draft) ? [...active, defOf(draft)] : active;
  const unused = FILTER_DEFS.filter((d) => d.kinds.includes(filter.kind) && !chips.some((c) => c.id === d.id));

  const closeChip = useCallback(() => {
    setOpenId(null);
    setDraft(null);
  }, []);
  const closeAdd = useCallback(() => setAdding(false), []);

  const add = (def: FilterDef) => {
    setAdding(false);
    if (def.start) onChange({ ...filter, ...def.start });
    if (def.fixed) return;
    setDraft(def.id);
    setOpenId(def.id);
  };

  const remove = (def: FilterDef) => {
    if (openId === def.id) closeChip();
    onChange(withoutDef(def, filter));
  };

  const setKind = (kind: AudienceFilter["kind"]) => {
    if (kind === filter.kind) return;
    closeChip();
    // Ids belong to one kind, so the picks go with the filters.
    onChange(filter.pickOnly ? { kind, pickOnly: true } : { kind });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="Who" value={filter.kind} options={KIND_OPTIONS} onChange={setKind} />
      <InfoTip label="Who can get mail">
        Always on top: has an email, not suppressed, the mail&apos;s pref on{users ? ", verified, not being deleted" : ", not unsubscribed, not bounced"}.
      </InfoTip>
      <span aria-hidden className="mx-1 h-5 w-px bg-gray-200" />

      {filter.pickOnly ? (
        <>
          <span className={cn(CHIP, "gap-1.5 border-black bg-black px-2.5 py-1 text-[#e1f073]")}>
            <Hand className="h-3.5 w-3.5" aria-hidden /> Picked by hand
          </span>
          <button type="button" onClick={() => onChange({ ...filter, pickOnly: undefined })} className="px-1 text-xs font-semibold text-gray-600 hover:text-black hover:underline">
            Use filters instead
          </button>
        </>
      ) : (
        <>
          {chips.map((def) => {
            const on = isActive(def, filter);
            const open = openId === def.id;
            const words = on ? def.text(filter, ctx) : def.label(filter.kind);
            const x = (
              <button
                type="button"
                aria-label={`Remove ${def.label(filter.kind).toLowerCase()} filter`}
                title="Remove"
                onClick={() => remove(def)}
                className="flex h-6 items-center rounded-r-full pl-0.5 pr-2 text-gray-400 hover:text-black">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            );
            if (def.fixed) {
              return (
                <span key={def.id} className={cn(CHIP, "border-gray-300 text-gray-800")}>
                  <span className="py-1 pl-2.5 pr-1">{words}</span>
                  {x}
                </span>
              );
            }
            return (
              <Popover
                key={def.id}
                open={open}
                onClose={closeChip}
                label={def.label(filter.kind)}
                trigger={
                  <span className={cn(CHIP, open ? "border-black" : on ? "border-gray-300 hover:border-black" : "border-dashed border-gray-400", on ? "text-gray-800" : "text-gray-500")}>
                    <button type="button" aria-expanded={open} onClick={() => (open ? closeChip() : setOpenId(def.id))} className="max-w-[18rem] truncate py-1 pl-2.5 pr-1">
                      {words}
                    </button>
                    {x}
                  </span>
                }>
                <FilterFields id={def.id} filter={filter} set={(patch) => onChange({ ...filter, ...patch })} ctx={ctx} />
              </Popover>
            );
          })}

          {unused.length ? (
            <Popover
              open={adding}
              onClose={closeAdd}
              label="Add a filter"
              panelClassName="p-1"
              trigger={
                <button
                  type="button"
                  aria-expanded={adding}
                  onClick={() => setAdding((a) => !a)}
                  className={cn(CHIP, "gap-1 border-dashed px-2.5 py-1 text-gray-600 hover:border-black hover:text-black", adding ? "border-black text-black" : "border-gray-400")}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add filter
                </button>
              }>
              <ul role="menu" className="flex min-w-48 flex-col">
                {unused.map((def) => (
                  <li key={def.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => add(def)}
                      className="w-full rounded px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-black">
                      {def.label(filter.kind)}
                    </button>
                  </li>
                ))}
              </ul>
            </Popover>
          ) : null}

          <button
            type="button"
            onClick={() => {
              closeChip();
              onChange({ ...filter, pickOnly: true });
            }}
            className="ml-auto inline-flex items-center gap-1.5 px-1 text-xs font-semibold text-gray-600 hover:text-black hover:underline">
            <Hand className="h-3.5 w-3.5" aria-hidden /> Pick people by hand
          </button>
        </>
      )}
    </div>
  );
};

export default AudienceFilterEditor;
