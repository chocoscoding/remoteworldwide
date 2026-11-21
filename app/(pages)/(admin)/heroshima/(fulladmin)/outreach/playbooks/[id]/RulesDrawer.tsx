"use client";

import type { FC, ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { BUILT_IN_EVENTS, EVENT_LABELS, GOAL_LABELS, PLAN_KEYS, type BuiltInEvent, type Entry, type Goal, type MailAction, type PlaybookInput } from "@/app/lib/mail/types";
import { BTN, BTN_PRIMARY, ChipPicker, Field, INPUT, INPUT_SM, Segmented } from "@/app/components/mail/ui";
import { numOrUndef } from "@/app/components/mail/format";
import Drawer from "@/app/components/mail/playbook/Drawer";

const PLAN_OPTIONS = PLAN_KEYS.map((p) => ({ value: p as string, label: p[0].toUpperCase() + p.slice(1) }));

const Group: FC<{ title: string; hint?: string; children: ReactNode }> = ({ title, hint, children }) => (
  <section className="flex flex-col gap-3 border-t border-gray-200 py-4 first:border-t-0 first:pt-0">
    <div>
      <h3 className="text-sm font-bold">{title}</h3>
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
    {children}
  </section>
);

/**
 * A playbook's rules in a drawer: its purpose and version, who may enter, re-entry, group, goal,
 * holdout, and the key under "Advanced". The name is the editor's title. Edits go straight into the
 * editor's form; the editor's one Save keeps them.
 */
const RulesDrawer: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: PlaybookInput;
  update: (patch: Partial<PlaybookInput>) => void;
  actions: MailAction[];
  /** The key can't change once the playbook exists. */
  keyLocked: boolean;
  /** The saved version, once the playbook exists. */
  version?: number;
}> = ({ open, onOpenChange, form, update, actions, keyLocked, version }) => {
  const entry = form.entry ?? {};
  const setEntry = (next: Entry) => update({ entry: next });
  const g = form.goal;
  const required = entry.requireActions ?? [];
  const actionOptions = (
    <>
      <option value="">Pick an action</option>
      {actions.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </>
  );

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Rules"
      description="Who may enter, how often, and when they are done. Save the playbook to keep changes."
      footer={
        <button type="button" className={BTN_PRIMARY} onClick={() => onOpenChange(false)}>
          Done
        </button>
      }>
      <Group title="Playbook" hint={version ? `Version ${version}` : undefined}>
        <Field label="What it is for">
          <input className={INPUT} value={form.description} maxLength={300} onChange={(e) => update({ description: e.target.value })} />
        </Field>
      </Group>

      <Group title="Only if" hint="Empty means anyone.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account at least, days old">
            <input type="number" min={0} className={`${INPUT} tabular-nums`} value={entry.minAccountAgeDays ?? ""} onChange={(e) => setEntry({ ...entry, minAccountAgeDays: numOrUndef(e.target.value) })} />
          </Field>
          <Field label="No offer in the last, days">
            <input type="number" min={0} className={`${INPUT} tabular-nums`} value={entry.noOfferWithinDays ?? ""} onChange={(e) => setEntry({ ...entry, noOfferWithinDays: numOrUndef(e.target.value) })} />
          </Field>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-gray-600">Plan is (none = any)</p>
          <ChipPicker label="Plan is" values={entry.plans ?? []} options={PLAN_OPTIONS} onChange={(v) => setEntry({ ...entry, plans: v })} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-gray-600">Plan is not</p>
          <ChipPicker label="Plan is not" values={entry.notPlans ?? []} options={PLAN_OPTIONS} onChange={(v) => setEntry({ ...entry, notPlans: v })} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-gray-600">And they have done</p>
          {required.length ? (
            <ul className="flex flex-col gap-2">
              {required.map((r, i) => {
                const put = (next: typeof r) => setEntry({ ...entry, requireActions: required.map((x, j) => (j === i ? next : x)) });
                return (
                  <li key={i} className="flex flex-wrap items-center gap-1.5 rounded-md border border-gray-200 p-2 text-sm">
                    <select aria-label="Action" className={`${INPUT_SM} min-w-0 flex-1`} value={r.actionId} onChange={(e) => put({ ...r, actionId: e.target.value })}>
                      {actionOptions}
                    </select>
                    <button
                      type="button"
                      aria-label="Remove"
                      title="Remove"
                      onClick={() => setEntry({ ...entry, requireActions: required.filter((_, j) => j !== i) })}
                      className="rounded border border-gray-300 p-1 hover:border-black">
                      <Trash2 className="h-3.5 w-3.5 text-[#b23c26]" aria-hidden />
                    </button>
                    <span className="flex w-full flex-wrap items-center gap-1.5">
                      at least
                      <input type="number" min={1} aria-label="Times" className={`${INPUT_SM} w-16 tabular-nums`} value={r.count} onChange={(e) => put({ ...r, count: numOrUndef(e.target.value) ?? 0 })} />
                      times, in the last
                      <input
                        type="number"
                        min={1}
                        aria-label="Days"
                        placeholder="any"
                        className={`${INPUT_SM} w-16 tabular-nums`}
                        value={r.withinDays ?? ""}
                        onChange={(e) => put({ ...r, withinDays: numOrUndef(e.target.value) })}
                      />
                      days
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <button type="button" className={`${BTN} mt-2`} onClick={() => setEntry({ ...entry, requireActions: [...required, { actionId: "", count: 1 }] })}>
            + Required action
          </button>
        </div>
      </Group>

      <Group title="Again?">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Segmented
            label="Re-entry"
            value={form.reentry.mode}
            onChange={(mode) => update({ reentry: mode === "never" ? { mode } : { mode, days: 90 } })}
            options={[
              { value: "never", label: "Once ever" },
              { value: "after_days", label: "Again after" },
            ]}
          />
          {form.reentry.mode === "after_days" ? (
            <>
              <input
                type="number"
                min={1}
                aria-label="Days"
                className={`${INPUT_SM} w-20 tabular-nums`}
                value={form.reentry.days}
                onChange={(e) => update({ reentry: { mode: "after_days", days: numOrUndef(e.target.value) ?? 0 } })}
              />
              days
            </>
          ) : null}
        </div>
      </Group>

      <Group title="Group" hint="One playbook of a group at a time per person.">
        <input className={`${INPUT} max-w-[220px]`} list="mail-playbook-groups" value={form.group ?? ""} maxLength={40} onChange={(e) => update({ group: e.target.value || null })} placeholder="None" aria-label="Group" />
        <datalist id="mail-playbook-groups">
          <option value="billing" />
          <option value="onboarding" />
        </datalist>
      </Group>

      <Group title="Goal" hint="Checked before every step. Met = they leave.">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <select
            aria-label="Goal"
            className={INPUT_SM}
            value={g.type}
            onChange={(e) => {
              const type = e.target.value as Goal["type"];
              update({ goal: type === "event" ? { type, event: "subscription_started" } : type === "action" ? { type, actionId: "" } : ({ type } as Goal) });
            }}>
            {(Object.keys(GOAL_LABELS) as Goal["type"][]).map((k) => (
              <option key={k} value={k}>
                {GOAL_LABELS[k]}
              </option>
            ))}
          </select>
          {g.type === "event" ? (
            <select aria-label="Goal event" className={INPUT_SM} value={g.event} onChange={(e) => update({ goal: { type: "event", event: e.target.value as BuiltInEvent } })}>
              {BUILT_IN_EVENTS.map((e) => (
                <option key={e} value={e}>
                  {EVENT_LABELS[e]}
                </option>
              ))}
            </select>
          ) : g.type === "action" ? (
            <select aria-label="Goal action" className={INPUT_SM} value={g.actionId} onChange={(e) => update({ goal: { type: "action", actionId: e.target.value } })}>
              {actionOptions}
            </select>
          ) : null}
        </div>
      </Group>

      <Group title="Holdout" hint="They get no mail and are measured. 10% for offer playbooks shows the real lift.">
        <div className="flex items-center gap-1.5 text-sm">
          <input
            type="number"
            min={0}
            max={50}
            aria-label="Holdout percent"
            className={`${INPUT_SM} w-16 tabular-nums`}
            value={form.holdoutPercent}
            onChange={(e) => update({ holdoutPercent: numOrUndef(e.target.value) ?? 0 })}
          />
          % of the people who enter
        </div>
      </Group>

      <details className="border-t border-gray-200 py-4">
        <summary className="cursor-pointer select-none text-sm font-bold">Advanced</summary>
        <div className="mt-3">
          <Field label={keyLocked ? "Key (fixed once made)" : "Key (empty: from the name)"}>
            <input className={`${INPUT} font-mono`} value={form.key ?? ""} maxLength={60} disabled={keyLocked} onChange={(e) => update({ key: e.target.value })} />
          </Field>
        </div>
      </details>
    </Drawer>
  );
};

export default RulesDrawer;
