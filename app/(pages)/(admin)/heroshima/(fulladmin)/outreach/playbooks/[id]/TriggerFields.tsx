"use client";

import type { FC, ReactNode } from "react";
import { BUILT_IN_EVENTS, EVENT_LABELS, type BuiltInEvent, type MailAction, type MailAudience, type Trigger } from "@/app/lib/mail/types";
import { BTN_LINK, INPUT_SM } from "@/app/components/mail/ui";
import { numOrUndef } from "@/app/components/mail/format";

const Row: FC<{ label: string; children: ReactNode; hint?: ReactNode }> = ({ label, children, hint }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs font-semibold text-gray-600">{label}</span>
    <div className="flex flex-wrap items-center gap-1.5 text-sm">{children}</div>
    {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
  </div>
);

const KINDS: ReadonlyArray<{ value: Trigger["type"]; label: string }> = [
  { value: "event", label: "Something happens" },
  { value: "action", label: "They do something" },
  { value: "audience", label: "They join an audience" },
];

/** The trigger in the inspector: what kind (one select, so it never wraps), then the one picker it needs. "+ New trigger" opens the triggers drawer on its form. */
const TriggerFields: FC<{
  trigger: Trigger;
  onChange: (trigger: Trigger) => void;
  actions: MailAction[];
  audiences: MailAudience[];
  onNewTrigger: () => void;
}> = ({ trigger: t, onChange, actions, audiences, onNewTrigger }) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-1.5">
      <h2 className="text-sm font-bold">When they enter</h2>
      <select
        aria-label="Kind of trigger"
        className={`${INPUT_SM} w-full`}
        value={t.type}
        onChange={(e) => {
          const type = e.target.value as Trigger["type"];
          if (type === t.type) return;
          onChange(type === "action" ? { type, actionId: "", count: 2, withinDays: 3 } : type === "event" ? { type, event: "signup" } : { type, audienceId: "" });
        }}>
        {KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
    </div>
    {t.type === "action" ? (
      <>
        <Row label="Trigger">
          <select aria-label="Action" className={`${INPUT_SM} w-full`} value={t.actionId} onChange={(e) => onChange({ ...t, actionId: e.target.value })}>
            <option value="">Pick a trigger</option>
            {actions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button type="button" className={BTN_LINK} onClick={onNewTrigger} aria-haspopup="dialog">
            + New trigger
          </button>
        </Row>
        <Row label="How often">
          <input type="number" min={1} aria-label="Times" className={`${INPUT_SM} w-16 tabular-nums`} value={t.count} onChange={(e) => onChange({ ...t, count: numOrUndef(e.target.value) ?? 0 })} />
          times within
          <input type="number" min={1} aria-label="Days" className={`${INPUT_SM} w-16 tabular-nums`} value={t.withinDays} onChange={(e) => onChange({ ...t, withinDays: numOrUndef(e.target.value) ?? 0 })} />
          days
        </Row>
      </>
    ) : t.type === "event" ? (
      <Row label="What happens">
        <select aria-label="Event" className={`${INPUT_SM} w-full`} value={t.event} onChange={(e) => onChange({ ...t, event: e.target.value as BuiltInEvent })}>
          {BUILT_IN_EVENTS.map((e) => (
            <option key={e} value={e}>
              {EVENT_LABELS[e]}
            </option>
          ))}
        </select>
      </Row>
    ) : (
      <Row label="Audience" hint="Checked once a day.">
        <select aria-label="Audience" className={`${INPUT_SM} w-full`} value={t.audienceId} onChange={(e) => onChange({ ...t, audienceId: e.target.value })}>
          <option value="">Pick an audience</option>
          {audiences.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Row>
    )}
  </div>
);

export default TriggerFields;
